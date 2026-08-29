"""方向対応バックテストシミュレータ（資金管理統合）。

シグナル生成とは独立。MM OFF + longOnly は従来の全額ロングと互換。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.money_management.fees import compute_fee
from app.money_management.service import MoneyManagementService, build_mm_stats
from app.money_management.types import (
    FeeMode,
    MoneyManagementConfig,
    MoneyManagementStats,
    TradeSidePolicy,
    money_management_from_dict,
)
from app.schemas import BacktestEquityPoint, BacktestTrade, SignalPoint, TrendScorePoint


@dataclass
class _OpenPosition:
    """建玉中の状態。"""

    is_long: bool
    quantity: float
    entry_price: float
    first_entry_price: float
    entry_date: str
    entry_reason: str
    entry_score: float | None
    entry_breakdown: dict | None
    entry_fee: float
    entry_slippage: float
    unit_qty: float
    units: int
    atr_at_entry: float | None
    risk_rate: float | None
    stop_price: float | None
    dd_steps_at_entry: int = 0


@dataclass
class SimulateResult:
    trades: list[BacktestTrade]
    equity_points: list[BacktestEquityPoint]
    mm_stats: MoneyManagementStats | None = None


def simulate_backtest(
    *,
    symbol_id: str,
    dates: list[str],
    highs: list[float],
    lows: list[float],
    closes: list[float],
    signals: list[SignalPoint],
    decision_scores: list[float | None],
    strategy_type: str,
    initial_cash: float,
    fee_rate: float,
    fee_mode: FeeMode,
    fee_fixed: float,
    slippage_rate: float,
    trade_side_policy: TradeSidePolicy,
    money_management: dict | MoneyManagementConfig | None,
    trade_start_index: int = 0,
    score_breakdowns: list[TrendScorePoint | None] | None = None,
    entry_reason_fn: Callable[..., str],
    exit_reason_fn: Callable[..., str],
    score_breakdown_payload_fn: Callable[[Any], dict | None],
) -> SimulateResult:
    """汎用シミュレータ（ロング／ショート・MM 対応）。"""
    mm_cfg = (
        money_management
        if isinstance(money_management, MoneyManagementConfig)
        else money_management_from_dict(money_management)
    )
    mm = MoneyManagementService(mm_cfg) if mm_cfg and mm_cfg.enabled else None

    atr_series: list[float | None] = []
    if mm is not None:
        atr_series = mm.compute_atr_series(highs, lows, closes)

    cash = initial_cash
    peak_equity = initial_cash
    position: _OpenPosition | None = None
    trades: list[BacktestTrade] = []
    equity_points: list[BacktestEquityPoint] = []
    breakdowns = score_breakdowns if score_breakdowns is not None else [None] * len(dates)

    risk_rates: list[float] = []
    atrs: list[float] = []
    units_list: list[float] = []
    dd_risk_rates: list[float] = []
    pyramid_won = 0
    pyramid_total = 0

    def apply_fee(notional: float) -> float:
        return compute_fee(
            notional=notional,
            fee_mode=fee_mode,
            fee_rate=fee_rate,
            fee_fixed=fee_fixed,
        )

    def close_position(
        *,
        date: str,
        fill_price: float,
        close_for_slip: float,
        exit_reason: str,
        exit_score: float | None,
        exit_breakdown: dict | None,
    ) -> None:
        nonlocal cash, position, pyramid_won, pyramid_total
        assert position is not None
        qty = position.quantity
        notional = qty * fill_price
        exit_fee = apply_fee(notional)
        exit_slip = qty * close_for_slip * slippage_rate
        if position.is_long:
            cash += qty * fill_price - exit_fee
            gross = qty * (fill_price - position.entry_price)
        else:
            cash -= qty * fill_price + exit_fee
            gross = qty * (position.entry_price - fill_price)

        fee_amount = position.entry_fee + exit_fee
        slip_amount = position.entry_slippage + exit_slip
        net = gross - fee_amount
        atr_v = position.atr_at_entry
        add_count = max(0, position.units - 1)
        mm_on = mm is not None
        trades.append(
            BacktestTrade(
                symbolId=symbol_id,
                entryDate=position.entry_date,
                exitDate=date,
                entryPrice=position.entry_price,
                exitPrice=fill_price,
                quantity=qty,
                side="buy" if position.is_long else "sell",
                grossPnl=gross,
                feeAmount=fee_amount,
                slippageAmount=slip_amount,
                netPnl=net,
                entryReason=position.entry_reason,
                exitReason=exit_reason,
                entryScore=position.entry_score,
                exitScore=exit_score,
                entryScoreBreakdown=position.entry_breakdown,
                exitScoreBreakdown=exit_breakdown,
                atr=atr_v if mm_on else None,
                n=atr_v if mm_on else None,
                riskRate=position.risk_rate if mm_on else None,
                initialQuantity=position.unit_qty if mm_on else None,
                addCount=add_count if mm_on else None,
                stopPrice=position.stop_price if mm_on else None,
                unitCount=position.units if mm_on else None,
            )
        )
        if mm_on:
            if position.risk_rate is not None:
                risk_rates.append(position.risk_rate)
            if atr_v is not None:
                atrs.append(atr_v)
            units_list.append(float(position.units))
            if position.dd_steps_at_entry > 0 and position.risk_rate is not None:
                dd_risk_rates.append(position.risk_rate)  # pragma: no cover — DD 再エントリーで稀
            if add_count > 0:
                pyramid_total += 1
                if net > 0:
                    pyramid_won += 1
        position = None

    def open_position(
        *,
        is_long: bool,
        date: str,
        close: float,
        index: int,
        score: float | None,
        reason: str,
    ) -> None:
        nonlocal cash, position
        equity = cash
        atr_v: float | None = None
        risk: float | None = None
        dd_steps = 0
        stop: float | None = None
        unit_qty = 0.0

        if mm is not None:
            atr_v = mm.volatility_at(atr_series, index)
            if atr_v is None or atr_v <= 0:
                return
            unit_qty, risk, dd_steps = mm.unit_quantity(
                equity=equity,
                equity_high=peak_equity,
                atr_value=atr_v,
            )
            if unit_qty <= 0:
                return
            if not mm.allows_units(
                symbol_id=symbol_id,
                current_units=0,
                add_units=1,
                current_risk=0,
                add_risk=risk,
            ):
                return
            qty = unit_qty
        else:
            fill_probe = close * (1.0 + slippage_rate) if is_long else close * (1.0 - slippage_rate)
            if fill_probe <= 0:
                return  # pragma: no cover
            qty = cash / fill_probe

        if is_long:
            fill = close * (1.0 + slippage_rate)
            if fill <= 0:
                return  # pragma: no cover
            if mm is None:
                qty = cash / fill
            notional = qty * fill
            fee = apply_fee(notional)
            slip = qty * close * slippage_rate
            if mm is not None and cash < notional + fee:
                return
            cash -= notional + fee
        else:
            fill = close * (1.0 - slippage_rate)
            if fill <= 0:
                return  # pragma: no cover
            if mm is None:
                qty = cash / fill
            notional = qty * fill
            fee = apply_fee(notional)
            slip = qty * close * slippage_rate
            cash += notional - fee

        if mm is not None and atr_v is not None:
            stop = mm.stop_price(is_long=is_long, entry_price=fill, atr_value=atr_v)
            unit_qty = qty

        position = _OpenPosition(
            is_long=is_long,
            quantity=qty,
            entry_price=fill,
            first_entry_price=fill,
            entry_date=date,
            entry_reason=reason,
            entry_score=score,
            entry_breakdown=score_breakdown_payload_fn(breakdowns[index]),
            entry_fee=fee,
            entry_slippage=slip,
            unit_qty=unit_qty if mm is not None else qty,
            units=1,
            atr_at_entry=atr_v,
            risk_rate=risk,
            stop_price=stop,
            dd_steps_at_entry=dd_steps,
        )

    def try_pyramid(*, close: float, index: int) -> None:
        nonlocal cash, position
        if mm is None or position is None:
            return  # pragma: no cover — 呼び出し元で保有中のみ実行
        atr_v = position.atr_at_entry or mm.volatility_at(atr_series, index)
        if atr_v is None or atr_v <= 0 or position.risk_rate is None:
            return  # pragma: no cover — 建玉時に ATR/リスクを保持
        if not mm.can_pyramid(
            is_long=position.is_long,
            first_entry_price=position.first_entry_price,
            current_price=close,
            atr_value=atr_v,
            current_units=position.units,
            symbol_id=symbol_id,
            unit_risk=position.risk_rate,
        ):
            return
        add_qty = position.unit_qty
        if add_qty <= 0:
            return  # pragma: no cover — 建玉時に unit_qty > 0
        if position.is_long:
            fill = close * (1.0 + slippage_rate)
            notional = add_qty * fill
            fee = apply_fee(notional)
            if cash < notional + fee:
                return  # pragma: no cover — 全額寄りサイジングでは稀
            cash -= notional + fee
        else:
            fill = close * (1.0 - slippage_rate)
            notional = add_qty * fill
            fee = apply_fee(notional)
            cash += notional - fee
        slip = add_qty * close * slippage_rate
        new_qty = position.quantity + add_qty
        position.entry_price = (position.entry_price * position.quantity + fill * add_qty) / new_qty
        position.quantity = new_qty
        position.entry_fee += fee
        position.entry_slippage += slip
        position.units += 1
        position.stop_price = mm.stop_price(
            is_long=position.is_long,
            entry_price=position.first_entry_price,
            atr_value=atr_v,
        )

    def check_stop(*, high: float, low: float, date: str, index: int, score: float | None) -> bool:
        if position is None or mm is None or position.stop_price is None:
            return False  # pragma: no cover — 呼び出し元で保有・MM・ストップ前提
        hit = False
        fill = position.stop_price
        if position.is_long and low <= position.stop_price:
            hit = True
        elif (not position.is_long) and high >= position.stop_price:
            hit = True
        if not hit:
            return False
        close_position(
            date=date,
            fill_price=fill,
            close_for_slip=fill,
            exit_reason="atr_stop_loss",
            exit_score=score,
            exit_breakdown=score_breakdown_payload_fn(breakdowns[index]),
        )
        return True

    for index, (date, close, signal, score) in enumerate(
        zip(dates, closes, signals, decision_scores, strict=True)
    ):
        if index < trade_start_index:
            continue

        high = highs[index]
        low = lows[index]

        if position is not None and mm is not None:
            check_stop(high=high, low=low, date=date, index=index, score=score)

        if position is None:
            if signal.buy:
                open_position(
                    is_long=True,
                    date=date,
                    close=close,
                    index=index,
                    score=score,
                    reason=entry_reason_fn(strategy_type),
                )
            elif signal.sell and trade_side_policy == "longShort":
                open_position(
                    is_long=False,
                    date=date,
                    close=close,
                    index=index,
                    score=score,
                    reason=entry_reason_fn(strategy_type),
                )
        elif position.is_long and signal.sell:
            close_position(
                date=date,
                fill_price=close * (1.0 - slippage_rate),
                close_for_slip=close,
                exit_reason=exit_reason_fn(strategy_type),
                exit_score=score,
                exit_breakdown=score_breakdown_payload_fn(breakdowns[index]),
            )
            if trade_side_policy == "longShort":
                open_position(
                    is_long=False,
                    date=date,
                    close=close,
                    index=index,
                    score=score,
                    reason=entry_reason_fn(strategy_type),
                )
        elif (not position.is_long) and signal.buy:
            close_position(
                date=date,
                fill_price=close * (1.0 + slippage_rate),
                close_for_slip=close,
                exit_reason=exit_reason_fn(strategy_type),
                exit_score=score,
                exit_breakdown=score_breakdown_payload_fn(breakdowns[index]),
            )
            open_position(
                is_long=True,
                date=date,
                close=close,
                index=index,
                score=score,
                reason=entry_reason_fn(strategy_type),
            )

        if position is not None and mm is not None:
            try_pyramid(close=close, index=index)

        if position is not None:
            pos_val = (
                position.quantity * close
                if position.is_long
                else -position.quantity * close
            )
        else:
            pos_val = 0.0
        equity = cash + pos_val
        peak_equity = max(peak_equity, equity)
        drawdown_rate = 0.0 if peak_equity <= 0 else (peak_equity - equity) / peak_equity
        equity_points.append(
            BacktestEquityPoint(
                date=date,
                cash=cash,
                positionValue=pos_val,
                equity=equity,
                drawdownRate=drawdown_rate,
                decisionScore=score,
                scoreBreakdown=score_breakdown_payload_fn(breakdowns[index]),
            )
        )

    if position is not None:
        close = closes[-1]
        date = dates[-1]
        fill = close * (1.0 - slippage_rate) if position.is_long else close * (1.0 + slippage_rate)
        close_position(
            date=date,
            fill_price=fill,
            close_for_slip=close,
            exit_reason=exit_reason_fn(strategy_type, force_close=True),
            exit_score=None,
            exit_breakdown=None,
        )
        last = equity_points[-1]
        equity_points[-1] = BacktestEquityPoint(
            date=last.date,
            cash=cash,
            positionValue=0.0,
            equity=cash,
            drawdownRate=last.drawdownRate,
            decisionScore=last.decisionScore,
            scoreBreakdown=last.scoreBreakdown,
        )

    stats = None
    if mm is not None:
        stats = build_mm_stats(
            risk_rates=risk_rates,
            atrs=atrs,
            units=units_list,
            pyramid_trades_won=pyramid_won,
            pyramid_trades_total=pyramid_total,
            dd_risk_rates=dd_risk_rates,
        )

    return SimulateResult(trades=trades, equity_points=equity_points, mm_stats=stats)
