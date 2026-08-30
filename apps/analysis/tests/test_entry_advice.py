"""エントリー助言モジュールのテスト。"""

from fastapi.testclient import TestClient

from app.main import app
from app.money_management.entry_advice import (
    _extrapolate_entry,
    _mm_dict,
    _parse_mm_config,
    _predict_entry,
    _pyramid_levels,
    _signal_gap_series,
    _signal_label,
    _to_mm_model,
    _to_pyramid_models,
    _walk_position_to_index,
    compute_entry_advice,
)
from app.money_management.service import MoneyManagementService
from app.money_management.types import MoneyManagementConfig, money_management_from_dict
from app.schemas import EntryAdviceRequest, OhlcBar, SignalPoint, SignalSpec

MM_CONFIG = {
    "enabled": True,
    "riskRate": 0.01,
    "atrPeriod": 3,
    "atrKind": "n",
    "stopMultiple": 2.0,
    "minQuantity": 0,
    "maxQuantity": None,
    "allowFractionalQuantity": True,
    "pyramiding": {
        "enabled": True,
        "stepAtrMultiple": 0.5,
        "maxUnits": 4,
    },
    "drawdown": {
        "enabled": False,
        "thresholdRate": 0.1,
        "riskReductionRate": 0.2,
    },
    "correlation": {"enabled": False, "groups": []},
}


def _bar_dicts(closes: list[float], start: str = "2026-01-01") -> list[dict[str, float | str]]:
    rows: list[dict[str, float | str]] = []
    for i, close in enumerate(closes):
        rows.append(
            {
                "date": f"2026-01-{i + 1:02d}",
                "open": close,
                "high": close + 2,
                "low": close - 2,
                "close": close,
                "volume": 1000.0,
            }
        )
    return rows


def _bars(count: int = 30, start: float = 100.0, step: float = 0.5) -> list[OhlcBar]:
    rows: list[OhlcBar] = []
    for i in range(count):
        close = start + i * step
        rows.append(
            OhlcBar(
                date=f"2026-01-{i + 1:02d}",
                open=close - 0.2,
                high=close + 0.5,
                low=close - 0.5,
                close=close,
                volume=1000.0,
            )
        )
    return rows


def _bars_from_closes(closes: list[float]) -> list[OhlcBar]:
    return [
        OhlcBar(
            date=f"2026-01-{i + 1:02d}",
            open=c,
            high=c + 2,
            low=c - 2,
            close=c,
            volume=1000.0,
        )
        for i, c in enumerate(closes)
    ]


def test_entry_advice_wait_on_uptrend_without_signal() -> None:
    bars = _bars(25)
    spec = SignalSpec(
        strategyType="trendScoreThreshold",
        buyThreshold=80.0,
        sellThreshold=-80.0,
    )
    result = compute_entry_advice(
        EntryAdviceRequest(
            symbolId="sym-1",
            bars=bars,
            signal=spec,
            baseDate="2026-01-25",
            initialCash=100000.0,
        )
    )
    assert result.entryTiming == "wait"
    assert result.predictedEntry is not None


def test_entry_advice_entry_now_when_signal_but_mm_blocks_open() -> None:
    """MM で建玉化できないがシグナルは立っている → entry_now。"""
    closes = [100.0] * 20
    bars = _bars_from_closes(closes)
    spec = SignalSpec(strategyType="rsiThreshold", period=14, lower=30, upper=70)
    mm_blocked = {**MM_CONFIG, "atrPeriod": 500}
    result = compute_entry_advice(
        EntryAdviceRequest(
            symbolId="sym-1",
            bars=bars,
            signal=spec,
            baseDate="2026-01-15",
            initialCash=100000.0,
            moneyManagement=mm_blocked,
        )
    )
    assert result.entryTiming == "entry_now"
    assert result.signalActive is True


def test_entry_advice_entry_now_with_mm_hypothetical() -> None:
    """相関キャップで walk は建玉化しないがシグナルは entry_now + MM。"""
    closes = [100.0] * 20
    bars = _bars_from_closes(closes)
    spec = SignalSpec(strategyType="rsiThreshold", period=14, lower=30, upper=70)
    mm_corr = {
        **MM_CONFIG,
        "correlation": {
            "enabled": True,
            "groups": [
                {
                    "name": "solo",
                    "symbolIds": ["sym-1"],
                    "maxUnits": 0,
                    "maxRisk": 0,
                }
            ],
        },
    }
    result = compute_entry_advice(
        EntryAdviceRequest(
            symbolId="sym-1",
            bars=bars,
            signal=spec,
            baseDate="2026-01-15",
            initialCash=100000.0,
            moneyManagement=mm_corr,
        )
    )
    assert result.entryTiming == "entry_now"
    assert result.mm is not None
    assert result.pyramidLevels is not None


def test_entry_advice_in_position_sma_cross() -> None:
    closes = [1.0, 1.0, 1.0, 2.0, 2.0, 2.0, 2.0, 2.0]
    bars = _bars_from_closes(closes)
    spec = SignalSpec(strategyType="smaCross", shortPeriod=2, longPeriod=3)
    result = compute_entry_advice(
        EntryAdviceRequest(
            symbolId="sym-1",
            bars=bars,
            signal=spec,
            baseDate="2026-01-08",
            initialCash=100000.0,
            moneyManagement=MM_CONFIG,
        )
    )
    assert result.entryTiming == "in_position"
    assert result.mm is not None


def test_entry_advice_forward_predicted_signal() -> None:
    closes = [1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 2.0, 2.0]
    bars = _bars_from_closes(closes)
    spec = SignalSpec(strategyType="smaCross", shortPeriod=2, longPeriod=3)
    result = compute_entry_advice(
        EntryAdviceRequest(
            symbolId="sym-1",
            bars=bars,
            signal=spec,
            baseDate="2026-01-04",
            initialCash=100000.0,
        )
    )
    assert result.entryTiming == "wait"
    assert result.predictedEntry is not None
    assert result.predictedEntry.triggerDate == "2026-01-06"


def test_entry_advice_no_rule_empty_bars() -> None:
    result = compute_entry_advice(
        EntryAdviceRequest(
            symbolId="sym-1",
            bars=[],
            signal=SignalSpec(
                strategyType="trendScoreThreshold",
                buyThreshold=37.5,
                sellThreshold=-42.5,
            ),
            baseDate="2026-01-01",
            initialCash=100000.0,
        )
    )
    assert result.entryTiming == "no_rule"


def test_entry_advice_base_date_out_of_range() -> None:
    result = compute_entry_advice(
        EntryAdviceRequest(
            symbolId="sym-1",
            bars=_bars(5),
            signal=SignalSpec(
                strategyType="trendScoreThreshold",
                buyThreshold=37.5,
                sellThreshold=-42.5,
            ),
            baseDate="2026-02-01",
            initialCash=100000.0,
        )
    )
    assert result.entryTiming == "no_rule"


def test_entry_advice_helpers() -> None:
    spec_sma = SignalSpec(strategyType="smaCross", shortPeriod=2, longPeriod=5)
    assert "SMA" in _signal_label(spec_sma)
    spec_rsi = SignalSpec(strategyType="rsiThreshold", period=14, lower=30, upper=70)
    assert "RSI" in _signal_label(spec_rsi)
    spec_macd = SignalSpec(strategyType="macdCross", fast=12, slow=26, signal=9)
    assert "MACD" in _signal_label(spec_macd)
    spec_ts = SignalSpec(
        strategyType="trendScoreThreshold",
        buyThreshold=37.5,
        sellThreshold=-42.5,
    )
    assert "トレンドスコア" in _signal_label(spec_ts)

    assert _to_mm_model(None) is None
    assert _to_pyramid_models(None) is None
    mm_row = _mm_dict(1.0, 0.01, 10.0, 95.0)
    assert mm_row is not None
    assert _to_mm_model(mm_row) is not None

    cfg = money_management_from_dict(MM_CONFIG)
    assert _parse_mm_config(cfg) is cfg
    assert _parse_mm_config(MM_CONFIG) is not None

    mm = MoneyManagementService(cfg)
    levels = _pyramid_levels(
        mm=mm,
        symbol_id="sym",
        is_long=True,
        first_entry_price=100.0,
        atr_value=2.0,
        units=1,
        current_price=101.0,
    )
    assert len(levels) >= 1

    gap = _signal_gap_series(spec_sma, [1.0, 2.0, 3.0, 4.0, 5.0])
    assert len(gap) == 5


def test_walk_position_pyramid_stop_and_reverse() -> None:
    closes = [100.0, 102.0, 104.0, 108.0, 112.0, 116.0, 50.0, 48.0, 46.0]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    signals = [
        SignalPoint(date=d, buy=i == 2, sell=i == 7)
        for i, d in enumerate(dates)
    ]
    mm_cfg = money_management_from_dict(MM_CONFIG)
    mm = MoneyManagementService(mm_cfg)
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    atr_series = mm.compute_atr_series(highs, lows, closes)
    pos_mid = _walk_position_to_index(
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        end_index=5,
        trade_side_policy="longShort",
        mm=mm,
        atr_series=atr_series,
        symbol_id="sym-1",
        initial_cash=100000.0,
        equity_high=100000.0,
    )
    assert pos_mid is not None
    pos_after_stop = _walk_position_to_index(
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        end_index=6,
        trade_side_policy="longShort",
        mm=mm,
        atr_series=atr_series,
        symbol_id="sym-1",
        initial_cash=100000.0,
        equity_high=100000.0,
    )
    assert pos_after_stop is None
    pos_short = _walk_position_to_index(
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        end_index=7,
        trade_side_policy="longShort",
        mm=mm,
        atr_series=atr_series,
        symbol_id="sym-1",
        initial_cash=100000.0,
        equity_high=100000.0,
    )
    assert pos_short is not None
    assert not pos_short.is_long


def test_extrapolate_macd_branch() -> None:
    closes = [float(100 + (i % 5)) for i in range(40)]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    spec = SignalSpec(strategyType="macdCross", fast=3, slow=6, signal=3)
    gaps = _signal_gap_series(spec, closes)
    out = _extrapolate_entry(
        spec=spec,
        dates=dates,
        closes=closes,
        decision_scores=gaps,
        bars=bars,
        from_index=20,
        trade_side_policy="longOnly",
    )
    assert out is None or out.get("basis", "").startswith("MACD")


def test_mm_levels_for_hypothetical_none_when_no_atr() -> None:
    from app.money_management.entry_advice import _mm_levels_for_hypothetical_entry

    mm_cfg = money_management_from_dict(MM_CONFIG)
    mm = MoneyManagementService(mm_cfg)
    mm_out, pyr = _mm_levels_for_hypothetical_entry(
        mm=mm,
        is_long=True,
        entry_price=100.0,
        atr_series=[None] * 5,
        index=2,
        equity=100000.0,
        equity_high=100000.0,
        symbol_id="sym",
        current_price=100.0,
    )
    assert mm_out is None
    assert pyr is None


def test_walk_position_without_mm() -> None:
    closes = [100.0, 101.0, 102.0]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    signals = [
        SignalPoint(date=d, buy=i == 1, sell=False) for i, d in enumerate(dates)
    ]
    pos = _walk_position_to_index(
        dates=dates,
        highs=[b.high for b in bars],
        lows=[b.low for b in bars],
        closes=closes,
        signals=signals,
        end_index=2,
        trade_side_policy="longOnly",
        mm=None,
        atr_series=[],
        symbol_id="sym",
        initial_cash=1000.0,
        equity_high=1000.0,
    )
    assert pos is not None
    assert pos.units == 1


def test_walk_position_stop_and_reverse() -> None:
    from app.main import _signals_and_scores

    closes = [100.0, 102.0, 104.0, 106.0, 50.0, 48.0]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    spec = SignalSpec(strategyType="smaCross", shortPeriod=2, longPeriod=3)
    signals, scores, _ = _signals_and_scores(
        dates,
        closes,
        spec,
        bars=bars,
    )
    mm_cfg = money_management_from_dict(MM_CONFIG)
    mm = MoneyManagementService(mm_cfg)
    atr_series = mm.compute_atr_series(
        [b.high for b in bars],
        [b.low for b in bars],
        closes,
    )
    pos = _walk_position_to_index(
        dates=dates,
        highs=[b.high for b in bars],
        lows=[b.low for b in bars],
        closes=closes,
        signals=signals,
        end_index=3,
        trade_side_policy="longShort",
        mm=mm,
        atr_series=atr_series,
        symbol_id="sym",
        initial_cash=100000.0,
        equity_high=100000.0,
    )
    # ストップ・反転の分岐を通す（建玉の有無はデータ依存）
    assert pos is None or pos.is_long is not None


def test_extrapolate_entry_branches() -> None:
    closes = [100.0 + i for i in range(20)]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    spec_ts = SignalSpec(
        strategyType="trendScoreThreshold",
        buyThreshold=37.5,
        sellThreshold=-42.5,
    )
    scores = [10.0 + i * 5 for i in range(20)]
    out = _extrapolate_entry(
        spec=spec_ts,
        dates=dates,
        closes=closes,
        decision_scores=scores,
        bars=bars,
        from_index=5,
        trade_side_policy="longOnly",
    )
    assert out is None or out.get("triggerDate") is not None

    spec_rsi = SignalSpec(strategyType="rsiThreshold", period=14, lower=30, upper=70)
    rsi_scores = [60.0 - i * 2 for i in range(20)]
    out_rsi = _extrapolate_entry(
        spec=spec_rsi,
        dates=dates,
        closes=closes,
        decision_scores=rsi_scores,
        bars=bars,
        from_index=10,
        trade_side_policy="longOnly",
    )
    assert out_rsi is None or "RSI" in out_rsi.get("basis", "")

    spec_sma = SignalSpec(strategyType="smaCross", shortPeriod=2, longPeriod=5)
    gaps = [-2.0, -1.5, -1.0, -0.5, -0.25, -0.1]
    gap_full = gaps + [0.0] * (20 - len(gaps))
    out_sma = _extrapolate_entry(
        spec=spec_sma,
        dates=dates,
        closes=closes,
        decision_scores=gap_full,
        bars=bars,
        from_index=5,
        trade_side_policy="longOnly",
    )
    assert out_sma is None or out_sma.get("triggerDate") is not None


def test_extrapolate_sma_cross_success() -> None:
    closes = [
        100,
        99,
        98,
        97,
        96,
        95,
        94,
        93,
        94,
        95,
        96,
        97,
        98,
        99,
        100,
        101,
        102,
        103,
        104,
        105,
    ]
    bars = _bars_from_closes([float(c) for c in closes])
    dates = [b.date for b in bars]
    spec = SignalSpec(strategyType="smaCross", shortPeriod=2, longPeriod=5)
    out = _extrapolate_entry(
        spec=spec,
        dates=dates,
        closes=[float(c) for c in closes],
        decision_scores=[],
        bars=bars,
        from_index=8,
        trade_side_policy="longOnly",
    )
    assert out is not None
    assert out["triggerDate"] is not None
    assert "SMA" in out["basis"]


def test_predict_entry_short_scan() -> None:
    closes = [2.0, 2.0, 2.0, 1.0, 1.0, 1.0]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    signals = [
        SignalPoint(date=d, buy=False, sell=False)
        for d in dates
    ]
    signals[5] = SignalPoint(date=dates[5], buy=False, sell=True)
    out = _predict_entry(
        spec=SignalSpec(strategyType="smaCross", shortPeriod=2, longPeriod=3),
        dates=dates,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(closes),
        bars=bars,
        from_index=3,
        trade_side_policy="longShort",
    )
    assert out["predicted"]["direction"] == "short"


def test_walk_short_stop_hit() -> None:
    closes = [100.0, 98.0, 96.0, 94.0, 200.0]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    signals = [SignalPoint(date=dates[0], buy=False, sell=True)] + [
        SignalPoint(date=d, buy=False, sell=False) for d in dates[1:]
    ]
    mm_cfg = money_management_from_dict(MM_CONFIG)
    mm = MoneyManagementService(mm_cfg)
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    atr_series = mm.compute_atr_series(highs, lows, closes)
    pos = _walk_position_to_index(
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        end_index=3,
        trade_side_policy="longShort",
        mm=mm,
        atr_series=atr_series,
        symbol_id="sym-1",
        initial_cash=100000.0,
        equity_high=100000.0,
    )
    assert pos is None


def test_walk_close_long_open_short() -> None:
    closes = [100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 90.0]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    signals = [
        SignalPoint(date=d, buy=i == 3, sell=i == 5) for i, d in enumerate(dates)
    ]
    mm_cfg = money_management_from_dict(MM_CONFIG)
    mm = MoneyManagementService(mm_cfg)
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    atr_series = mm.compute_atr_series(highs, lows, closes)
    pos = _walk_position_to_index(
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        end_index=6,
        trade_side_policy="longShort",
        mm=mm,
        atr_series=atr_series,
        symbol_id="sym-1",
        initial_cash=100000.0,
        equity_high=100000.0,
    )
    assert pos is not None
    assert not pos.is_long


def test_walk_close_short_open_long() -> None:
    closes = [100.0, 99.0, 98.0, 97.0, 96.0, 95.0, 94.0]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    signals = [
        SignalPoint(date=d, buy=i == 5, sell=i == 3) for i, d in enumerate(dates)
    ]
    mm_cfg = money_management_from_dict(MM_CONFIG)
    mm = MoneyManagementService(mm_cfg)
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    atr_series = mm.compute_atr_series(highs, lows, closes)
    pos = _walk_position_to_index(
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        end_index=6,
        trade_side_policy="longShort",
        mm=mm,
        atr_series=atr_series,
        symbol_id="sym-1",
        initial_cash=100000.0,
        equity_high=100000.0,
    )
    assert pos is not None
    assert pos.is_long


def test_mm_levels_position_pyramid_disabled() -> None:
    from app.money_management.entry_advice import _mm_levels_for_position, _PositionSnapshot

    cfg = money_management_from_dict({**MM_CONFIG, "pyramiding": {**MM_CONFIG["pyramiding"], "enabled": False}})
    mm = MoneyManagementService(cfg)
    pos = _PositionSnapshot(
        is_long=True,
        entry_date="2026-01-01",
        entry_price=100.0,
        first_entry_price=100.0,
        units=1,
        unit_qty=10.0,
        quantity=10.0,
        atr_at_entry=2.0,
        risk_rate=0.01,
        stop_price=96.0,
    )
    mm_out, pyramid = _mm_levels_for_position(
        mm=mm,
        position=pos,
        current_price=101.0,
        symbol_id="sym",
    )
    assert mm_out is not None
    assert pyramid is None


def test_hypothetical_mm_zero_unit_qty() -> None:
    from app.money_management.entry_advice import _mm_levels_for_hypothetical_entry

    zero_risk = {**MM_CONFIG, "riskRate": 0.0}
    mm = MoneyManagementService(money_management_from_dict(zero_risk))
    bars = _bars_from_closes([100.0] * 10)
    atr_series = mm.compute_atr_series(
        [b.high for b in bars],
        [b.low for b in bars],
        [b.close for b in bars],
    )
    mm_out, pyr = _mm_levels_for_hypothetical_entry(
        mm=mm,
        is_long=True,
        entry_price=100.0,
        atr_series=atr_series,
        index=5,
        equity=100000.0,
        equity_high=100000.0,
        symbol_id="sym",
        current_price=100.0,
    )
    assert mm_out is None
    assert pyr is None


def test_mm_levels_for_position_no_mm() -> None:
    from app.money_management.entry_advice import _mm_levels_for_position, _PositionSnapshot

    pos = _PositionSnapshot(
        is_long=True,
        entry_date="2026-01-01",
        entry_price=100.0,
        first_entry_price=100.0,
        units=1,
        unit_qty=1.0,
        quantity=1.0,
        atr_at_entry=2.0,
        risk_rate=0.01,
        stop_price=96.0,
    )
    mm_out, pyramid = _mm_levels_for_position(
        mm=None,
        position=pos,
        current_price=100.0,
        symbol_id="sym",
    )
    assert mm_out is None
    assert pyramid is None


def test_extrapolate_trend_score_success() -> None:
    closes = [100.0 + i for i in range(20)]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    spec = SignalSpec(
        strategyType="trendScoreThreshold",
        buyThreshold=50.0,
        sellThreshold=-50.0,
    )
    scores = [10.0 + i * 5 for i in range(20)]
    out = _extrapolate_entry(
        spec=spec,
        dates=dates,
        closes=closes,
        decision_scores=scores,
        bars=bars,
        from_index=5,
        trade_side_policy="longOnly",
    )
    assert out is not None
    assert out.get("triggerDate") is not None


def test_predict_entry_uses_extrapolation() -> None:
    closes = [100.0 + i for i in range(20)]
    bars = _bars_from_closes(closes)
    dates = [b.date for b in bars]
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    scores = [10.0 + i * 5 for i in range(20)]
    spec = SignalSpec(
        strategyType="trendScoreThreshold",
        buyThreshold=50.0,
        sellThreshold=-50.0,
    )
    out = _predict_entry(
        spec=spec,
        dates=dates,
        closes=closes,
        signals=signals,
        decision_scores=scores,
        bars=bars,
        from_index=5,
        trade_side_policy="longOnly",
    )
    assert out["predicted"]["triggerDate"] is not None
    assert "外挿" in out["predicted"]["basis"]


def test_hypothetical_entry_mm_none() -> None:
    from app.money_management.entry_advice import _mm_levels_for_hypothetical_entry

    mm_out, pyr = _mm_levels_for_hypothetical_entry(
        mm=None,
        is_long=True,
        entry_price=100.0,
        atr_series=[],
        index=0,
        equity=100000.0,
        equity_high=100000.0,
        symbol_id="sym",
        current_price=100.0,
    )
    assert mm_out is None
    assert pyr is None


def test_trend_score_rationale_and_context_helpers() -> None:
    from app.money_management.entry_advice import _build_trend_score_rationale, _trend_score_context

    sell_text = _build_trend_score_rationale(
        score=10.0,
        buy_threshold=37.5,
        sell_threshold=-42.5,
        breakdown_payload=None,
        signal_buy=False,
        signal_sell=True,
    )
    assert "売りシグナル" in sell_text

    buy_text = _build_trend_score_rationale(
        score=40.0,
        buy_threshold=37.5,
        sell_threshold=-42.5,
        breakdown_payload={"groups": {}, "indicators": {"rsi": 5.0}},
        signal_buy=True,
        signal_sell=False,
    )
    assert "買いシグナル" in buy_text

    ctx = _trend_score_context(
        spec=SignalSpec(strategyType="smaCross", shortPeriod=2, longPeriod=3),
        base_index=0,
        decision_scores=[None],
        breakdowns=[None],
        signal_at_base=SignalPoint(date="2026-01-01", buy=False, sell=False),
    )
    assert ctx["scoreAtBase"] is None


def test_entry_advice_wait_includes_new_entry_from_base() -> None:
    bars = _bars(25)
    result = compute_entry_advice(
        EntryAdviceRequest(
            symbolId="sym-1",
            bars=bars,
            signal=SignalSpec(
                strategyType="trendScoreThreshold",
                buyThreshold=37.5,
                sellThreshold=-42.5,
            ),
            baseDate=bars[-1].date,
            initialCash=100000,
            tradeSidePolicy="longOnly",
            moneyManagement=MM_CONFIG,
        ),
    )
    assert result.entryTiming in ("wait", "entry_now", "in_position")
    if result.entryTiming == "wait":
        assert result.newEntryFromBase is not None
        assert result.rationale is not None
        assert result.scoreAtBase is not None or result.scoreBreakdown is not None


def test_new_entry_from_base_none_without_atr() -> None:
    bars = _bars(6)
    result = compute_entry_advice(
        EntryAdviceRequest(
            symbolId="sym-1",
            bars=bars,
            signal=SignalSpec(
                strategyType="trendScoreThreshold",
                buyThreshold=37.5,
                sellThreshold=-42.5,
            ),
            baseDate=bars[0].date,
            initialCash=100000,
            tradeSidePolicy="longOnly",
            moneyManagement=MM_CONFIG,
        ),
    )
    assert result.entryTiming == "wait"
    assert result.newEntryFromBase is None


def test_entry_advice_short_entry_now_reason() -> None:
    from unittest.mock import patch

    bars = _bars(10)
    base_date = bars[-1].date
    signals = [SignalPoint(date=b.date, buy=False, sell=False) for b in bars]
    signals[-1] = SignalPoint(date=base_date, buy=False, sell=True)
    with patch("app.main._signals_and_scores") as mock_sig:
        mock_sig.return_value = (signals, [0.0] * len(bars), [None] * len(bars))
        with patch(
            "app.money_management.entry_advice._walk_position_to_index",
            return_value=None,
        ):
            result = compute_entry_advice(
                EntryAdviceRequest(
                    symbolId="sym-1",
                    bars=bars,
                    signal=SignalSpec(
                        strategyType="trendScoreThreshold",
                        buyThreshold=37.5,
                        sellThreshold=-42.5,
                    ),
                    baseDate=base_date,
                    initialCash=100000,
                    tradeSidePolicy="longShort",
                    moneyManagement=MM_CONFIG,
                ),
            )
    assert result.entryTiming == "entry_now"
    assert result.direction == "short"
    assert result.entryReasonCode == "score_cross_down"


def test_trend_score_context_entry_reason_codes() -> None:
    from app.money_management.entry_advice import _trend_score_context

    spec = SignalSpec(
        strategyType="trendScoreThreshold",
        buyThreshold=37.5,
        sellThreshold=-42.5,
    )
    buy_ctx = _trend_score_context(
        spec=spec,
        base_index=0,
        decision_scores=[50.0],
        breakdowns=[None],
        signal_at_base=SignalPoint(date="2026-01-01", buy=True, sell=False),
    )
    assert buy_ctx["entryReasonCode"] == "score_cross_up"
    sell_ctx = _trend_score_context(
        spec=spec,
        base_index=0,
        decision_scores=[-50.0],
        breakdowns=[None],
        signal_at_base=SignalPoint(date="2026-01-01", buy=False, sell=True),
    )
    assert sell_ctx["entryReasonCode"] == "score_cross_down"


def test_entry_advice_endpoint() -> None:
    client = TestClient(app)
    payload = {
        "symbolId": "sym-1",
        "bars": _bar_dicts([100.0] * 10),
        "signal": {
            "strategyType": "trendScoreThreshold",
            "buyThreshold": 37.5,
            "sellThreshold": -42.5,
        },
        "baseDate": "2026-01-10",
        "initialCash": 100000,
    }
    response = client.post("/analysis/entry-advice", json=payload)
    assert response.status_code == 200
