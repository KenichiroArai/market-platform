"""
分析 API（FastAPI）のエントリ。

ヘルスに加え、テクニカル指標・シグナル・バックテストの計算エンドポイントを提供する。
NestJS（api）からは内部 HTTP（ANALYSIS_URL）経由で呼ばれる想定（認証なし）。
永続化は持たず、受け取った OHLC に対してオンデマンド計算するだけ。
"""

from __future__ import annotations

import time
from math import sqrt

from fastapi import FastAPI

from app.indicators.compute import compute_indicator_series
from app.indicators.trend_score import compute_trend_score
from app.indicators.core import macd as macd_calc
from app.indicators.core import rsi as rsi_calc
from app.indicators.core import sma as sma_calc
from app.errors import register_exception_handlers
from app.logging_middleware import RequestLoggingMiddleware
from app.schemas import (
    BacktestEquityPoint,
    BacktestSummary,
    BacktestTrade,
    ComputeIndicatorsRequest,
    ComputeIndicatorsResponse,
    ComputeTrendScoreRequest,
    ComputeTrendScoreResponse,
    ComputeSignalsRequest,
    ComputeSignalsResponse,
    HealthResponse,
    OptimizeBacktestRequest,
    OptimizeBacktestResponse,
    OptimizeBacktestResultItem,
    RunBacktestRequest,
    RunBacktestResponse,
    SignalPoint,
    SignalSpec,
)
from app.version import read_app_version

# プロセス起動時刻。uptimeSeconds 算出用。
_STARTED_AT = time.time()

app = FastAPI(
    title="market-analysis",
    version=read_app_version(),
    description="market-platform 分析 API（FastAPI）。NestJS から内部 HTTP で呼ばれる。",
)

# 共通エラーとリクエストログを配線
register_exception_handlers(app)
app.add_middleware(RequestLoggingMiddleware)


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """プロセス生存確認用。依存 DB は持たない（永続化は NestJS 側の責務）。"""
    return HealthResponse(
        status="ok",
        service="analysis",
        details={"uptimeSeconds": int(time.time() - _STARTED_AT)},
    )


@app.post(
    "/indicators",
    response_model=ComputeIndicatorsResponse,
    tags=["indicators"],
)
def compute_indicators(body: ComputeIndicatorsRequest) -> ComputeIndicatorsResponse:
    """
    OHLC 配列に対して要求されたテクニカル指標を計算する。

    bars は日付昇順であること（Nest 側でソート済みを渡す）。
    ウォームアップ不足の値は null。空の bars でも 200 + 空 points を返す。
    """
    points, drawings = compute_indicator_series(
        body.bars,
        body.indicators,
        range_start_index=max(0, body.rangeStartIndex),
    )
    return ComputeIndicatorsResponse(
        indicators=body.indicators,
        points=points,
        drawings=drawings,
    )


@app.post(
    "/trend-score",
    response_model=ComputeTrendScoreResponse,
    tags=["indicators"],
)
def compute_trend_score_endpoint(body: ComputeTrendScoreRequest) -> ComputeTrendScoreResponse:
    """
    OHLC 配列に対して日足ごとのトレンドスコアを計算する。

    指標セットはサーバ側の正本。空の bars でも 200 + 空 points を返す。
    """
    points = compute_trend_score(
        body.bars,
        range_start_index=max(0, body.rangeStartIndex),
        group_weights=body.groupWeights,
        indicator_params=body.indicatorParams,
    )
    return ComputeTrendScoreResponse(points=points)


@app.post(
    "/signals/compute",
    response_model=ComputeSignalsResponse,
    tags=["signals"],
)
def compute_signals(body: ComputeSignalsRequest) -> ComputeSignalsResponse:
    """OHLC と戦略定義から日次シグナル（buy/sell）を返す。"""
    closes = [bar.close for bar in body.bars]
    dates = [bar.date for bar in body.bars]
    points = _build_signal_points(dates, closes, body.signal, bars=body.bars)
    return ComputeSignalsResponse(points=points)


@app.post(
    "/backtests/run",
    response_model=RunBacktestResponse,
    tags=["backtests"],
)
def run_backtest(body: RunBacktestRequest) -> RunBacktestResponse:
    """ロング限定バックテストを実行する。エントリー/エグジットは終値ベース。"""
    closes = [bar.close for bar in body.bars]
    dates = [bar.date for bar in body.bars]
    trade_start = min(max(0, body.rangeStartIndex), len(dates))
    points, decision_scores = _signals_and_scores(dates, closes, body.signal, bars=body.bars)
    trades, equity_points = _simulate_long_only(
        symbol_id=body.symbolId,
        dates=dates,
        closes=closes,
        signals=points,
        decision_scores=decision_scores,
        strategy_type=body.signal.strategyType,
        initial_cash=body.initialCash,
        fee_rate=body.feeRate,
        slippage_rate=body.slippageRate,
        trade_start_index=trade_start,
    )
    summary_closes = closes[trade_start:] if trade_start < len(closes) else closes
    summary = _build_backtest_summary(
        initial_cash=body.initialCash,
        closes=summary_closes,
        trades=trades,
        equity_points=equity_points,
    )
    return RunBacktestResponse(summary=summary, trades=trades, equityPoints=equity_points)


@app.post(
    "/backtests/optimize",
    response_model=OptimizeBacktestResponse,
    tags=["backtests"],
)
def optimize_backtest(body: OptimizeBacktestRequest) -> OptimizeBacktestResponse:
    """SMA Cross の short/long を総当たりし、totalReturnRate 降順で返す（非永続）。"""
    closes = [bar.close for bar in body.bars]
    dates = [bar.date for bar in body.bars]
    results: list[OptimizeBacktestResultItem] = []
    for short in range(body.shortMin, body.shortMax + 1):
        for long in range(body.longMin, body.longMax + 1):
            if short >= long:
                continue
            spec = SignalSpec(strategyType="smaCross", shortPeriod=short, longPeriod=long)
            points, decision_scores = _signals_and_scores(dates, closes, spec, bars=body.bars)
            trades, equity_points = _simulate_long_only(
                symbol_id=body.symbolId,
                dates=dates,
                closes=closes,
                signals=points,
                decision_scores=decision_scores,
                strategy_type=spec.strategyType,
                initial_cash=body.initialCash,
                fee_rate=body.feeRate,
                slippage_rate=body.slippageRate,
            )
            summary = _build_backtest_summary(
                initial_cash=body.initialCash,
                closes=closes,
                trades=trades,
                equity_points=equity_points,
            )
            results.append(
                OptimizeBacktestResultItem(shortPeriod=short, longPeriod=long, summary=summary)
            )
    results.sort(key=lambda item: item.summary.totalReturnRate, reverse=True)
    return OptimizeBacktestResponse(results=results)


def _signals_and_scores(
    dates: list[str],
    closes: list[float],
    spec: SignalSpec,
    *,
    bars: list,
) -> tuple[list[SignalPoint], list[float | None]]:
    """シグナルと判断スコアを一度に組み立てる（トレンドスコアの二重計算を避ける）。"""
    if spec.strategyType == "trendScoreThreshold":
        assert spec.buyThreshold is not None and spec.sellThreshold is not None
        score_series = [point.score for point in compute_trend_score(bars, range_start_index=0)]
        points = _score_threshold_signal_points(
            dates,
            score_series,
            buy_threshold=spec.buyThreshold,
            sell_threshold=spec.sellThreshold,
        )
        return points, score_series

    points = _build_signal_points(dates, closes, spec, bars=bars)
    return points, _decision_scores(dates, closes, spec)


def _build_signal_points(
    dates: list[str],
    closes: list[float],
    spec: SignalSpec,
    *,
    bars: list | None = None,
) -> list[SignalPoint]:
    """戦略種別ごとの売買シグナルを統一形式に変換する。"""
    if spec.strategyType == "smaCross":
        assert spec.shortPeriod is not None and spec.longPeriod is not None
        short = sma_calc(closes, spec.shortPeriod)
        long = sma_calc(closes, spec.longPeriod)
        return _cross_signal_points(dates, short, long, direction="golden_dead")

    if spec.strategyType == "rsiThreshold":
        assert spec.period is not None and spec.lower is not None and spec.upper is not None
        rsi_values = rsi_calc(closes, spec.period)
        out: list[SignalPoint] = []
        for d, value in zip(dates, rsi_values, strict=True):
            if value is None:
                out.append(SignalPoint(date=d, buy=False, sell=False))
            else:
                out.append(SignalPoint(date=d, buy=value <= spec.lower, sell=value >= spec.upper))
        return out

    if spec.strategyType == "trendScoreThreshold":
        assert bars is not None
        assert spec.buyThreshold is not None and spec.sellThreshold is not None
        score_series = [point.score for point in compute_trend_score(bars, range_start_index=0)]
        return _score_threshold_signal_points(
            dates,
            score_series,
            buy_threshold=spec.buyThreshold,
            sell_threshold=spec.sellThreshold,
        )

    assert spec.fast is not None and spec.slow is not None and spec.signal is not None
    macd_line, signal_line, _ = macd_calc(
        closes,
        fast=spec.fast,
        slow=spec.slow,
        signal=spec.signal,
    )
    return _cross_signal_points(dates, macd_line, signal_line, direction="golden_dead")


def _score_threshold_signal_points(
    dates: list[str],
    scores: list[float | None],
    *,
    buy_threshold: float,
    sell_threshold: float,
) -> list[SignalPoint]:
    """総合スコアが買い／売り閾値をまたいだ日にシグナルを立てる。"""
    out: list[SignalPoint] = []
    prev: float | None = None
    for date, score in zip(dates, scores, strict=True):
        buy = False
        sell = False
        if prev is not None and score is not None:
            buy = prev < buy_threshold and score >= buy_threshold
            sell = prev > sell_threshold and score <= sell_threshold
        out.append(SignalPoint(date=date, buy=buy, sell=sell))
        prev = score
    return out


def _cross_signal_points(
    dates: list[str],
    left: list[float | None],
    right: list[float | None],
    *,
    direction: str,
) -> list[SignalPoint]:
    """2系列のクロス（前日<=当日> など）を buy/sell に変換する。"""
    out: list[SignalPoint] = []
    prev_left: float | None = None
    prev_right: float | None = None
    for date, l_now, r_now in zip(dates, left, right, strict=True):
        buy = False
        sell = False
        if (
            prev_left is not None
            and prev_right is not None
            and l_now is not None
            and r_now is not None
            and direction == "golden_dead"
        ):
            buy = prev_left <= prev_right and l_now > r_now
            sell = prev_left >= prev_right and l_now < r_now
        out.append(SignalPoint(date=date, buy=buy, sell=sell))
        prev_left = l_now
        prev_right = r_now
    return out


def _entry_reason_code(strategy_type: str) -> str:
    """買いシグナル発火時の理由コード。"""
    if strategy_type == "smaCross":
        return "sma_golden_cross"
    if strategy_type == "macdCross":
        return "macd_golden_cross"
    if strategy_type == "trendScoreThreshold":
        return "score_cross_up"
    return "rsi_oversold"


def _exit_reason_code(strategy_type: str, *, force_close: bool = False) -> str:
    """売りシグナル／期間末強制決済の理由コード。"""
    if force_close:
        return "force_close_end"
    if strategy_type == "smaCross":
        return "sma_dead_cross"
    if strategy_type == "macdCross":
        return "macd_dead_cross"
    if strategy_type == "trendScoreThreshold":
        return "score_cross_down"
    return "rsi_overbought"


def _decision_scores(dates: list[str], closes: list[float], spec: SignalSpec) -> list[float | None]:
    """判断に使ったスコア系列。RSI / トレンドスコア以外は常に None。"""
    if spec.strategyType == "rsiThreshold":
        assert spec.period is not None
        return list(rsi_calc(closes, spec.period))
    return [None] * len(dates)


def _simulate_long_only(
    *,
    symbol_id: str,
    dates: list[str],
    closes: list[float],
    signals: list[SignalPoint],
    decision_scores: list[float | None],
    strategy_type: str,
    initial_cash: float,
    fee_rate: float,
    slippage_rate: float,
    trade_start_index: int = 0,
) -> tuple[list[BacktestTrade], list[BacktestEquityPoint]]:
    """ロング限定の単純売買シミュレーション（全額投資・同時保有1ポジション）。

    trade_start_index より前はウォームアップ専用（売買・エクイティ点を出さない）。
    """
    cash = initial_cash
    quantity = 0.0
    entry_price = 0.0
    entry_date = ""
    entry_reason = ""
    entry_score: float | None = None
    entry_fee = 0.0
    entry_slippage = 0.0
    peak_equity = initial_cash
    trades: list[BacktestTrade] = []
    equity_points: list[BacktestEquityPoint] = []

    for index, (date, close, signal, score) in enumerate(
        zip(dates, closes, signals, decision_scores, strict=True)
    ):
        if index < trade_start_index:
            continue

        if quantity == 0.0 and signal.buy:
            fill_price = close * (1.0 + slippage_rate)
            quantity = cash / fill_price if fill_price > 0 else 0.0
            entry_fee = quantity * fill_price * fee_rate
            entry_slippage = quantity * close * slippage_rate
            cash -= quantity * fill_price + entry_fee
            entry_price = fill_price
            entry_date = date
            entry_reason = _entry_reason_code(strategy_type)
            entry_score = score
        elif quantity > 0.0 and signal.sell:
            fill_price = close * (1.0 - slippage_rate)
            exit_fee = quantity * fill_price * fee_rate
            exit_slippage = quantity * close * slippage_rate
            proceeds = quantity * fill_price - exit_fee
            cash += proceeds
            gross_pnl = quantity * (fill_price - entry_price)
            fee_amount = entry_fee + exit_fee
            slippage_amount = entry_slippage + exit_slippage
            net_pnl = gross_pnl - fee_amount
            trades.append(
                BacktestTrade(
                    symbolId=symbol_id,
                    entryDate=entry_date,
                    exitDate=date,
                    entryPrice=entry_price,
                    exitPrice=fill_price,
                    quantity=quantity,
                    side="buy",
                    grossPnl=gross_pnl,
                    feeAmount=fee_amount,
                    slippageAmount=slippage_amount,
                    netPnl=net_pnl,
                    entryReason=entry_reason,
                    exitReason=_exit_reason_code(strategy_type),
                    entryScore=entry_score,
                    exitScore=score,
                )
            )
            quantity = 0.0
            entry_price = 0.0
            entry_date = ""
            entry_reason = ""
            entry_score = None

        position_value = quantity * close
        equity = cash + position_value
        peak_equity = max(peak_equity, equity)
        drawdown_rate = 0.0 if peak_equity <= 0 else (peak_equity - equity) / peak_equity
        equity_points.append(
            BacktestEquityPoint(
                date=date,
                cash=cash,
                positionValue=position_value,
                equity=equity,
                drawdownRate=drawdown_rate,
            )
        )

    if quantity > 0.0:
        close = closes[-1]
        date = dates[-1]
        fill_price = close * (1.0 - slippage_rate)
        exit_fee = quantity * fill_price * fee_rate
        exit_slippage = quantity * close * slippage_rate
        proceeds = quantity * fill_price - exit_fee
        cash += proceeds
        gross_pnl = quantity * (fill_price - entry_price)
        fee_amount = entry_fee + exit_fee
        slippage_amount = entry_slippage + exit_slippage
        net_pnl = gross_pnl - fee_amount
        trades.append(
            BacktestTrade(
                symbolId=symbol_id,
                entryDate=entry_date,
                exitDate=date,
                entryPrice=entry_price,
                exitPrice=fill_price,
                quantity=quantity,
                side="buy",
                grossPnl=gross_pnl,
                feeAmount=fee_amount,
                slippageAmount=slippage_amount,
                netPnl=net_pnl,
                entryReason=entry_reason,
                exitReason=_exit_reason_code(strategy_type, force_close=True),
                entryScore=entry_score,
                # 期間末強制決済はスコア判断ではない
                exitScore=None,
            )
        )
        quantity = 0.0
        last = equity_points[-1]
        equity_points[-1] = BacktestEquityPoint(
            date=last.date,
            cash=cash,
            positionValue=0.0,
            equity=cash,
            drawdownRate=last.drawdownRate,
        )
    return trades, equity_points


def _build_backtest_summary(
    *,
    initial_cash: float,
    closes: list[float],
    trades: list[BacktestTrade],
    equity_points: list[BacktestEquityPoint],
) -> BacktestSummary:
    """トレードとエクイティカーブから集計値を算出する。"""
    final_equity = equity_points[-1].equity if equity_points else initial_cash
    max_drawdown = max((point.drawdownRate for point in equity_points), default=0.0)
    win_count = len([trade for trade in trades if trade.netPnl > 0.0])
    win_rate = 0.0 if len(trades) == 0 else win_count / len(trades)
    buy_hold_final, buy_hold_return = _buy_hold_metrics(initial_cash=initial_cash, closes=closes)
    return BacktestSummary(
        finalEquity=final_equity,
        totalReturnRate=0.0 if initial_cash == 0 else (final_equity - initial_cash) / initial_cash,
        maxDrawdownRate=max_drawdown,
        totalTrades=len(trades),
        winRate=win_rate,
        sharpeRatio=_sharpe_ratio(equity_points),
        profitFactor=_profit_factor(trades),
        buyHoldReturnRate=buy_hold_return,
        buyHoldFinalEquity=buy_hold_final,
    )


def _buy_hold_metrics(*, initial_cash: float, closes: list[float]) -> tuple[float, float]:
    """初日終値で全額買い・末日終値で評価（手数料・スリッページなし）。"""
    if not closes or closes[0] == 0.0 or initial_cash == 0.0:
        return initial_cash, 0.0
    quantity = initial_cash / closes[0]
    final_equity = quantity * closes[-1]
    return final_equity, (final_equity - initial_cash) / initial_cash


def _sharpe_ratio(equity_points: list[BacktestEquityPoint]) -> float:
    """日次エクイティ収益率から年率シャープ（リスクフリー 0、√252）。"""
    if len(equity_points) < 2:
        return 0.0
    returns: list[float] = []
    for prev, curr in zip(equity_points, equity_points[1:], strict=False):
        if prev.equity == 0.0:
            returns.append(0.0)
        else:
            returns.append((curr.equity - prev.equity) / prev.equity)
    mean = sum(returns) / len(returns)
    variance = sum((value - mean) ** 2 for value in returns) / len(returns)
    std = sqrt(variance)
    if std == 0.0:
        return 0.0
    return (mean / std) * sqrt(252)


def _profit_factor(trades: list[BacktestTrade]) -> float:
    """勝ち純損益合計 / |負け純損益合計|。

    負けが 0 かつ勝ちがある場合は勝ち合計を返す（無限大の代わりの有限規約）。
    トレードなし、または勝ちが無い場合は 0。
    """
    wins = sum(trade.netPnl for trade in trades if trade.netPnl > 0.0)
    losses = sum(trade.netPnl for trade in trades if trade.netPnl < 0.0)
    if wins <= 0.0:
        return 0.0
    if losses == 0.0:
        return wins
    return wins / abs(losses)
