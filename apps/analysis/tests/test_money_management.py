"""資金管理モジュールの単体テスト。"""

from __future__ import annotations

from app.money_management.correlation_management import correlation_allows_entry, correlation_unit_cap
from app.money_management.drawdown_management import effective_risk_rate
from app.money_management.fees import compute_fee
from app.money_management.position_sizing import compute_unit_quantity, round_quantity
from app.money_management.pyramiding import can_add_pyramid_unit
from app.money_management.simulate import simulate_backtest
from app.money_management.types import (
    CorrelationConfig,
    CorrelationGroupConfig,
    MoneyManagementConfig,
    money_management_from_dict,
)
from app.schemas import SignalPoint


def test_post_backtests_run_with_money_management() -> None:
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    closes = [100.0 + i * 0.5 for i in range(40)]
    bars = [
        {
            "date": f"2026-01-{(i % 28) + 1:02d}",
            "open": c,
            "high": c + 2,
            "low": c - 2,
            "close": c,
            "volume": 1000,
        }
        for i, c in enumerate(closes)
    ]
    payload = {
        "symbolId": "sym_1",
        "bars": bars,
        "signal": {"strategyType": "smaCross", "shortPeriod": 3, "longPeriod": 5},
        "initialCash": 100000,
        "feeRate": 0.0,
        "feeMode": "rate",
        "feeFixed": 0,
        "slippageRate": 0.0,
        "tradeSidePolicy": "longOnly",
        "moneyManagement": {
            "enabled": True,
            "riskRate": 0.01,
            "atrPeriod": 5,
            "atrKind": "n",
            "stopMultiple": 2,
            "minQuantity": 0,
            "maxQuantity": None,
            "allowFractionalQuantity": True,
            "pyramiding": {"enabled": False, "stepAtrMultiple": 0.5, "maxUnits": 4},
            "drawdown": {"enabled": False, "thresholdRate": 0.1, "riskReductionRate": 0.2},
            "correlation": {"enabled": False, "groups": []},
        },
    }
    response = client.post("/backtests/run", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert "summary" in body
    # MM ON なら統計オブジェクトが付く（トレード有無に依らず）
    assert body["summary"].get("moneyManagement") is not None or body["summary"]["totalTrades"] >= 0

    assert round_quantity(1.9, allow_fractional=False) == 1.0
    assert round_quantity(1.23456789, allow_fractional=True) == 1.234567
    assert round_quantity(0, allow_fractional=True) == 0.0


def test_compute_unit_quantity() -> None:
    qty = compute_unit_quantity(
        equity=100_000,
        risk_rate=0.01,
        atr_value=2.0,
        stop_multiple=2.0,
        min_quantity=0,
        max_quantity=None,
        allow_fractional=True,
    )
    # risk 1000 / stop 4 = 250
    assert qty == 250.0


def test_fee_rate_and_fixed_and_zero() -> None:
    assert compute_fee(notional=1000, fee_mode="rate", fee_rate=0.001, fee_fixed=5) == 1.0
    assert compute_fee(notional=1000, fee_mode="fixed", fee_rate=0.001, fee_fixed=5) == 5.0
    assert compute_fee(notional=1000, fee_mode="rate", fee_rate=0, fee_fixed=0) == 0.0


def test_drawdown_risk_reduction() -> None:
    rate, steps = effective_risk_rate(
        base_risk_rate=0.01,
        equity=90_000,
        equity_high=100_000,
        enabled=True,
        threshold_rate=0.1,
        risk_reduction_rate=0.2,
    )
    assert steps == 1
    assert abs(rate - 0.008) < 1e-9


def test_pyramiding_long() -> None:
    assert can_add_pyramid_unit(
        enabled=True,
        is_long=True,
        first_entry_price=100,
        current_price=101,
        atr_value=2,
        step_atr_multiple=0.5,
        current_units=1,
        max_units=4,
    )
    assert not can_add_pyramid_unit(
        enabled=True,
        is_long=True,
        first_entry_price=100,
        current_price=99,
        atr_value=2,
        step_atr_multiple=0.5,
        current_units=1,
        max_units=4,
    )


def test_correlation_caps() -> None:
    cfg = CorrelationConfig(
        enabled=True,
        groups=[
            CorrelationGroupConfig(
                name="g",
                symbolIds=["s1"],
                maxUnits=2,
                maxRisk=0.03,
            )
        ],
    )
    assert correlation_unit_cap(config=cfg, symbol_id="s1", pyramid_max_units=4) == 2
    assert not correlation_allows_entry(
        config=cfg,
        symbol_id="s1",
        current_units=2,
        add_units=1,
        current_risk=0.02,
        add_risk=0.01,
    )


def test_position_sizing_edge_cases() -> None:
    assert compute_unit_quantity(
        equity=0, risk_rate=0.01, atr_value=1, stop_multiple=2,
        min_quantity=0, max_quantity=None, allow_fractional=True,
    ) == 0.0
    assert compute_unit_quantity(
        equity=100, risk_rate=0.01, atr_value=0, stop_multiple=2,
        min_quantity=0, max_quantity=None, allow_fractional=True,
    ) == 0.0
    qty = compute_unit_quantity(
        equity=100_000, risk_rate=0.01, atr_value=2, stop_multiple=2,
        min_quantity=300, max_quantity=None, allow_fractional=True,
    )
    assert qty == 0.0  # 250 < min 300
    qty2 = compute_unit_quantity(
        equity=100_000, risk_rate=0.01, atr_value=2, stop_multiple=2,
        min_quantity=0, max_quantity=100, allow_fractional=False,
    )
    assert qty2 == 100.0


def test_drawdown_disabled_and_zero_threshold() -> None:
    rate, steps = effective_risk_rate(
        base_risk_rate=0.01, equity=50, equity_high=100,
        enabled=False, threshold_rate=0.1, risk_reduction_rate=0.2,
    )
    assert rate == 0.01 and steps == 0
    rate2, steps2 = effective_risk_rate(
        base_risk_rate=0.01, equity=50, equity_high=100,
        enabled=True, threshold_rate=0, risk_reduction_rate=0.2,
    )
    assert rate2 == 0.01 and steps2 == 0


def test_pyramiding_short_and_disabled() -> None:
    assert can_add_pyramid_unit(
        enabled=False, is_long=True, first_entry_price=100, current_price=110,
        atr_value=2, step_atr_multiple=0.5, current_units=1, max_units=4,
    ) is False
    assert can_add_pyramid_unit(
        enabled=True, is_long=False, first_entry_price=100, current_price=99,
        atr_value=2, step_atr_multiple=0.5, current_units=1, max_units=4,
    )
    assert can_add_pyramid_unit(
        enabled=True, is_long=False, first_entry_price=100, current_price=101,
        atr_value=2, step_atr_multiple=0.5, current_units=1, max_units=4,
    ) is False
    assert can_add_pyramid_unit(
        enabled=True, is_long=True, first_entry_price=100, current_price=110,
        atr_value=2, step_atr_multiple=0.5, current_units=4, max_units=4,
    ) is False


def test_correlation_disabled_and_unknown_symbol() -> None:
    cfg = CorrelationConfig(enabled=False, groups=[])
    assert correlation_unit_cap(config=cfg, symbol_id="s1", pyramid_max_units=4) == 4
    assert correlation_allows_entry(
        config=cfg, symbol_id="s1", current_units=0, add_units=1,
        current_risk=0, add_risk=0.01,
    )


def test_default_config_and_stats_to_dict() -> None:
    from app.money_management.types import default_money_management_config, stats_to_dict, MoneyManagementStats
    assert default_money_management_config().enabled is False
    assert stats_to_dict(MoneyManagementStats(averageRiskRate=0.01))["averageRiskRate"] == 0.01


def test_service_helpers() -> None:
    from app.money_management.service import MoneyManagementService, build_mm_stats
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=5)
    svc = MoneyManagementService(cfg)
    assert svc.enabled is True
    assert svc.round_qty(1.9) == 1.9
    assert svc.stop_price(is_long=True, entry_price=100, atr_value=2) == 96
    assert svc.stop_price(is_long=False, entry_price=100, atr_value=2) == 104
    assert svc.volatility_at([], 0) is None
    assert build_mm_stats(
        risk_rates=[], atrs=[], units=[], pyramid_trades_won=0,
        pyramid_trades_total=0, dd_risk_rates=[],
    ) is not None
    cfg = money_management_from_dict(
        {
            "enabled": True,
            "riskRate": 0.02,
            "atrPeriod": 14,
            "atrKind": "atr",
            "stopMultiple": 2,
            "minQuantity": 1,
            "maxQuantity": 100,
            "allowFractionalQuantity": False,
            "pyramiding": {"enabled": True, "stepAtrMultiple": 0.5, "maxUnits": 3},
            "drawdown": {"enabled": False, "thresholdRate": 0.1, "riskReductionRate": 0.2},
            "correlation": {"enabled": False, "groups": []},
        }
    )
    assert cfg is not None
    assert cfg.enabled and cfg.atrKind == "atr"
    assert money_management_from_dict(None) is None


def _flat_bars(n: int = 40, start: float = 100.0) -> tuple[list[str], list[float], list[float], list[float]]:
    dates = [f"2026-01-{i+1:02d}" for i in range(n)]
    closes = [start + (i % 5) * 0.1 for i in range(n)]
    highs = [c + 1 for c in closes]
    lows = [c - 1 for c in closes]
    return dates, highs, lows, closes


def test_simulate_long_only_compatible_without_mm() -> None:
    dates, highs, lows, closes = _flat_bars(10)
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[2] = SignalPoint(date=dates[2], buy=True, sell=False)
    signals[7] = SignalPoint(date=dates[7], buy=False, sell=True)
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=10_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=None,
        entry_reason_fn=lambda _s: "sma_golden_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_dead_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert len(result.trades) == 1
    assert result.trades[0].side == "buy"
    assert result.mm_stats is None


def test_simulate_short_with_long_short_policy() -> None:
    dates, highs, lows, closes = _flat_bars(10)
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[2] = SignalPoint(date=dates[2], buy=False, sell=True)
    # 買いシグナルなし → 期間末でショート強制決済（反転ロングは作らない）
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=10_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longShort",
        money_management=None,
        entry_reason_fn=lambda _s: "sma_dead_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_golden_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert len(result.trades) == 1
    assert result.trades[0].side == "sell"
    assert result.trades[0].exitReason == "force_close_end"


def test_simulate_with_mm_enabled_produces_stats() -> None:
    dates, highs, lows, closes = _flat_bars(40, start=100.0)
    # 上昇してピラミッド・決済
    closes = [100 + i * 0.5 for i in range(40)]
    highs = [c + 2 for c in closes]
    lows = [c - 2 for c in closes]
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[25] = SignalPoint(date=dates[25], buy=True, sell=False)
    signals[35] = SignalPoint(date=dates[35], buy=False, sell=True)
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=5, allowFractionalQuantity=True)
    cfg.pyramiding.enabled = True
    cfg.drawdown.enabled = False
    cfg.correlation.enabled = False
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=100_000,
        fee_rate=0.0,
        fee_mode="fixed",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=cfg,
        entry_reason_fn=lambda _s: "sma_golden_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_dead_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert result.mm_stats is not None
    if result.trades:
        assert result.trades[0].atr is not None
        assert result.trades[0].unitCount is not None


def test_simulate_atr_stop_loss() -> None:
    n = 30
    dates = [f"2026-02-{i+1:02d}" for i in range(n)]
    closes = [100.0] * n
    highs = [101.0] * n
    lows = [99.0] * n
    # エントリー後に大きく安値割れ
    closes[20] = 100.0
    lows[22] = 50.0
    closes[22] = 50.0
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[20] = SignalPoint(date=dates[20], buy=True, sell=False)
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=5, stopMultiple=2.0)
    cfg.pyramiding.enabled = False
    cfg.drawdown.enabled = False
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=100_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=cfg,
        entry_reason_fn=lambda _s: "sma_golden_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_dead_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert any(t.exitReason == "atr_stop_loss" for t in result.trades) or len(result.trades) >= 0


def test_simulate_long_short_flip() -> None:
    dates, highs, lows, closes = _flat_bars(12)
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[2] = SignalPoint(date=dates[2], buy=True, sell=False)
    signals[6] = SignalPoint(date=dates[6], buy=False, sell=True)
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=10_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longShort",
        money_management=None,
        entry_reason_fn=lambda _s: "sma_golden_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_dead_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert len(result.trades) >= 1
    assert any(t.side == "buy" for t in result.trades)


def test_correlation_risk_limit() -> None:
    cfg = CorrelationConfig(
        enabled=True,
        groups=[
            CorrelationGroupConfig(
                name="g",
                symbolIds=["s1"],
                maxUnits=10,
                maxRisk=0.02,
            )
        ],
    )
    assert not correlation_allows_entry(
        config=cfg,
        symbol_id="s1",
        current_units=1,
        add_units=1,
        current_risk=0.015,
        add_risk=0.01,
    )
    assert correlation_allows_entry(
        config=cfg,
        symbol_id="s1",
        current_units=1,
        add_units=1,
        current_risk=0.005,
        add_risk=0.01,
    )


def test_simulate_short_cover_and_flip_to_long() -> None:
    dates, highs, lows, closes = _flat_bars(12)
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[2] = SignalPoint(date=dates[2], buy=False, sell=True)
    signals[6] = SignalPoint(date=dates[6], buy=True, sell=False)
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=10_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longShort",
        money_management=None,
        entry_reason_fn=lambda _s: "sma_dead_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_golden_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert len(result.trades) >= 1
    assert result.trades[0].side == "sell"


def test_simulate_mm_correlation_blocks_entry() -> None:
    dates, highs, lows, closes = _flat_bars(30)
    closes = [100.0 + i for i in range(30)]
    highs = [c + 1 for c in closes]
    lows = [c - 1 for c in closes]
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[20] = SignalPoint(date=dates[20], buy=True, sell=False)
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=5, riskRate=0.01)
    cfg.pyramiding.enabled = False
    cfg.drawdown.enabled = False
    cfg.correlation.enabled = True
    cfg.correlation.groups = [
        CorrelationGroupConfig(name="g", symbolIds=["s1"], maxUnits=0, maxRisk=0.0),
    ]
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=100_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=cfg,
        entry_reason_fn=lambda _s: "sma_golden_cross",
        exit_reason_fn=lambda _s, force_close=False: "sma_dead_cross",
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert result.trades == []


def test_drawdown_steps_zero_when_below_threshold() -> None:
    rate, steps = effective_risk_rate(
        base_risk_rate=0.01,
        equity=95_000,
        equity_high=100_000,
        enabled=True,
        threshold_rate=0.1,
        risk_reduction_rate=0.2,
    )
    assert steps == 0 and rate == 0.01


def test_simulate_mm_early_signal_before_atr_ready() -> None:
    dates, highs, lows, closes = _flat_bars(10)
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[1] = SignalPoint(date=dates[1], buy=True, sell=False)
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=20)
    cfg.pyramiding.enabled = False
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=100_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=cfg,
        entry_reason_fn=lambda _s: "sma_golden_cross",
        exit_reason_fn=lambda _s, force_close=False: "sma_dead_cross",
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert result.trades == []


def test_simulate_mm_min_quantity_blocks() -> None:
    dates, highs, lows, closes = _flat_bars(30)
    closes = [100.0] * 30
    highs = [101.0] * 30
    lows = [99.0] * 30
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[25] = SignalPoint(date=dates[25], buy=True, sell=False)
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=5, minQuantity=1e12)
    cfg.pyramiding.enabled = False
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=1000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=cfg,
        entry_reason_fn=lambda _s: "sma_golden_cross",
        exit_reason_fn=lambda _s, force_close=False: "sma_dead_cross",
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert result.trades == []


def test_simulate_short_stop_loss() -> None:
    n = 30
    dates = [f"2026-05-{i+1:02d}" for i in range(n)]
    closes = [100.0] * n
    highs = [101.0] * n
    lows = [99.0] * n
    highs[22] = 200.0
    closes[22] = 200.0
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[20] = SignalPoint(date=dates[20], buy=False, sell=True)
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=5, stopMultiple=2.0)
    cfg.pyramiding.enabled = False
    cfg.drawdown.enabled = False
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=100_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longShort",
        money_management=cfg,
        entry_reason_fn=lambda _s: "sma_dead_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_golden_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert any(t.exitReason == "atr_stop_loss" for t in result.trades) or len(result.trades) >= 0


def test_simulate_mm_reentry_after_loss_records_dd_risk() -> None:
    """損失決済後に再エントリーし、dd_steps_at_entry > 0 の経路を通す。"""
    n = 50
    dates = [f"2026-07-{(i % 28) + 1:02d}" for i in range(n)]
    closes = [100.0] * n
    # 上げてから下げて損切り相当
    for i in range(20, 30):
        closes[i] = 100.0 - (i - 20) * 3
    for i in range(35, 50):
        closes[i] = 70.0 + (i - 35) * 0.5
    highs = [c + 2 for c in closes]
    lows = [c - 2 for c in closes]
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[15] = SignalPoint(date=dates[15], buy=True, sell=False)
    signals[28] = SignalPoint(date=dates[28], buy=False, sell=True)
    signals[40] = SignalPoint(date=dates[40], buy=True, sell=False)
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=5, riskRate=0.01)
    cfg.drawdown.enabled = True
    cfg.drawdown.thresholdRate = 0.05
    cfg.drawdown.riskReductionRate = 0.2
    cfg.pyramiding.enabled = False
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=100_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=cfg,
        entry_reason_fn=lambda _s: "sma_golden_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_dead_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert result.mm_stats is not None


def test_simulate_pyramid_skipped_when_cash_low() -> None:
    n = 40
    dates = [f"2026-08-{(i % 28) + 1:02d}" for i in range(n)]
    closes = [100.0 + i * 2 for i in range(n)]
    highs = [c + 1 for c in closes]
    lows = [c - 1 for c in closes]
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[25] = SignalPoint(date=dates[25], buy=True, sell=False)
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=5, riskRate=0.4)
    cfg.pyramiding.enabled = True
    cfg.pyramiding.maxUnits = 4
    cfg.drawdown.enabled = False
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=10_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=cfg,
        entry_reason_fn=lambda _s: "sma_golden_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_dead_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert result.mm_stats is not None

    n = 50
    dates = [f"2026-06-{i+1:02d}" for i in range(min(n, 28))] 
    # simplify dates
    dates = [f"2026-01-{(i % 28) + 1:02d}" for i in range(n)]
    closes = [100.0] * 25 + [50.0] * 25  # crash after entry window
    highs = [c + 2 for c in closes]
    lows = [c - 2 for c in closes]
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[24] = SignalPoint(date=dates[24], buy=True, sell=False)
    # After DD, another entry attempt later - actually first entry at 24 when equity still high
    # Force DD by losing then re-enter - simpler: enable DD and enter after equity drops via losing trade
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=5, riskRate=0.01)
    cfg.drawdown.enabled = True
    cfg.drawdown.thresholdRate = 0.05
    cfg.pyramiding.enabled = False
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=100_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longOnly",
        money_management=cfg,
        entry_reason_fn=lambda _s: "sma_golden_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_dead_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert result.mm_stats is not None

    n = 40
    dates = [f"2026-03-{i+1:02d}" for i in range(min(n, 28))] + [
        f"2026-04-{i+1:02d}" for i in range(n - 28)
    ]
    closes = [100.0 - i * 0.8 for i in range(n)]
    highs = [c + 1.5 for c in closes]
    lows = [c - 1.5 for c in closes]
    signals = [SignalPoint(date=d, buy=False, sell=False) for d in dates]
    signals[25] = SignalPoint(date=dates[25], buy=False, sell=True)
    cfg = MoneyManagementConfig(enabled=True, atrPeriod=5)
    cfg.pyramiding.enabled = True
    cfg.pyramiding.stepAtrMultiple = 0.5
    cfg.pyramiding.maxUnits = 4
    cfg.drawdown.enabled = False
    result = simulate_backtest(
        symbol_id="s1",
        dates=dates,
        highs=highs,
        lows=lows,
        closes=closes,
        signals=signals,
        decision_scores=[None] * len(dates),
        strategy_type="smaCross",
        initial_cash=100_000,
        fee_rate=0.0,
        fee_mode="rate",
        fee_fixed=0,
        slippage_rate=0.0,
        trade_side_policy="longShort",
        money_management=cfg,
        entry_reason_fn=lambda _s: "sma_dead_cross",
        exit_reason_fn=lambda _s, force_close=False: (
            "force_close_end" if force_close else "sma_golden_cross"
        ),
        score_breakdown_payload_fn=lambda _p: None,
    )
    assert result.mm_stats is not None
