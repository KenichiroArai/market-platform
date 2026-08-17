"""
分析 API（FastAPI）のエントリ。

ヘルスに加え、テクニカル指標・シグナル・バックテストの計算エンドポイントを提供する。
NestJS（api）からは内部 HTTP（ANALYSIS_URL）経由で呼ばれる想定（認証なし）。
永続化は持たず、受け取った OHLC に対してオンデマンド計算するだけ。
"""

from __future__ import annotations

import time

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
    points = compute_trend_score(body.bars, range_start_index=max(0, body.rangeStartIndex))
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
    points = _build_signal_points(dates, closes, body.signal)
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
    points = _build_signal_points(dates, closes, body.signal)
    trades, equity_points = _simulate_long_only(
        symbol_id=body.symbolId,
        dates=dates,
        closes=closes,
        signals=points,
        initial_cash=body.initialCash,
        fee_rate=body.feeRate,
        slippage_rate=body.slippageRate,
    )
    summary = _build_backtest_summary(initial_cash=body.initialCash, trades=trades, equity_points=equity_points)
    return RunBacktestResponse(summary=summary, trades=trades, equityPoints=equity_points)


def _build_signal_points(dates: list[str], closes: list[float], spec: SignalSpec) -> list[SignalPoint]:
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

    assert spec.fast is not None and spec.slow is not None and spec.signal is not None
    macd_line, signal_line, _ = macd_calc(
        closes,
        fast=spec.fast,
        slow=spec.slow,
        signal=spec.signal,
    )
    return _cross_signal_points(dates, macd_line, signal_line, direction="golden_dead")


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


def _simulate_long_only(
    *,
    symbol_id: str,
    dates: list[str],
    closes: list[float],
    signals: list[SignalPoint],
    initial_cash: float,
    fee_rate: float,
    slippage_rate: float,
) -> tuple[list[BacktestTrade], list[BacktestEquityPoint]]:
    """ロング限定の単純売買シミュレーション（全額投資・同時保有1ポジション）。"""
    cash = initial_cash
    quantity = 0.0
    entry_price = 0.0
    entry_date = ""
    entry_fee = 0.0
    entry_slippage = 0.0
    peak_equity = initial_cash
    trades: list[BacktestTrade] = []
    equity_points: list[BacktestEquityPoint] = []

    for date, close, signal in zip(dates, closes, signals, strict=True):
        if quantity == 0.0 and signal.buy:
            fill_price = close * (1.0 + slippage_rate)
            quantity = cash / fill_price if fill_price > 0 else 0.0
            entry_fee = quantity * fill_price * fee_rate
            entry_slippage = quantity * close * slippage_rate
            cash -= quantity * fill_price + entry_fee
            entry_price = fill_price
            entry_date = date
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
                )
            )
            quantity = 0.0
            entry_price = 0.0
            entry_date = ""

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
    *, initial_cash: float, trades: list[BacktestTrade], equity_points: list[BacktestEquityPoint]
) -> BacktestSummary:
    """トレードとエクイティカーブから集計値を算出する。"""
    final_equity = equity_points[-1].equity if equity_points else initial_cash
    max_drawdown = max((point.drawdownRate for point in equity_points), default=0.0)
    win_count = len([trade for trade in trades if trade.netPnl > 0.0])
    win_rate = 0.0 if len(trades) == 0 else win_count / len(trades)
    return BacktestSummary(
        finalEquity=final_equity,
        totalReturnRate=0.0 if initial_cash == 0 else (final_equity - initial_cash) / initial_cash,
        maxDrawdownRate=max_drawdown,
        totalTrades=len(trades),
        winRate=win_rate,
    )
