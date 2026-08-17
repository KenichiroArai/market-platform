"""トレンドスコアの純関数・POST /trend-score のテスト。"""

from __future__ import annotations

import math
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.indicators import score as score_mod
from app.indicators.trend_score import compute_trend_score
from app.main import app
from app.schemas import OhlcBar


def _bars(closes: list[float], *, volume: float = 10.0, start: str = "2024-01-01") -> list[OhlcBar]:
    base = date.fromisoformat(start)
    out: list[OhlcBar] = []
    for i, close in enumerate(closes):
        d = (base + timedelta(days=i)).isoformat()
        out.append(
            OhlcBar(
                date=d,
                open=close,
                high=close + 1,
                low=close - 1,
                close=close,
                volume=volume,
            )
        )
    return out


def test_clamp_and_tanh() -> None:
    assert score_mod.clamp(150) == 100.0
    assert score_mod.clamp(-150) == -100.0
    assert score_mod.clamp(0) == 0.0
    assert score_mod.tanh_score(0.0) == pytest.approx(0.0)
    assert score_mod.tanh_score(0.05 / 0.05) == pytest.approx(100.0 * math.tanh(1.0))


def test_piecewise_linear_edges_and_mid() -> None:
    points = score_mod.RSI_POINTS
    assert score_mod.piecewise_linear(10.0, points) == 100.0
    assert score_mod.piecewise_linear(90.0, points) == -100.0
    assert score_mod.piecewise_linear(50.0, points) == 0.0
    assert score_mod.piecewise_linear(30.0, points) == 50.0
    assert score_mod.piecewise_linear(70.0, points) == -50.0
    assert score_mod.piecewise_linear(60.0, points) == pytest.approx(-25.0)
    assert score_mod.piecewise_linear(1.0, []) == 0.0
    assert score_mod.piecewise_linear(2.0, [(1.0, 4.0), (1.0, 9.0)]) == 9.0


def test_ma_and_macd_and_psar_scores() -> None:
    assert score_mod.ma_score(105.0, 100.0) == pytest.approx(100.0 * math.tanh(1.0))
    assert score_mod.ma_score(100.0, None) is None
    assert score_mod.ma_score(100.0, 0.0) is None
    assert score_mod.macd_score(0.0, 1.0, 0.0, 1.0) is None
    assert score_mod.macd_score(100.0, None, 0.0, 1.0) is None
    up = score_mod.macd_score(100.0, 2.0, 1.0, 1.0)
    down = score_mod.macd_score(100.0, 1.0, 2.0, -1.0)
    equal = score_mod.macd_score(100.0, 1.0, 1.0, 0.0)
    assert up is not None and up > 0
    assert down is not None and down < 0
    assert equal == pytest.approx(0.0)
    assert score_mod.psar_score(10.0, 9.0) == 100.0
    assert score_mod.psar_score(10.0, 11.0) == -100.0
    assert score_mod.psar_score(10.0, 10.0) == 0.0
    assert score_mod.psar_score(10.0, None) is None


def test_ichimoku_and_momentum_roc() -> None:
    assert score_mod.ichimoku_score(10.0, None, None, None, None, None) is None
    above = score_mod.ichimoku_score(12.0, 11.0, 10.0, 9.0, 8.0, 7.0)
    assert above == pytest.approx(100.0)
    below = score_mod.ichimoku_score(1.0, 2.0, 3.0, 8.0, 9.0, 4.0)
    assert below == pytest.approx(-100.0)
    inside = score_mod.ichimoku_score(10.0, 10.0, 10.0, 12.0, 8.0, 10.0)
    assert inside == pytest.approx(0.0)
    assert score_mod.momentum_score(0.0, 1.0) is None
    assert score_mod.momentum_score(100.0, None) is None
    assert score_mod.momentum_score(100.0, 5.0) == pytest.approx(100.0 * math.tanh(1.0))
    assert score_mod.roc_score(None) is None
    assert score_mod.roc_score(5.0) == pytest.approx(100.0 * math.tanh(1.0))


def test_oscillator_corrections() -> None:
    assert score_mod.rsi_like_score(None) is None
    assert score_mod.rsi_like_score(50.0) == 0.0
    assert score_mod.rsi_like_score(80.0) == -100.0
    assert score_mod.rsi_like_score(20.0) == 100.0
    assert score_mod.willr_score(None) is None
    assert score_mod.willr_score(-50.0) == 0.0
    assert score_mod.cci_score(None) is None
    assert score_mod.cci_score(0.0) == 0.0
    assert score_mod.cci_score(200.0) == -100.0


def test_volatility_volume_cycle_scores() -> None:
    assert score_mod.percent_b_score(10.0, None, 1.0) is None
    assert score_mod.percent_b_score(10.0, 10.0, 10.0) == 0.0
    assert score_mod.percent_b_score(15.0, 20.0, 10.0) == 0.0
    assert score_mod.percent_b_score(20.0, 20.0, 10.0) == 100.0
    assert score_mod.trend_sign(10.0, None) == 0.0
    assert score_mod.trend_sign(10.0, 9.0) == 1.0
    assert score_mod.trend_sign(10.0, 11.0) == -1.0
    assert score_mod.trend_sign(10.0, 10.0) == 0.0
    assert score_mod.volatility_strength_score(None, 1.0, 1.0) is None
    assert score_mod.volatility_strength_score(1.0, None, 1.0) is None
    assert score_mod.volatility_strength_score(0.0, 0.0, 1.0) == pytest.approx(0.0)
    assert score_mod.volatility_strength_score(2.0, 0.0, 1.0) == pytest.approx(100.0 * math.tanh(1.0))
    assert score_mod.volatility_strength_score(2.0, 1.0, 1.0) == pytest.approx(100.0 * math.tanh(1.0))
    assert score_mod.volume_bar_score(10.0, 9.0, 20.0, None) is None
    assert score_mod.volume_bar_score(10.0, 9.0, 20.0, 0.0) is None
    up_vol = score_mod.volume_bar_score(10.0, 9.0, 20.0, 10.0)
    down_vol = score_mod.volume_bar_score(9.0, 10.0, 20.0, 10.0)
    assert up_vol is not None and up_vol > 0
    assert down_vol is not None and down_vol < 0
    assert score_mod.obv_score(None, 1.0) is None
    assert score_mod.obv_score(1.0, None) is None
    assert score_mod.obv_score(1.05, 1.0) == pytest.approx(100.0 * math.tanh(1.0))
    assert score_mod.obv_score(1.0, 0.0) == pytest.approx(100.0 * math.tanh(1.0 / 0.05))
    assert score_mod.mfi_score(None) is None
    assert score_mod.mfi_score(50.0) == pytest.approx(0.0)
    assert score_mod.fibonacci_score(10.0, 10.0, 10.0) == 0.0
    assert score_mod.fibonacci_score(10.0, 20.0, 0.0) == 0.0
    assert score_mod.fibonacci_score(0.0, 20.0, 0.0) == 100.0
    assert score_mod.poc_price(None) is None
    assert score_mod.poc_price([]) is None

    class _Bin:
        def __init__(self, low: float, high: float, volume: float) -> None:
            self.priceLow = low
            self.priceHigh = high
            self.volume = volume

    assert score_mod.poc_price([_Bin(1.0, 3.0, 10.0), _Bin(3.0, 5.0, 2.0)]) == pytest.approx(2.0)
    rolled = score_mod.rolling_sma([None, 1.0, 2.0, 3.0], 2)
    assert rolled[0] is None
    assert rolled[-1] == pytest.approx(2.5)


def test_aggregate_skips_null_and_unknown() -> None:
    total, groups = score_mod.aggregate_scores({})
    assert total is None
    assert groups["trend"] is None
    total2, groups2 = score_mod.aggregate_scores({"sma25": 100.0, "unknown": 50.0, "rsi": None})
    assert total2 == pytest.approx(40.0)
    assert groups2["trend"] == pytest.approx(40.0)
    assert groups2["oscillator"] is None
    huge, _ = score_mod.aggregate_scores(
        {
            "sma25": 100.0,
            "momentum": 100.0,
            "rsi": 100.0,
            "bb": 100.0,
            "volume": 100.0,
            "fibonacci": 100.0,
        }
    )
    assert huge == pytest.approx(100.0)


def test_compute_trend_score_empty_and_short_series() -> None:
    assert compute_trend_score([]) == []
    points = compute_trend_score(_bars([100.0, 101.0, 102.0]), range_start_index=0)
    assert len(points) == 3
    assert points[0].date == "2024-01-01"
    assert "sma25" in points[-1].indicators
    assert "elliott" not in points[-1].indicators
    assert points[-1].groups["momentum"] is None or isinstance(points[-1].groups["momentum"], float)


def test_compute_trend_score_range_start_skips_fib_before_window() -> None:
    closes = [100.0 + i for i in range(30)]
    points = compute_trend_score(_bars(closes), range_start_index=25)
    assert points[0].indicators["fibonacci"] is None
    assert points[0].indicators["volumeProfile"] is None
    assert points[-1].indicators["fibonacci"] is not None


def test_compute_trend_score_beyond_range_has_no_drawings() -> None:
    points = compute_trend_score(_bars([10.0, 11.0]), range_start_index=10)
    assert points[0].indicators["fibonacci"] is None
    assert points[0].indicators["volumeProfile"] is None
    assert compute_trend_score(_bars([10.0]), range_start_index=-1)[0].date == "2024-01-01"


def test_post_trend_score_endpoint() -> None:
    client = TestClient(app)
    empty = client.post("/trend-score", json={"bars": []})
    assert empty.status_code == 200
    assert empty.json() == {"points": []}

    body = {
        "bars": [
            {
                "date": "2024-01-01",
                "open": 10,
                "high": 11,
                "low": 9,
                "close": 10,
                "volume": 100,
            },
            {
                "date": "2024-01-02",
                "open": 10,
                "high": 12,
                "low": 9,
                "close": 11,
                "volume": 120,
            },
        ],
        "rangeStartIndex": 0,
    }
    response = client.post("/trend-score", json=body)
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["points"]) == 2
    assert payload["points"][0]["date"] == "2024-01-01"
    assert "groups" in payload["points"][0]
    assert "indicators" in payload["points"][0]
