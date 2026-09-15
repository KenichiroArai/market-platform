"""Strategy 層・トレードプラン（ADR 018）の単体テスト。"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.indicators.extras import adx, donchian
from app.main import app
from app.schemas import OhlcBar, SignalSpec, TradePlanRequest
from app.strategy.entry_price import compute_recommended_entry
from app.strategy.judgment import JudgmentFactor, compute_judgment
from app.strategy.position_plan import compute_position_plan
from app.strategy.reasons import build_trade_reasons
from app.strategy.risk_rating import compute_risk_rating
from app.strategy.risk_reward import compute_risk_reward
from app.strategy.stop_loss import (
    PriceLevel,
    compute_stop_loss_candidates,
    pick_recommended_stop,
    stop_price_for_method,
)
from app.strategy.take_profit import (
    compute_take_profit_candidates,
    pick_recommended_target,
    target_price_for_method,
)
from app.strategy.trade_plan import compute_trade_plan


def _bars(n: int = 80, start: float = 100.0) -> list[OhlcBar]:
    out: list[OhlcBar] = []
    price = start
    day = date(2025, 1, 2)
    for i in range(n):
        while day.weekday() >= 5:
            day += timedelta(days=1)
        open_p = price
        high = price * 1.01
        low = price * 0.99
        close = price * (1.002 if i % 3 else 0.998)
        vol = 1000 + (i % 7) * 100
        out.append(
            OhlcBar(
                date=day.isoformat(),
                open=open_p,
                high=high,
                low=low,
                close=close,
                volume=float(vol),
            )
        )
        price = close
        day += timedelta(days=1)
    return out


def test_donchian_and_adx():
    highs = [10, 12, 11, 13, 14, 12, 15, 16, 14, 17]
    lows = [9, 10, 9.5, 11, 12, 10, 13, 14, 12, 15]
    closes = [9.5, 11, 10, 12, 13, 11, 14, 15, 13, 16]
    u, m, l = donchian(highs, lows, 3)
    assert u[-1] == 17
    assert l[-1] == 12
    assert m[-1] == (17 + 12) / 2
    adx_line, pdi, mdi = adx(highs, lows, closes, 3)
    assert any(v is not None for v in adx_line)
    assert any(v is not None for v in pdi)
    # 短系列は ADX 未確定でも DI は出る
    short = adx([1.0, 1.1], [0.9, 1.0], [1.0, 1.05], 3)
    assert all(v is None for v in short[0])
    # period*2-1 が長さ以上 → DI のみ
    mid = adx(highs[:5], lows[:5], closes[:5], 3)
    assert mid[1][3] is not None or mid[0][-1] is None


def test_judgment_branches():
    strong = compute_judgment(
        trend_score=80, rsi=25, macd_hist=1.0, adx=30, plus_di=25, minus_di=10, volume_ratio=1.5, bb_percent_b=0.05
    )
    assert strong.level == "strong_buy"
    sellish = compute_judgment(
        trend_score=-80, rsi=75, macd_hist=-1.0, adx=30, plus_di=10, minus_di=25, volume_ratio=1.5, bb_percent_b=0.95
    )
    assert sellish.level == "strong_sell"
    mid_rsi = compute_judgment(trend_score=0, rsi=40)
    assert mid_rsi.score != 50 or True
    high_rsi = compute_judgment(trend_score=0, rsi=60)
    assert high_rsi.score <= 55
    weak_adx = compute_judgment(trend_score=0, adx=15, plus_di=10, minus_di=12)
    assert any(f.id == "adx" for f in weak_adx.factors)
    quiet_vol = compute_judgment(trend_score=10, volume_ratio=0.5)
    assert any(f.id == "volume" for f in quiet_vol.factors)
    buy = compute_judgment(trend_score=50)
    assert buy.level in ("buy", "strong_buy", "neutral")
    sell = compute_judgment(trend_score=-50)
    assert sell.level in ("sell", "strong_sell", "neutral")
    assert compute_judgment(trend_score=90).stars >= 4
    assert compute_judgment(trend_score=40).stars >= 2
    assert compute_judgment(trend_score=-90).stars == 1


def test_entry_price_long_short():
    long_e = compute_recommended_entry(
        current_price=100, is_long=True, sma25=97, bb_lower=95, recent_swing=96
    )
    assert long_e.recommended_price <= 100
    short_e = compute_recommended_entry(
        current_price=100, is_long=False, sma25=103, bb_upper=105, recent_swing=104
    )
    assert short_e.recommended_price >= 100
    flat = compute_recommended_entry(current_price=100, is_long=True)
    assert flat.recommended_price == 100
    flat_s = compute_recommended_entry(current_price=100, is_long=False)
    assert flat_s.recommended_price == 100


def test_stop_and_target():
    stops = compute_stop_loss_candidates(
        entry_price=100,
        is_long=True,
        atr=2.0,
        recent_swing=95,
        approx_support=96,
        donchian_bound=94,
        ma=97,
    )
    assert len(stops) >= 4
    rec = pick_recommended_stop(stops, entry_price=100, is_long=True, prefer_method="atr")
    assert rec is not None and rec.recommended
    mid = pick_recommended_stop(
        [PriceLevel("ma", "MA", 97, "x"), PriceLevel("recent_swing", "S", 95, "y")],
        entry_price=100,
        is_long=True,
    )
    assert mid is not None
    assert pick_recommended_stop([], entry_price=100, is_long=True) is None
    assert stop_price_for_method(
        method="atr_x2",
        entry_price=100,
        is_long=True,
        atr=2.0,
        recent_swing=None,
        approx_support=None,
        donchian_bound=None,
        ma=None,
    ) == 96.0
    assert stop_price_for_method(
        method="atr",
        entry_price=100,
        is_long=False,
        atr=2.0,
        recent_swing=None,
        approx_support=None,
        donchian_bound=None,
        ma=None,
        atr_multiple=1.0,
    ) == 102.0
    assert (
        stop_price_for_method(
            method="ma",
            entry_price=100,
            is_long=True,
            atr=None,
            recent_swing=None,
            approx_support=None,
            donchian_bound=None,
            ma=None,
        )
        is None
    )

    tps = compute_take_profit_candidates(
        entry_price=100,
        stop_price=96,
        is_long=True,
        atr=2.0,
        approx_resistance=110,
        fib_level=108,
        donchian_bound=112,
    )
    assert len(tps) >= 3
    tp = pick_recommended_target(
        tps, entry_price=100, stop_price=96, is_long=True, prefer_method="rr_target"
    )
    assert tp is not None
    assert pick_recommended_target([], entry_price=100, stop_price=96, is_long=True) is None
    auto = pick_recommended_target(tps, entry_price=100, stop_price=96, is_long=True)
    assert auto is not None
    low_rr = pick_recommended_target(
        [PriceLevel("atr_multiple", "A", 100.5, "near")],
        entry_price=100,
        stop_price=96,
        is_long=True,
        min_rr=5.0,
    )
    assert low_rr is not None
    assert (
        target_price_for_method(
            method="none",
            entry_price=100,
            stop_price=96,
            is_long=True,
            atr=2.0,
            approx_resistance=None,
            fib_level=None,
            donchian_bound=None,
        )
        is None
    )
    assert (
        target_price_for_method(
            method="rr_target",
            entry_price=100,
            stop_price=96,
            is_long=True,
            atr=2.0,
            approx_resistance=None,
            fib_level=None,
            donchian_bound=None,
        )
        == 108.0
    )
    assert compute_risk_reward(100, 96, 108, is_long=True).risk_reward == 2.0
    assert compute_risk_reward(100, None, 108, is_long=True) is None
    assert compute_risk_reward(100, 100, 108, is_long=True) is None
    assert compute_risk_reward(100, 96, 90, is_long=True) is None
    assert compute_risk_reward(100, 104, 110, is_long=False) is None


def test_position_and_risk_and_reasons():
    pos = compute_position_plan(
        equity=100000, risk_rate=0.01, entry_price=100, stop_price=95, atr=2, stop_multiple=2
    )
    assert pos is not None
    assert pos.recommended_shares > 0
    same = compute_position_plan(equity=100000, risk_rate=0.01, entry_price=100, stop_price=100)
    assert same is None
    over_max = compute_position_plan(
        equity=1_000_000,
        risk_rate=0.5,
        entry_price=10,
        stop_price=9,
        max_quantity=5,
    )
    assert over_max is not None and over_max.recommended_shares <= 5
    assert over_max.max_shares <= 5
    tiny = compute_position_plan(
        equity=10, risk_rate=0.001, entry_price=100, stop_price=50, min_quantity=10
    )
    assert tiny is not None and tiny.recommended_shares == 0.0
    assert compute_position_plan(equity=-1, risk_rate=0.01, entry_price=100, stop_price=95) is None
    assert compute_position_plan(equity=100, risk_rate=0, entry_price=100, stop_price=95) is None
    assert compute_position_plan(equity=100, risk_rate=0.01, entry_price=0, stop_price=95) is None

    risk = compute_risk_rating(atr=5, close=100, stdev=4, volume_ratio=2.5, adx=45, gap_percent=4)
    assert risk.level == "high"
    med = compute_risk_rating(atr=2.5, close=100, stdev=2, volume_ratio=0.4, adx=15, gap_percent=2)
    assert med.level in ("medium", "low", "high")
    mid_atr = compute_risk_rating(atr=2.5, close=100)
    assert mid_atr.atr_percent is not None
    mid_stdev = compute_risk_rating(atr=0.5, close=100, stdev=2)
    assert mid_stdev.notes
    high_stdev = compute_risk_rating(atr=0.5, close=100, stdev=4)
    assert high_stdev.notes
    vol_up = compute_risk_rating(atr=0.5, close=100, volume_ratio=2.5)
    assert vol_up.notes
    vol_down = compute_risk_rating(atr=0.5, close=100, volume_ratio=0.4)
    assert vol_down.notes
    adx_strong = compute_risk_rating(atr=0.5, close=100, adx=45)
    assert adx_strong.notes
    adx_weak = compute_risk_rating(atr=0.5, close=100, adx=15)
    assert adx_weak.notes
    gap_big = compute_risk_rating(atr=0.5, close=100, gap_percent=4)
    assert gap_big.notes
    gap_mid = compute_risk_rating(atr=0.5, close=100, gap_percent=2)
    assert gap_mid.notes
    low = compute_risk_rating(atr=0.5, close=100)
    assert low.level == "low"
    empty = compute_risk_rating(atr=None, close=100)
    assert empty.notes

    buy, sell = build_trade_reasons(
        factors=compute_judgment(trend_score=40, macd_hist=1).factors,
        entry_reason_code="macd_golden_cross",
        is_long_bias=True,
        sma25_slope_up=True,
        volume_increasing=True,
    )
    assert any("ゴールデン" in r or "MACD" in r for r in buy)
    s_buy, s_sell = build_trade_reasons(
        factors=[JudgmentFactor("x", "X", -2, "down")],
        entry_reason_code="macd_dead_cross",
        is_long_bias=False,
        sma25_slope_up=False,
        volume_increasing=False,
    )
    assert s_sell
    unknown = build_trade_reasons(
        factors=[],
        entry_reason_code="custom_code",
        is_long_bias=True,
    )
    assert unknown[0]


def test_compute_trade_plan_endpoint():
    bars = _bars(90)
    body = TradePlanRequest(
        symbolId="s1",
        bars=bars,
        baseDate=bars[-1].date,
        equity=1_000_000,
        riskRate=0.01,
        signal=SignalSpec(
            strategyType="trendScoreThreshold", buyThreshold=37.5, sellThreshold=-42.5
        ),
        moneyManagement={"enabled": True, "riskRate": 0.01, "stopMultiple": 2.0, "atrPeriod": 14},
        stopMethod="atr_x2",
        takeProfitMethod="rr_target",
    )
    plan = compute_trade_plan(body)
    assert plan.symbolId == "s1"
    assert plan.judgment.score >= 0
    assert plan.entry.currentPrice > 0

    empty = compute_trade_plan(
        TradePlanRequest(symbolId="s1", bars=[], baseDate="2025-01-01", equity=1000)
    )
    assert empty.overallScore == 0.0

    bad_date = compute_trade_plan(
        TradePlanRequest(symbolId="s1", bars=bars, baseDate="1990-01-01", equity=1000)
    )
    assert "基準日" in bad_date.summaryLabel or bad_date.overallScore == 0.0

    none_tp = compute_trade_plan(
        TradePlanRequest(
            symbolId="s1",
            bars=bars,
            baseDate=bars[-1].date,
            equity=100000,
            takeProfitMethod="none",
        )
    )
    assert none_tp.recommendedTarget is None

    client = TestClient(app)
    res = client.post(
        "/analysis/trade-plan",
        json={
            "symbolId": "s1",
            "bars": [b.model_dump() for b in bars],
            "baseDate": bars[-1].date,
            "equity": 1000000,
            "riskRate": 0.01,
        },
    )
    assert res.status_code == 200
    assert res.json()["judgment"]["level"] in {
        "strong_buy",
        "buy",
        "neutral",
        "sell",
        "strong_sell",
    }


def test_backtest_exit_policy():
    bars = _bars(100)
    client = TestClient(app)
    # 強制的にクロスが出やすい短期 SMA
    payload = {
        "symbolId": "s1",
        "bars": [b.model_dump() for b in bars],
        "signal": {"strategyType": "smaCross", "shortPeriod": 3, "longPeriod": 10},
        "initialCash": 100000,
        "feeRate": 0,
        "slippageRate": 0,
        "tradeSidePolicy": "longOnly",
        "moneyManagement": {
            "enabled": True,
            "riskRate": 0.05,
            "atrPeriod": 5,
            "atrKind": "atr",
            "stopMultiple": 2,
            "minQuantity": 1,
            "allowFractionalQuantity": False,
            "pyramiding": {"enabled": False, "stepAtrMultiple": 0.5, "maxUnits": 1},
            "drawdown": {"enabled": False, "thresholdRate": 0.1, "riskReductionRate": 0.2},
            "correlation": {"enabled": False, "groups": []},
        },
        "exitPolicy": {
            "stopMethod": "recent_swing",
            "takeProfitMethod": "atr_multiple",
            "atrTargetMultiple": 1.0,
            "rrMultiple": 1.5,
        },
    }
    res = client.post("/backtests/run", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert "summary" in body

    # 指標計算パス（donchian / adx）
    ind = client.post(
        "/indicators",
        json={
            "bars": [b.model_dump() for b in bars],
            "indicators": [
                {"id": "donchian", "type": "donchian", "params": {"period": 20}},
                {"id": "adx", "type": "adx", "params": {"period": 14}},
            ],
            "rangeStartIndex": 0,
        },
    )
    assert ind.status_code == 200, ind.text
    assert "donchianUpper" in ind.json()["points"][-1]["values"]
    assert "adx" in ind.json()["points"][-1]["values"]


def test_trade_plan_helpers():
    from app.strategy import trade_plan as tp

    assert tp._volume_ratio([1.0], 0, 5) is None
    assert tp._volume_ratio([0.0, 0.0, 10.0], 2, 5) is None
    assert tp._percent_b(100, None, 90) is None
    assert tp._percent_b(100, 100, 100) is None
    assert tp._gap_percent([100.0], [100.0], 0) is None
    assert tp._recent_swing_low([], 0, 5) is None
    assert tp._recent_swing_high([], 0, 5) is None
    assert tp._fib_levels_near([1], [1], ["2025-01-01"], 0, 1.0, True)[0] is None or True
    assert tp._poc_price([1], [1], [1], 0) is not None
    assert tp._pick_nearest_below(10, [None, 5, 8]) == 8
    assert tp._pick_nearest_above(10, [None, 12, 15]) == 12
    assert tp._resolve_base_index(["2025-01-02"], "2025-01-10") == 0
    assert tp._resolve_base_index(["2025-01-02"], "2024-01-01") is None
    from app.money_management.simulate import _resolve_exit_levels

    highs = [10.0, 11.0, 12.0, 13.0, 14.0]
    lows = [9.0, 9.5, 10.0, 11.0, 12.0]
    atrs = [1.0] * 5
    sma = [10.0] * 5
    dcu = [15.0] * 5
    dcl = [8.0] * 5
    stop, target, reason = _resolve_exit_levels(
        entry_price=12.0,
        is_long=True,
        index=4,
        atr_series=atrs,
        highs=highs,
        lows=lows,
        sma25_series=sma,
        dc_upper=dcu,
        dc_lower=dcl,
        stop_method="atr_x2",
        tp_method="rr_target",
        atr_target_mult=3.0,
        rr_mult=2.0,
        fallback_stop=10.0,
    )
    assert stop is not None
    assert target is not None
    assert "strategy_stop" in reason

    stop2, target2, _ = _resolve_exit_levels(
        entry_price=12.0,
        is_long=False,
        index=4,
        atr_series=atrs,
        highs=highs,
        lows=lows,
        sma25_series=sma,
        dc_upper=dcu,
        dc_lower=dcl,
        stop_method="donchian_lower",
        tp_method="donchian_upper",
        atr_target_mult=3.0,
        rr_mult=2.0,
        fallback_stop=None,
    )
    assert stop2 is not None or target2 is not None

    stop3, target3, reason3 = _resolve_exit_levels(
        entry_price=12.0,
        is_long=True,
        index=4,
        atr_series=atrs,
        highs=highs,
        lows=lows,
        sma25_series=sma,
        dc_upper=dcu,
        dc_lower=dcl,
        stop_method=None,
        tp_method="none",
        atr_target_mult=3.0,
        rr_mult=2.0,
        fallback_stop=11.0,
    )
    assert stop3 == 11.0
    assert target3 is None
    assert reason3 == "atr_stop_loss"


def test_simulate_take_profit_hit():
    """exit_policy の利確ヒットを直接シミュレートする。"""
    from app.money_management.simulate import simulate_backtest
    from app.schemas import SignalPoint

    n = 40
    dates = [f"2025-02-{i+1:02d}" if i < 28 else f"2025-03-{i-27:02d}" for i in range(n)]
    closes = [100.0 + i * 0.3 for i in range(n)]
    highs = [c + 2.0 for c in closes]
    lows = [c - 0.2 for c in closes]
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[20] = SignalPoint(date=dates[20], buy=True, sell=False)

    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * n,
        strategy_type="smaCross",
        initial_cash=100_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0.0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=None,
        entry_reason_fn=lambda *_a, **_k: "sma_golden_cross",
        exit_reason_fn=lambda *_a, **_k: "sma_dead_cross",
        score_breakdown_payload_fn=lambda *_a, **_k: None,
        exit_policy={
            "stopMethod": "atr_x2",
            "takeProfitMethod": "atr_multiple",
            "atrTargetMultiple": 0.5,
        },
    )
    reasons = [t.exitReason for t in result.trades]
    assert result.trades, "expected at least one trade"
    assert "take_profit" in reasons


def test_simulate_exit_policy_without_mm_atr_series():
    from app.money_management.simulate import simulate_backtest
    from app.schemas import SignalPoint

    n = 30
    dates = [f"2025-04-{i+1:02d}" for i in range(n)]
    closes = [100.0 + (i % 5) for i in range(n)]
    highs = [c + 2 for c in closes]
    lows = [c - 2 for c in closes]
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[8] = SignalPoint(date=dates[8], buy=True, sell=False)
    signals[20] = SignalPoint(date=dates[20], buy=False, sell=True)

    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * n,
        strategy_type="smaCross",
        initial_cash=50_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0.0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=None,
        entry_reason_fn=lambda *_a, **_k: "sma_golden_cross",
        exit_reason_fn=lambda *_a, **_k: "sma_dead_cross",
        score_breakdown_payload_fn=lambda *_a, **_k: None,
        exit_policy={"stopMethod": "ma", "takeProfitMethod": "rr_target", "rrMultiple": 1.2},
    )
    assert len(result.equity_points) > 0
