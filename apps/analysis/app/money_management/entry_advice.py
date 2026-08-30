"""チャート分析向けエントリー助言（ADR 017）。

シグナル履歴から建玉を推定し、MM 水準と予測エントリーを返す。
"""

from __future__ import annotations

from dataclasses import dataclass

from app.money_management.pyramiding import next_pyramid_level_price
from app.money_management.service import MoneyManagementService
from app.money_management.types import MoneyManagementConfig, TradeSidePolicy, money_management_from_dict
from app.schemas import (
    EntryAdviceMmModel,
    EntryAdviceNewEntryModel,
    EntryAdvicePositionModel,
    EntryAdvicePredictedEntryModel,
    EntryAdvicePyramidLevelModel,
    EntryAdviceRequest,
    EntryAdviceResponse,
    SignalPoint,
    SignalSpec,
)


@dataclass
class _PositionSnapshot:
    """基準日時点の建玉スナップショット。"""

    is_long: bool
    entry_date: str
    entry_price: float
    first_entry_price: float
    units: int
    unit_qty: float
    quantity: float
    atr_at_entry: float | None
    risk_rate: float | None
    stop_price: float | None


def compute_entry_advice(body: EntryAdviceRequest) -> EntryAdviceResponse:
    """エントリー助言を組み立てる。"""
    from app.main import _entry_reason_code, _score_breakdown_payload, _signals_and_scores

    bars = body.bars
    if not bars:
        return _empty_response(body.symbolId, body.baseDate, "価格データがありません")

    dates = [b.date for b in bars]
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    closes = [b.close for b in bars]

    base_index = _resolve_base_index(dates, body.baseDate)
    if base_index is None:
        return _empty_response(body.symbolId, body.baseDate, "基準日が範囲外です")

    resolved_base_date = dates[base_index]
    spec = body.signal
    signals, decision_scores, breakdowns = _signals_and_scores(
        dates,
        closes,
        spec,
        bars=bars,
        group_weights=body.groupWeights,
        indicator_params=body.indicatorParams,
    )

    mm_cfg = _parse_mm_config(body.moneyManagement)
    mm = MoneyManagementService(mm_cfg) if mm_cfg and mm_cfg.enabled else None
    atr_series: list[float | None] = []
    if mm is not None:
        atr_series = mm.compute_atr_series(highs, lows, closes)

    position = _walk_position_to_index(
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        end_index=base_index,
        trade_side_policy=body.tradeSidePolicy,
        mm=mm,
        atr_series=atr_series,
        symbol_id=body.symbolId,
        initial_cash=body.initialCash,
        equity_high=body.initialCash,
    )

    signal_at_base = signals[base_index]
    signal_active = signal_at_base.buy or signal_at_base.sell
    signal_label = _signal_label(spec)
    score_ctx = _trend_score_context(
        spec=spec,
        base_index=base_index,
        decision_scores=decision_scores,
        breakdowns=breakdowns,
        signal_at_base=signal_at_base,
    )

    def _new_entry_model(direction_long: bool) -> EntryAdviceNewEntryModel | None:
        if mm is None:
            return None
        mm_out, pyramid = _mm_levels_for_hypothetical_entry(
            mm=mm,
            is_long=direction_long,
            entry_price=closes[base_index],
            atr_series=atr_series,
            index=base_index,
            equity=body.initialCash,
            equity_high=body.initialCash,
            symbol_id=body.symbolId,
            current_price=closes[base_index],
        )
        if mm_out is None:
            return None
        return EntryAdviceNewEntryModel(
            entryPrice=closes[base_index],
            isLong=direction_long,
            mm=_to_mm_model(mm_out),
            pyramidLevels=_to_pyramid_models(pyramid),
        )

    if position is not None:
        entry_timing = "in_position"
        direction = "long" if position.is_long else "short"
        mm_out, pyramid = _mm_levels_for_position(
            mm=mm,
            position=position,
            current_price=closes[base_index],
            symbol_id=body.symbolId,
        )
        return EntryAdviceResponse(
            symbolId=body.symbolId,
            baseDate=resolved_base_date,
            entryTiming=entry_timing,
            direction=direction,
            signalActive=signal_active,
            signalLabel=signal_label,
            noRuleReason=None,
            position=EntryAdvicePositionModel(
                entryDate=position.entry_date,
                entryPrice=position.entry_price,
                units=position.units,
                isLong=position.is_long,
            ),
            mm=_to_mm_model(mm_out),
            pyramidLevels=_to_pyramid_models(pyramid),
            predictedEntry=None,
            scoreAtBase=score_ctx["scoreAtBase"],
            buyThreshold=score_ctx["buyThreshold"],
            sellThreshold=score_ctx["sellThreshold"],
            scoreBreakdown=score_ctx["scoreBreakdown"],
            rationale=score_ctx["rationale"],
            entryReasonCode=score_ctx["entryReasonCode"],
            newEntryFromBase=_new_entry_model(not position.is_long if body.tradeSidePolicy == "longShort" else True),
        )

    if signal_at_base.buy or (signal_at_base.sell and body.tradeSidePolicy == "longShort"):
        is_long = signal_at_base.buy
        entry_timing = "entry_now"
        direction = "long" if is_long else "short"
        mm_out, pyramid = _mm_levels_for_hypothetical_entry(
            mm=mm,
            is_long=is_long,
            entry_price=closes[base_index],
            atr_series=atr_series,
            index=base_index,
            equity=body.initialCash,
            equity_high=body.initialCash,
            symbol_id=body.symbolId,
            current_price=closes[base_index],
        )
        entry_reason = _entry_reason_code(spec.strategyType) if is_long else None
        if not is_long:
            from app.main import _exit_reason_code

            entry_reason = _exit_reason_code(spec.strategyType)
        return EntryAdviceResponse(
            symbolId=body.symbolId,
            baseDate=resolved_base_date,
            entryTiming=entry_timing,
            direction=direction,
            signalActive=True,
            signalLabel=signal_label,
            noRuleReason=None,
            position=None,
            mm=_to_mm_model(mm_out),
            pyramidLevels=_to_pyramid_models(pyramid),
            predictedEntry=None,
            scoreAtBase=score_ctx["scoreAtBase"],
            buyThreshold=score_ctx["buyThreshold"],
            sellThreshold=score_ctx["sellThreshold"],
            scoreBreakdown=score_ctx["scoreBreakdown"],
            rationale=score_ctx["rationale"],
            entryReasonCode=entry_reason or score_ctx["entryReasonCode"],
            newEntryFromBase=None,
        )

    predicted = _predict_entry(
        spec=spec,
        dates=dates,
        closes=closes,
        signals=signals,
        decision_scores=decision_scores,
        bars=bars,
        from_index=base_index,
        trade_side_policy=body.tradeSidePolicy,
    )
    pred_model = None
    pred_direction = predicted.get("direction")
    if predicted.get("predicted"):
        p = predicted["predicted"]
        pred_model = EntryAdvicePredictedEntryModel(
            triggerDate=p.get("triggerDate"),
            triggerPrice=p.get("triggerPrice"),
            direction=p["direction"],
            basis=p["basis"],
            note=p["note"],
        )
    new_long = pred_direction != "short"
    return EntryAdviceResponse(
        symbolId=body.symbolId,
        baseDate=resolved_base_date,
        entryTiming="wait",
        direction=pred_direction,
        signalActive=False,
        signalLabel=signal_label,
        noRuleReason=None,
        position=None,
        mm=None,
        pyramidLevels=None,
        predictedEntry=pred_model,
        scoreAtBase=score_ctx["scoreAtBase"],
        buyThreshold=score_ctx["buyThreshold"],
        sellThreshold=score_ctx["sellThreshold"],
        scoreBreakdown=score_ctx["scoreBreakdown"],
        rationale=score_ctx["rationale"],
        entryReasonCode=score_ctx["entryReasonCode"],
        newEntryFromBase=_new_entry_model(new_long),
    )


def _to_mm_model(raw: dict | None) -> EntryAdviceMmModel | None:
    if raw is None:
        return None
    return EntryAdviceMmModel(**raw)


def _to_pyramid_models(rows: list[dict] | None) -> list[EntryAdvicePyramidLevelModel] | None:
    if rows is None:
        return None
    return [EntryAdvicePyramidLevelModel(**row) for row in rows]


def _empty_response(symbol_id: str, base_date: str, reason: str) -> EntryAdviceResponse:
    return EntryAdviceResponse(
        symbolId=symbol_id,
        baseDate=base_date,
        entryTiming="no_rule",
        direction=None,
        signalActive=False,
        signalLabel="",
        noRuleReason=reason,
        position=None,
        mm=None,
        pyramidLevels=None,
        predictedEntry=None,
        scoreAtBase=None,
        buyThreshold=None,
        sellThreshold=None,
        scoreBreakdown=None,
        rationale=None,
        entryReasonCode=None,
        newEntryFromBase=None,
    )


def _trend_score_context(
    *,
    spec: SignalSpec,
    base_index: int,
    decision_scores: list[float | None],
    breakdowns: list,
    signal_at_base: SignalPoint,
) -> dict:
    """トレンドスコア戦略時のスコア・根拠フィールド。"""
    if spec.strategyType != "trendScoreThreshold":
        return {
            "scoreAtBase": None,
            "buyThreshold": None,
            "sellThreshold": None,
            "scoreBreakdown": None,
            "rationale": None,
            "entryReasonCode": None,
        }
    from app.main import _entry_reason_code, _exit_reason_code, _score_breakdown_payload

    assert spec.buyThreshold is not None and spec.sellThreshold is not None
    score = decision_scores[base_index]
    breakdown = breakdowns[base_index]
    breakdown_payload = _score_breakdown_payload(breakdown)
    entry_reason: str | None = None
    if signal_at_base.buy:
        entry_reason = _entry_reason_code(spec.strategyType)
    elif signal_at_base.sell:
        entry_reason = _exit_reason_code(spec.strategyType)
    rationale = _build_trend_score_rationale(
        score=score,
        buy_threshold=spec.buyThreshold,
        sell_threshold=spec.sellThreshold,
        breakdown_payload=breakdown_payload,
        signal_buy=signal_at_base.buy,
        signal_sell=signal_at_base.sell,
    )
    return {
        "scoreAtBase": score,
        "buyThreshold": spec.buyThreshold,
        "sellThreshold": spec.sellThreshold,
        "scoreBreakdown": breakdown_payload,
        "rationale": rationale,
        "entryReasonCode": entry_reason,
    }


def _build_trend_score_rationale(
    *,
    score: float | None,
    buy_threshold: float,
    sell_threshold: float,
    breakdown_payload: dict | None,
    signal_buy: bool,
    signal_sell: bool,
) -> str:
    parts: list[str] = []
    if score is not None:
        parts.append(f"総合スコア {round(score, 1)}")
    parts.append(f"買い閾値 ≥{buy_threshold}")
    parts.append(f"売り閾値 ≤{sell_threshold}")
    if signal_buy:
        parts.append("基準日で買いシグナル（スコアが買い閾値以上）")
    elif signal_sell:
        parts.append("基準日で売りシグナル（スコアが売り閾値以下）")
    elif score is not None and score < buy_threshold:
        parts.append(f"買いシグナルまであと {round(buy_threshold - score, 1)} 点")
    if breakdown_payload and breakdown_payload.get("indicators"):
        hints: list[str] = []
        for key, val in sorted(
            breakdown_payload["indicators"].items(),
            key=lambda item: abs(item[1] or 0),
            reverse=True,
        )[:6]:
            if val is not None:
                hints.append(f"{key}={round(val, 1)}")
        if hints:
            parts.append("指標点数（高いほど買い寄与）: " + ", ".join(hints))
    return " / ".join(parts)


def _resolve_base_index(dates: list[str], base_date: str) -> int | None:
    for index, date in enumerate(dates):
        if date == base_date:
            return index
    return None


def _parse_mm_config(raw: dict | MoneyManagementConfig | None) -> MoneyManagementConfig | None:
    if raw is None:
        return None
    if isinstance(raw, MoneyManagementConfig):
        return raw
    return money_management_from_dict(raw)


def _signal_label(spec: SignalSpec) -> str:
    if spec.strategyType == "smaCross":
        return f"SMA {spec.shortPeriod}/{spec.longPeriod} クロス"
    if spec.strategyType == "rsiThreshold":
        return f"RSI {spec.period}（{spec.lower}/{spec.upper}）"
    if spec.strategyType == "macdCross":
        return f"MACD {spec.fast}/{spec.slow}/{spec.signal}"
    return f"トレンドスコア（≥{spec.buyThreshold} / ≤{spec.sellThreshold}）"


def _walk_position_to_index(
    *,
    dates: list[str],
    highs: list[float],
    lows: list[float],
    closes: list[float],
    signals: list[SignalPoint],
    end_index: int,
    trade_side_policy: TradeSidePolicy,
    mm: MoneyManagementService | None,
    atr_series: list[float | None],
    symbol_id: str,
    initial_cash: float,
    equity_high: float,
) -> _PositionSnapshot | None:
    """0..end_index までシグナルとストップを処理し、建玉状態を返す。"""
    position: _PositionSnapshot | None = None

    def close_position() -> None:
        nonlocal position
        position = None

    def open_position(
        *,
        is_long: bool,
        date: str,
        close: float,
        index: int,
    ) -> None:
        nonlocal position
        atr_v: float | None = None
        risk: float | None = None
        stop: float | None = None
        unit_qty = 0.0
        qty = 0.0

        if mm is not None:
            atr_v = mm.volatility_at(atr_series, index)
            if atr_v is None or atr_v <= 0:
                return
            unit_qty, risk, _ = mm.unit_quantity(
                equity=initial_cash,
                equity_high=equity_high,
                atr_value=atr_v,
            )
            if unit_qty <= 0:
                return  # pragma: no cover
            if not mm.allows_units(
                symbol_id=symbol_id,
                current_units=0,
                add_units=1,
                current_risk=0,
                add_risk=risk,
            ):
                return
            qty = unit_qty
            stop = mm.stop_price(is_long=is_long, entry_price=close, atr_value=atr_v)
        else:
            qty = initial_cash / close if close > 0 else 0  # pragma: no cover
            if qty <= 0:
                return  # pragma: no cover
            unit_qty = qty

        position = _PositionSnapshot(
            is_long=is_long,
            entry_date=date,
            entry_price=close,
            first_entry_price=close,
            units=1,
            unit_qty=unit_qty,
            quantity=qty,
            atr_at_entry=atr_v,
            risk_rate=risk,
            stop_price=stop,
        )

    def try_pyramid(close: float, index: int) -> None:
        nonlocal position
        if mm is None or position is None:
            return  # pragma: no cover
        atr_v = position.atr_at_entry or mm.volatility_at(atr_series, index)
        if atr_v is None or atr_v <= 0 or position.risk_rate is None:
            return  # pragma: no cover
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
            return  # pragma: no cover
        new_qty = position.quantity + add_qty
        position.entry_price = (position.entry_price * position.quantity + close * add_qty) / new_qty
        position.quantity = new_qty
        position.units += 1
        position.stop_price = mm.stop_price(
            is_long=position.is_long,
            entry_price=position.first_entry_price,
            atr_value=atr_v,
        )

    def check_stop(high: float, low: float) -> bool:
        if position is None or mm is None or position.stop_price is None:
            return False  # pragma: no cover
        hit = False
        if position.is_long and low <= position.stop_price:
            hit = True
        elif (not position.is_long) and high >= position.stop_price:
            hit = True  # pragma: no cover
        if hit:
            close_position()
        return hit

    for index in range(end_index + 1):
        date = dates[index]
        close = closes[index]
        signal = signals[index]
        high = highs[index]
        low = lows[index]

        if position is not None and mm is not None:
            check_stop(high=high, low=low)

        if position is None:
            if signal.buy:
                open_position(is_long=True, date=date, close=close, index=index)
            elif signal.sell and trade_side_policy == "longShort":
                open_position(is_long=False, date=date, close=close, index=index)
        elif position.is_long and signal.sell:
            close_position()
            if trade_side_policy == "longShort":
                open_position(is_long=False, date=date, close=close, index=index)
        elif (not position.is_long) and signal.buy:
            close_position()
            open_position(is_long=True, date=date, close=close, index=index)

        if position is not None and mm is not None:
            try_pyramid(close=close, index=index)

    return position


def _mm_dict(
    atr: float | None,
    risk: float | None,
    unit_qty: float | None,
    stop: float | None,
) -> dict | None:
    if atr is None and risk is None and unit_qty is None and stop is None:
        return None  # pragma: no cover
    return {
        "atr": atr,
        "riskRate": risk,
        "unitQuantity": unit_qty,
        "stopPrice": stop,
    }


def _pyramid_levels(
    *,
    mm: MoneyManagementService,
    symbol_id: str,
    is_long: bool,
    first_entry_price: float,
    atr_value: float,
    units: int,
    current_price: float,
) -> list[dict]:
    levels: list[dict] = []
    max_units = mm.max_units_for_symbol(symbol_id)
    for unit_index in range(2, max_units + 1):
        price = next_pyramid_level_price(
            is_long=is_long,
            first_entry_price=first_entry_price,
            atr_value=atr_value,
            step_atr_multiple=mm.config.pyramiding.stepAtrMultiple,
            next_unit_index=unit_index,
        )
        reached = current_price >= price if is_long else current_price <= price
        levels.append({"unitIndex": unit_index, "price": price, "reached": reached})
    return levels


def _mm_levels_for_position(
    *,
    mm: MoneyManagementService | None,
    position: _PositionSnapshot,
    current_price: float,
    symbol_id: str,
) -> tuple[dict | None, list[dict] | None]:
    if mm is None:
        return None, None
    pyramid: list[dict] | None = None
    if position.atr_at_entry is not None and mm.config.pyramiding.enabled:
        pyramid = _pyramid_levels(
            mm=mm,
            symbol_id=symbol_id,
            is_long=position.is_long,
            first_entry_price=position.first_entry_price,
            atr_value=position.atr_at_entry,
            units=position.units,
            current_price=current_price,
        )
    return (
        _mm_dict(
            position.atr_at_entry,
            position.risk_rate,
            position.unit_qty,
            position.stop_price,
        ),
        pyramid,
    )


def _mm_levels_for_hypothetical_entry(
    *,
    mm: MoneyManagementService | None,
    is_long: bool,
    entry_price: float,
    atr_series: list[float | None],
    index: int,
    equity: float,
    equity_high: float,
    symbol_id: str,
    current_price: float,
) -> tuple[dict | None, list[dict] | None]:
    if mm is None:
        return None, None
    atr_v = mm.volatility_at(atr_series, index)
    if atr_v is None or atr_v <= 0:
        return None, None
    unit_qty, risk, _ = mm.unit_quantity(equity=equity, equity_high=equity_high, atr_value=atr_v)
    if unit_qty <= 0:
        return None, None
    stop = mm.stop_price(is_long=is_long, entry_price=entry_price, atr_value=atr_v)
    pyramid: list[dict] | None = None
    if mm.config.pyramiding.enabled:
        pyramid = _pyramid_levels(
            mm=mm,
            symbol_id=symbol_id,
            is_long=is_long,
            first_entry_price=entry_price,
            atr_value=atr_v,
            units=1,
            current_price=current_price,
        )
    return _mm_dict(atr_v, risk, unit_qty, stop), pyramid


def _predict_entry(
    *,
    spec: SignalSpec,
    dates: list[str],
    closes: list[float],
    signals: list[SignalPoint],
    decision_scores: list[float | None],
    bars: list,
    from_index: int,
    trade_side_policy: TradeSidePolicy,
) -> dict:
    """フラット時の予測エントリー。表示範囲内探索 + 線形外挿。"""
    direction: str = "long"
    trigger_date: str | None = None
    trigger_price: float | None = None
    basis = ""
    note = "線形外挿による参考値です。確定予測ではありません。"

    for index in range(from_index + 1, len(dates)):
        sig = signals[index]
        if sig.buy:
            direction = "long"
            trigger_date = dates[index]
            trigger_price = closes[index]
            basis = "表示範囲内の次の買いシグナル"
            break
        if sig.sell and trade_side_policy == "longShort":
            direction = "short"
            trigger_date = dates[index]
            trigger_price = closes[index]
            basis = "表示範囲内の次の売りシグナル（ショート）"
            break

    if trigger_date is None:
        extrap = _extrapolate_entry(
            spec=spec,
            dates=dates,
            closes=closes,
            decision_scores=decision_scores,
            bars=bars,
            from_index=from_index,
            trade_side_policy=trade_side_policy,
        )
        if extrap:
            direction = extrap["direction"]
            trigger_date = extrap.get("triggerDate")
            trigger_price = extrap.get("triggerPrice")
            basis = extrap.get("basis", "線形外挿")

    predicted = {
        "triggerDate": trigger_date,
        "triggerPrice": trigger_price,
        "direction": direction,
        "basis": basis or "予測できませんでした",
        "note": note,
    }
    return {"direction": direction, "predicted": predicted}


def _extrapolate_entry(
    *,
    spec: SignalSpec,
    dates: list[str],
    closes: list[float],
    decision_scores: list[float | None],
    bars: list,
    from_index: int,
    trade_side_policy: TradeSidePolicy,
) -> dict | None:
    """直近バーの傾きからシグナル到達を外挿する。"""
    window = 5
    start = max(0, from_index - window + 1)
    if spec.strategyType == "trendScoreThreshold":
        assert spec.buyThreshold is not None
        scores = [s for s in decision_scores[start : from_index + 1] if s is not None]
        if len(scores) < 2:
            return None  # pragma: no cover
        slope = (scores[-1] - scores[0]) / (len(scores) - 1)
        current = decision_scores[from_index]
        if current is None or slope <= 0 or current >= spec.buyThreshold:
            return None  # pragma: no cover
        days = int((spec.buyThreshold - current) / slope)
        if days <= 0 or from_index + days >= len(dates):
            return None  # pragma: no cover
        target_index = from_index + days
        return {
            "direction": "long",
            "triggerDate": dates[target_index],
            "triggerPrice": closes[target_index],
            "basis": f"スコア上昇傾き（{slope:.2f}/日）で買い閾値 {spec.buyThreshold} 到達を外挿",
        }

    if spec.strategyType == "rsiThreshold":
        assert spec.lower is not None
        rsi_vals = [s for s in decision_scores[start : from_index + 1] if s is not None]
        if len(rsi_vals) < 2:
            return None  # pragma: no cover
        slope = (rsi_vals[-1] - rsi_vals[0]) / (len(rsi_vals) - 1)
        current = decision_scores[from_index]
        if current is None or slope >= 0 or current <= spec.lower:
            return None  # pragma: no cover
        days = int((spec.lower - current) / slope)
        if days <= 0 or from_index + days >= len(dates):
            return None  # pragma: no cover
        target_index = from_index + days
        return {
            "direction": "long",
            "triggerDate": dates[target_index],
            "triggerPrice": closes[target_index],
            "basis": f"RSI 下降傾きで下限 {spec.lower} 到達を外挿",
        }

    if spec.strategyType in ("smaCross", "macdCross"):
        gap_series = _signal_gap_series(spec, closes)
        recent = [s for s in gap_series[start : from_index + 1] if s is not None]
        if len(recent) < 2:
            return None  # pragma: no cover
        slope = (recent[-1] - recent[0]) / (len(recent) - 1)
        current = gap_series[from_index]
        if current is None:
            return None  # pragma: no cover
        if slope <= 0 or current >= 0:
            return None  # pragma: no cover
        days = int((0 - current) / slope)
        if days <= 0 or from_index + days >= len(dates):
            return None  # pragma: no cover
        target_index = from_index + days
        label = "SMA" if spec.strategyType == "smaCross" else "MACD"
        return {
            "direction": "long",
            "triggerDate": dates[target_index],
            "triggerPrice": closes[target_index],
            "basis": f"{label} 差分の上向きクロスを外挿",
        }

    return None  # pragma: no cover


def _signal_gap_series(spec: SignalSpec, closes: list[float]) -> list[float | None]:
    """SMA / MACD クロス用の差分系列（short - long または MACD - signal）。"""
    from app.indicators.core import macd as macd_calc
    from app.indicators.core import sma as sma_calc

    if spec.strategyType == "smaCross":
        assert spec.shortPeriod is not None and spec.longPeriod is not None
        short = sma_calc(closes, spec.shortPeriod)
        long = sma_calc(closes, spec.longPeriod)
        return [
            (s - l if s is not None and l is not None else None)
            for s, l in zip(short, long, strict=True)
        ]
    assert spec.fast is not None and spec.slow is not None and spec.signal is not None
    macd_line, signal_line, _ = macd_calc(
        closes,
        fast=spec.fast,
        slow=spec.slow,
        signal=spec.signal,
    )
    return [
        (m - s if m is not None and s is not None else None)
        for m, s in zip(macd_line, signal_line, strict=True)
    ]
