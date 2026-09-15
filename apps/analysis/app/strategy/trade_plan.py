"""トレードプラン Facade（ADR 018）。"""

from __future__ import annotations

from typing import Any

from app.indicators.core import macd, rsi, sma
from app.indicators.extras import adx, atr, bollinger, donchian, fibonacci_levels, stdev, volume_profile
from app.indicators.trend_score import compute_trend_score
from app.money_management.types import money_management_from_dict
from app.schemas import (
    OhlcBar,
    TradePlanEntryModel,
    TradePlanJudgmentFactorModel,
    TradePlanJudgmentModel,
    TradePlanPositionModel,
    TradePlanPriceLevelModel,
    TradePlanRequest,
    TradePlanResponse,
    TradePlanRiskRatingModel,
    TradePlanRiskRewardModel,
)
from app.strategy.entry_price import compute_recommended_entry
from app.strategy.judgment import compute_judgment
from app.strategy.position_plan import compute_position_plan
from app.strategy.reasons import build_trade_reasons
from app.strategy.risk_rating import compute_risk_rating
from app.strategy.risk_reward import compute_risk_reward
from app.strategy.stop_loss import compute_stop_loss_candidates, pick_recommended_stop
from app.strategy.take_profit import compute_take_profit_candidates, pick_recommended_target


def compute_trade_plan(body: TradePlanRequest) -> TradePlanResponse:
    """基準日時点のトレードプランを組み立てる。"""
    bars = body.bars
    if not bars:
        return _empty(body.symbolId, body.baseDate, "価格データがありません")

    dates = [b.date for b in bars]
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    closes = [b.close for b in bars]
    volumes = [b.volume for b in bars]

    base_index = _resolve_base_index(dates, body.baseDate)
    if base_index is None:
        return _empty(body.symbolId, body.baseDate, "基準日が範囲外です")

    resolved_base = dates[base_index]
    close = closes[base_index]

    # --- 指標系列 ---
    atr_series = atr(highs, lows, closes, 14)
    sma25 = sma(closes, 25)
    rsi_series = rsi(closes, 14)
    macd_line, _sig, macd_hist = macd(closes, fast=12, slow=26, signal=9)
    bb_u, _bb_m, bb_l = bollinger(closes, 20, 2.0)
    dc_u, _dc_m, dc_l = donchian(highs, lows, 20)
    adx_line, plus_di, minus_di = adx(highs, lows, closes, 14)
    stdev_series = stdev(closes, 20)

    atr_v = atr_series[base_index]
    sma_v = sma25[base_index]
    rsi_v = rsi_series[base_index]
    hist_v = macd_hist[base_index]
    adx_v = adx_line[base_index]
    pdi_v = plus_di[base_index]
    mdi_v = minus_di[base_index]
    bb_upper = bb_u[base_index]
    bb_lower = bb_l[base_index]
    dc_upper = dc_u[base_index]
    dc_lower = dc_l[base_index]
    stdev_v = stdev_series[base_index]

    # トレンドスコア
    score_points = compute_trend_score(
        bars,
        range_start_index=0,
        group_weights=body.groupWeights,
        indicator_params=body.indicatorParams,
    )
    trend_score = None
    if base_index < len(score_points):
        trend_score = score_points[base_index].score

    vol_ratio = _volume_ratio(volumes, base_index, 20)
    bb_pct = _percent_b(close, bb_upper, bb_lower)
    gap_pct = _gap_percent(closes, opens=[b.open for b in bars], index=base_index)

    judgment = compute_judgment(
        trend_score=trend_score,
        rsi=rsi_v,
        macd_hist=hist_v,
        adx=adx_v,
        plus_di=pdi_v,
        minus_di=mdi_v,
        volume_ratio=vol_ratio,
        bb_percent_b=bb_pct,
    )

    is_long = judgment.level not in ("sell", "strong_sell")

    recent_low = _recent_swing_low(lows, base_index, 10)
    recent_high = _recent_swing_high(highs, base_index, 10)
    recent_swing = recent_low if is_long else recent_high

    fib_support, fib_resist = _fib_levels_near(highs, lows, dates, base_index, close, is_long)
    poc = _poc_price(highs, lows, volumes, base_index)
    approx_support = _pick_nearest_below(close, [recent_low, fib_support, poc])
    approx_resist = _pick_nearest_above(close, [recent_high, fib_resist, poc])

    entry = compute_recommended_entry(
        current_price=close,
        is_long=is_long,
        sma25=sma_v,
        bb_lower=bb_lower,
        bb_upper=bb_upper,
        recent_swing=recent_swing,
    )
    entry_px = entry.recommended_price

    mm_cfg = money_management_from_dict(body.moneyManagement)
    atr_mult = float(mm_cfg.stopMultiple) if mm_cfg else 1.0
    risk_rate = body.riskRate
    if mm_cfg and mm_cfg.enabled:
        risk_rate = float(mm_cfg.riskRate)

    stop_candidates = compute_stop_loss_candidates(
        entry_price=entry_px,
        is_long=is_long,
        atr=atr_v,
        recent_swing=recent_swing,
        approx_support=approx_support if is_long else approx_resist,
        donchian_bound=dc_lower if is_long else dc_upper,
        ma=sma_v,
        atr_multiple=atr_mult,
    )
    preferred_stop = body.stopMethod
    recommended_stop = pick_recommended_stop(
        stop_candidates,
        entry_price=entry_px,
        is_long=is_long,
        prefer_method=preferred_stop,  # type: ignore[arg-type]
    )
    # 候補に recommended を反映
    stop_models = [
        _level_model(
            c
            if recommended_stop is None or c.method != recommended_stop.method
            else recommended_stop
        )
        for c in stop_candidates
    ]
    if recommended_stop and not any(
        c.method == recommended_stop.method for c in stop_candidates
    ):  # pragma: no cover — pick は候補内から選ぶ
        stop_models.append(_level_model(recommended_stop))

    stop_price = recommended_stop.price if recommended_stop else None

    tp_candidates = compute_take_profit_candidates(
        entry_price=entry_px,
        stop_price=stop_price,
        is_long=is_long,
        atr=atr_v,
        approx_resistance=approx_resist if is_long else approx_support,
        fib_level=fib_resist if is_long else fib_support,
        donchian_bound=dc_upper if is_long else dc_lower,
    )
    preferred_tp = body.takeProfitMethod
    recommended_tp = None
    if preferred_tp != "none":
        recommended_tp = pick_recommended_target(
            tp_candidates,
            entry_price=entry_px,
            stop_price=stop_price,
            is_long=is_long,
            prefer_method=preferred_tp,  # type: ignore[arg-type]
        )
    tp_models = [
        _level_model(
            c if recommended_tp is None or c.method != recommended_tp.method else recommended_tp
        )
        for c in tp_candidates
    ]

    target_price = recommended_tp.price if recommended_tp else None
    rr = compute_risk_reward(entry_px, stop_price, target_price, is_long=is_long)

    position = None
    if stop_price is not None:
        position = compute_position_plan(
            equity=body.equity,
            risk_rate=risk_rate,
            entry_price=entry_px,
            stop_price=stop_price,
            atr=atr_v,
            stop_multiple=atr_mult if mm_cfg else None,
        )

    risk = compute_risk_rating(
        atr=atr_v,
        close=close,
        stdev=stdev_v,
        volume_ratio=vol_ratio,
        adx=adx_v,
        gap_percent=gap_pct,
    )

    sma_slope = None
    if base_index >= 1 and sma25[base_index] is not None and sma25[base_index - 1] is not None:
        sma_slope = sma25[base_index] > sma25[base_index - 1]
    vol_inc = None
    if vol_ratio is not None:
        vol_inc = vol_ratio >= 1.05

    entry_reason = None
    if body.signal is not None:
        from app.main import _entry_reason_code, _signals_and_scores

        signals, _scores, _bd = _signals_and_scores(
            dates,
            closes,
            body.signal,
            bars=bars,
            group_weights=body.groupWeights,
            indicator_params=body.indicatorParams,
        )
        sig = signals[base_index]
        if sig.buy or sig.sell:  # pragma: no cover — 基準日にシグナルがある場合
            entry_reason = _entry_reason_code(body.signal.strategyType, sig)

    buy_reasons, sell_reasons = build_trade_reasons(
        factors=judgment.factors,
        entry_reason_code=entry_reason,
        is_long_bias=is_long,
        sma25_slope_up=sma_slope,
        volume_increasing=vol_inc,
    )

    overall = round(
        judgment.score * 0.7
        + (20.0 if rr and rr.risk_reward >= 2 else 10.0 if rr else 0.0)
        + (10.0 if risk.level == "low" else 5.0 if risk.level == "medium" else 0.0),
        1,
    )
    overall = max(0.0, min(100.0, overall))

    return TradePlanResponse(
        symbolId=body.symbolId,
        baseDate=resolved_base,
        judgment=TradePlanJudgmentModel(
            level=judgment.level,  # type: ignore[arg-type]
            score=judgment.score,
            stars=judgment.stars,
            label=judgment.label,
            factors=[
                TradePlanJudgmentFactorModel(
                    id=f.id, label=f.label, contribution=f.contribution, note=f.note
                )
                for f in judgment.factors
            ],
        ),
        entry=TradePlanEntryModel(
            currentPrice=entry.current_price,
            recommendedPrice=entry.recommended_price,
            side=entry.side,  # type: ignore[arg-type]
            rationale=entry.rationale,
        ),
        stopLossCandidates=stop_models,
        takeProfitCandidates=tp_models,
        recommendedStop=_level_model(recommended_stop) if recommended_stop else None,
        recommendedTarget=_level_model(recommended_tp) if recommended_tp else None,
        riskReward=(
            TradePlanRiskRewardModel(
                entry=rr.entry,
                stop=rr.stop,
                target=rr.target,
                riskReward=rr.risk_reward,
            )
            if rr
            else None
        ),
        position=(
            TradePlanPositionModel(
                recommendedShares=position.recommended_shares,
                maxShares=position.max_shares,
                requiredCapital=position.required_capital,
                maxLoss=position.max_loss,
                equity=position.equity,
                riskRate=position.risk_rate,
            )
            if position
            else None
        ),
        riskRating=TradePlanRiskRatingModel(
            level=risk.level,  # type: ignore[arg-type]
            stars=risk.stars,
            atrPercent=risk.atr_percent,
            notes=risk.notes,
        ),
        buyReasons=buy_reasons,
        sellReasons=sell_reasons,
        overallScore=overall,
        summaryLabel=f"{judgment.label} / 総合 {overall:.0f} 点",
    )


def _level_model(level: Any) -> TradePlanPriceLevelModel:
    return TradePlanPriceLevelModel(
        method=level.method,
        label=level.label,
        price=level.price,
        rationale=level.rationale,
        recommended=bool(getattr(level, "recommended", False)),
    )


def _empty(symbol_id: str, base_date: str, reason: str) -> TradePlanResponse:
    return TradePlanResponse(
        symbolId=symbol_id,
        baseDate=base_date,
        judgment=TradePlanJudgmentModel(
            level="neutral",
            score=50.0,
            stars=3,
            label="中立",
            factors=[
                TradePlanJudgmentFactorModel(
                    id="error", label="データ", contribution=0.0, note=reason
                )
            ],
        ),
        entry=TradePlanEntryModel(
            currentPrice=0.0,
            recommendedPrice=0.0,
            side="long",
            rationale=reason,
        ),
        stopLossCandidates=[],
        takeProfitCandidates=[],
        recommendedStop=None,
        recommendedTarget=None,
        riskReward=None,
        position=None,
        riskRating=TradePlanRiskRatingModel(level="medium", stars=3, atrPercent=None, notes=[reason]),
        buyReasons=[],
        sellReasons=[],
        overallScore=0.0,
        summaryLabel=reason,
    )


def _resolve_base_index(dates: list[str], base_date: str) -> int | None:
    if base_date in dates:
        return dates.index(base_date)
    # 直近以前の最終日
    for i in range(len(dates) - 1, -1, -1):
        if dates[i] <= base_date:
            return i
    return None


def _volume_ratio(volumes: list[float], index: int, window: int) -> float | None:
    if index < 1:
        return None
    start = max(0, index - window)
    hist = volumes[start:index]
    if not hist:  # pragma: no cover
        return None
    avg = sum(hist) / len(hist)
    if avg <= 0:
        return None
    return volumes[index] / avg


def _percent_b(close: float, upper: float | None, lower: float | None) -> float | None:
    if upper is None or lower is None:
        return None
    width = upper - lower
    if width <= 0:
        return None
    return (close - lower) / width


def _gap_percent(closes: list[float], opens: list[float], index: int) -> float | None:
    if index < 1 or closes[index - 1] <= 0:
        return None
    return 100.0 * (opens[index] - closes[index - 1]) / closes[index - 1]


def _recent_swing_low(lows: list[float], index: int, lookback: int) -> float | None:
    start = max(0, index - lookback + 1)
    window = lows[start : index + 1]
    return min(window) if window else None


def _recent_swing_high(highs: list[float], index: int, lookback: int) -> float | None:
    start = max(0, index - lookback + 1)
    window = highs[start : index + 1]
    return max(window) if window else None


def _fib_levels_near(
    highs: list[float],
    lows: list[float],
    dates: list[str],
    index: int,
    close: float,
    is_long: bool,
) -> tuple[float | None, float | None]:
    raw = fibonacci_levels(highs, lows, dates, 0)
    if raw is None:  # pragma: no cover — 空系列以外では稀
        return None, None
    levels = [float(lv["price"]) for lv in raw.get("levels", []) if "price" in lv]
    below = [p for p in levels if p < close]
    above = [p for p in levels if p > close]
    support = max(below) if below else None
    resist = min(above) if above else None
    return support, resist


def _poc_price(
    highs: list[float], lows: list[float], volumes: list[float], index: int
) -> float | None:
    raw = volume_profile(highs[: index + 1], lows[: index + 1], volumes[: index + 1], 0, 24)
    if raw is None:  # pragma: no cover
        return None
    bins = raw.get("bins") or []
    if not bins:  # pragma: no cover
        return None
    best = max(bins, key=lambda b: float(b.get("volume", 0)))
    low = float(best.get("priceLow", 0))
    high = float(best.get("priceHigh", 0))
    return (low + high) / 2.0


def _pick_nearest_below(price: float, candidates: list[float | None]) -> float | None:
    vals = [c for c in candidates if c is not None and c < price]
    return max(vals) if vals else None


def _pick_nearest_above(price: float, candidates: list[float | None]) -> float | None:
    vals = [c for c in candidates if c is not None and c > price]
    return min(vals) if vals else None
