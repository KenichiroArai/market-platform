"""カタログ拡張指標の純関数・POST /indicators のテスト。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.indicators import extras
from app.indicators.compute import compute_indicator_series
from app.main import app
from app.schemas import IndicatorSpec, OhlcBar


def _ohlc(closes: list[float], *, volume: float = 10.0, start: str = "2024-01-01") -> list[OhlcBar]:
    from datetime import date, timedelta

    base = date.fromisoformat(start)
    bars: list[OhlcBar] = []
    for i, close in enumerate(closes):
        d = (base + timedelta(days=i)).isoformat()
        bars.append(
            OhlcBar(
                date=d,
                open=close,
                high=close + 1,
                low=close - 1,
                close=close,
                volume=volume,
            )
        )
    return bars


def test_momentum_and_roc() -> None:
    closes = [10.0, 11.0, 12.0, 14.0]
    mom = extras.momentum(closes, 2)
    assert mom[0] is None and mom[2] == pytest.approx(2.0)
    roc = extras.roc(closes, 2)
    assert roc[2] == pytest.approx(20.0)
    assert extras.roc([0.0, 1.0], 1)[1] is None
    with pytest.raises(ValueError):
        extras.momentum([1.0], 0)
    with pytest.raises(ValueError):
        extras.roc([1.0], 0)


def test_cci_zero_mad_and_value() -> None:
    flat = extras.cci([1, 1, 1], [1, 1, 1], [1, 1, 1], 2)
    assert flat[-1] == 0.0
    varied = extras.cci([2, 4, 6, 8], [1, 2, 3, 4], [1.5, 3, 4.5, 6], 2)
    assert varied[-1] is not None
    with pytest.raises(ValueError):
        extras.cci([1], [1], [1], 0)


def test_stochastic_and_williams() -> None:
    k, d = extras.stochastic(
        [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4], k_period=2, k_smoothing=1, d_period=1
    )
    assert k[-1] is not None
    flat_k, _ = extras.stochastic([5, 5, 5], [5, 5, 5], [5, 5, 5], k_period=2, k_smoothing=1, d_period=1)
    assert flat_k[-1] == pytest.approx(50.0)
    wr = extras.williams_r([2, 3, 4], [1, 2, 3], [1.5, 2.5, 3.5], 2)
    assert wr[-1] is not None
    flat_wr = extras.williams_r([1, 1], [1, 1], [1, 1], 2)
    assert flat_wr[-1] == pytest.approx(-50.0)
    with pytest.raises(ValueError):
        extras.stochastic([1], [1], [1], k_period=0, k_smoothing=1, d_period=1)
    with pytest.raises(ValueError):
        extras.williams_r([1], [1], [1], 0)


def test_psychological() -> None:
    psy = extras.psychological([1, 2, 3, 2, 4], 2)
    assert psy[0] is None
    assert psy[-1] is not None
    short = extras.psychological([1.0], 12)
    assert all(v is None for v in short)
    with pytest.raises(ValueError):
        extras.psychological([1.0], 0)


def test_bollinger_atr_stdev_keltner() -> None:
    closes = [float(i) for i in range(1, 30)]
    highs = [c + 1 for c in closes]
    lows = [c - 1 for c in closes]
    up, mid, low = extras.bollinger(closes, 5, 2)
    assert mid[4] is not None and up[4] is not None and low[4] is not None
    with pytest.raises(ValueError):
        extras.bollinger(closes, 5, 0)
    atr = extras.atr(highs, lows, closes, 5)
    assert atr[4] is not None
    assert extras.atr(highs[:2], lows[:2], closes[:2], 5)[-1] is None
    sd = extras.stdev(closes, 5)
    assert sd[4] is not None
    ku, km, kl = extras.keltner(highs, lows, closes, ema_period=5, atr_period=5, multiplier=2)
    assert km[-1] is not None and ku[-1] is not None and kl[-1] is not None
    with pytest.raises(ValueError):
        extras.keltner(highs, lows, closes, ema_period=5, atr_period=5, multiplier=0)


def test_obv_vwap_mfi() -> None:
    assert extras.obv([], []) == []
    obv = extras.obv([1, 2, 1, 1], [10, 5, 3, 2])
    assert obv[0] == 0.0
    assert obv[1] == 5.0
    assert obv[2] == 2.0
    assert obv[3] == 2.0
    vwap = extras.vwap([2, 2], [1, 1], [1.5, 1.5], [0, 0], 0)
    assert vwap[0] is None
    vwap2 = extras.vwap([2, 4], [1, 3], [1.5, 3.5], [10, 10], 1)
    assert vwap2[0] is None
    assert vwap2[1] is not None
    mfi_flat = extras.mfi([1] * 20, [1] * 20, [1] * 20, [1] * 20, 5)
    assert mfi_flat[-1] == 0.0
    up = list(range(1, 20))
    mfi_up = extras.mfi(up, up, up, [1] * 19, 5)
    assert mfi_up[-1] == pytest.approx(100.0)
    mixed_h = [1, 3, 2, 5, 4, 6, 3, 8, 7, 9]
    mfi_mix = extras.mfi(mixed_h, mixed_h, mixed_h, [2] * 10, 3)
    assert mfi_mix[-1] is not None
    with pytest.raises(ValueError):
        extras.mfi([1], [1], [1], [1], 0)


def test_psar_and_errors() -> None:
    with pytest.raises(ValueError):
        extras.parabolic_sar([1], [1], [1], step=0, max_step=0.2)
    with pytest.raises(ValueError):
        extras.parabolic_sar([1], [1], [1], step=0.3, max_step=0.2)
    assert extras.parabolic_sar([1], [1], [1], step=0.02, max_step=0.2) == [None]
    up = extras.parabolic_sar(
        [10, 11, 12, 13, 14],
        [9, 10, 11, 12, 13],
        [9.5, 10.5, 11.5, 12.5, 13.5],
        step=0.02,
        max_step=0.2,
    )
    assert up[0] is not None and up[-1] is not None
    down = extras.parabolic_sar(
        [14, 13, 12, 11, 10],
        [13, 12, 11, 10, 9],
        [13.5, 12.5, 11.5, 10.5, 9.5],
        step=0.02,
        max_step=0.2,
    )
    assert down[-1] is not None
    flip = extras.parabolic_sar(
        [10, 12, 14, 8, 7],
        [9, 11, 13, 6, 5],
        [9.5, 11.5, 13.5, 7, 6],
        step=0.02,
        max_step=0.2,
    )
    assert flip[-1] is not None
    flip_up = extras.parabolic_sar(
        [10, 8, 7, 12, 14],
        [9, 7, 6, 11, 13],
        [9.5, 7.5, 6.5, 11.5, 13.5],
        step=0.02,
        max_step=0.2,
    )
    assert flip_up[-1] is not None


def test_ichimoku_fib_vp_dates() -> None:
    highs = [float(i + 2) for i in range(80)]
    lows = [float(i) for i in range(80)]
    closes = [float(i + 1) for i in range(80)]
    cloud = extras.ichimoku(highs, lows, closes, tenkan=9, kijun=26, senkou_b=52, displacement=26)
    assert len(cloud["ichimokuSenkouA"]) == 106
    assert cloud["ichimokuTenkan"][8] is not None
    assert extras.infer_bar_step_days(["2024-01-01"]) == 1
    assert extras.infer_bar_step_days(["2024-01-01", "2024-01-08"]) == 7
    assert extras.infer_bar_step_days(["2024-01-01", "2024-01-02"]) == 1
    nxt = extras.next_dates("2024-01-05", 2, 1)
    assert nxt[0] == "2024-01-08"
    week = extras.next_dates("2024-01-05", 1, 7)
    assert week[0] == "2024-01-12"
    dates = [f"2024-01-{i:02d}" for i in range(1, 6)]
    fib = extras.fibonacci_levels(highs[:5], lows[:5], dates, 0)
    assert fib is not None
    assert fib["levels"][0]["ratio"] == 0.0
    assert extras.fibonacci_levels(highs[:2], lows[:2], dates[:2], 5) is None
    vp = extras.volume_profile(highs[:5], lows[:5], [1, 1, 1, 1, 1], 0, 4)
    assert vp is not None
    assert len(vp["bins"]) == 4
    same = extras.volume_profile([3, 3], [3, 3], [2, 2], 0, 3)
    assert same is not None
    assert len(same["bins"]) == 1
    mixed = extras.volume_profile([5, 3], [1, 3], [10, 4], 0, 4)
    assert mixed is not None
    assert extras.volume_profile([1], [1], [1], 3, 2) is None
    with pytest.raises(ValueError):
        extras.volume_profile([1], [1], [1], 0, 0)
    with pytest.raises(ValueError):
        extras.next_dates("2024-01-01", 0, 1)
    with pytest.raises(ValueError):
        extras.ichimoku(highs, lows, closes, tenkan=0, kijun=26, senkou_b=52, displacement=26)


def test_compute_series_catalog_and_drawings() -> None:
    bars = _ohlc([float(100 + i) for i in range(80)])
    specs = [
        IndicatorSpec(id="sma25", type="sma", params={"period": 25}),
        IndicatorSpec(id="ema50", type="ema", params={"period": 50}),
        IndicatorSpec(id="rsi", type="rsi", params={"period": 14}),
        IndicatorSpec(id="macd", type="macd", params={"fast": 12, "slow": 26, "signal": 9}),
        IndicatorSpec(id="momentum", type="momentum", params={"period": 10}),
        IndicatorSpec(id="roc", type="roc", params={"period": 12}),
        IndicatorSpec(id="cci", type="cci", params={"period": 20}),
        IndicatorSpec(id="stoch", type="stoch", params={"kPeriod": 14, "kSmoothing": 3, "dPeriod": 3}),
        IndicatorSpec(id="willr", type="willr", params={"period": 14}),
        IndicatorSpec(id="psy", type="psy", params={"period": 12}),
        IndicatorSpec(id="bb", type="bb", params={"period": 20, "stdDev": 2}),
        IndicatorSpec(id="atr", type="atr", params={"period": 14}),
        IndicatorSpec(id="stdev", type="stdev", params={"period": 20}),
        IndicatorSpec(
            id="keltner",
            type="keltner",
            params={"emaPeriod": 20, "atrPeriod": 10, "multiplier": 2},
        ),
        IndicatorSpec(id="obv", type="obv", params={}),
        IndicatorSpec(id="vwap", type="vwap", params={}),
        IndicatorSpec(id="mfi", type="mfi", params={"period": 14}),
        IndicatorSpec(id="psar", type="psar", params={"step": 0.02, "maxStep": 0.2}),
        IndicatorSpec(
            id="ichimoku",
            type="ichimoku",
            params={"tenkan": 9, "kijun": 26, "senkouB": 52, "displacement": 26},
        ),
        IndicatorSpec(id="fibonacci", type="fibonacci", params={}),
        IndicatorSpec(id="volumeProfile", type="volumeProfile", params={"bins": 8}),
    ]
    points, drawings = compute_indicator_series(bars, specs, range_start_index=10)
    assert len(points) > 80
    assert drawings is not None
    assert drawings.fibonacci is not None
    assert drawings.volumeProfile is not None
    last = points[79].values
    assert last["sma25"] is not None
    assert last["ichimokuTenkan"] is not None


def test_more_error_and_gap_branches() -> None:
    from app.indicators.extras import _sma_on_nullable

    assert _sma_on_nullable([1.0, None, 2.0, 3.0], 2)[-1] == pytest.approx(2.5)
    with pytest.raises(ValueError):
        extras.stochastic([1], [1], [1], k_period=2, k_smoothing=0, d_period=1)
    with pytest.raises(ValueError):
        extras.stochastic([1], [1], [1], k_period=2, k_smoothing=1, d_period=0)
    with pytest.raises(ValueError):
        extras.parabolic_sar([1], [1], [1], step=0.02, max_step=0)
    with pytest.raises(ValueError):
        extras.ichimoku([1], [1], [1], tenkan=9, kijun=0, senkou_b=52, displacement=26)
    with pytest.raises(ValueError):
        extras.ichimoku([1], [1], [1], tenkan=9, kijun=26, senkou_b=0, displacement=26)
    with pytest.raises(ValueError):
        extras.ichimoku([1], [1], [1], tenkan=9, kijun=26, senkou_b=52, displacement=0)
    two = extras.parabolic_sar([10, 11], [9, 10], [9.5, 10.5], step=0.02, max_step=0.2)
    assert two[1] is not None
    two_down = extras.parabolic_sar([11, 10], [10, 9], [10.5, 9.5], step=0.02, max_step=0.2)
    assert two_down[1] is not None
    ku, km, kl = extras.keltner([1, 2], [1, 2], [1, 2], ema_period=5, atr_period=5, multiplier=2)
    assert km[0] is None and ku[0] is None and kl[0] is None
    points, _ = compute_indicator_series(
        [],
        [
            IndicatorSpec(
                id="ichimoku",
                type="ichimoku",
                params={"tenkan": 9, "kijun": 26, "senkouB": 52, "displacement": 2},
            )
        ],
    )
    assert points == []
    points, drawings = compute_indicator_series(
        [],
        [IndicatorSpec(id="sma25", type="sma", params={"period": 2})],
    )
    assert points == []
    assert drawings is None
    bars = _ohlc([1.0, 2.0])
    points2, drawings2 = compute_indicator_series(
        bars,
        [
            IndicatorSpec(id="fibonacci", type="fibonacci", params={}),
            IndicatorSpec(id="volumeProfile", type="volumeProfile", params={"bins": 4}),
        ],
        range_start_index=10,
    )
    assert drawings2 is None
    assert len(points2) == 2


def test_post_ichimoku_and_drawings() -> None:
    client = TestClient(app)
    bars = [
        {
            "date": f"2024-03-{i:02d}",
            "open": 10 + i,
            "high": 11 + i,
            "low": 9 + i,
            "close": 10.5 + i,
            "volume": 100,
        }
        for i in range(1, 29)
    ]
    response = client.post(
        "/indicators",
        json={
            "bars": bars,
            "rangeStartIndex": 2,
            "indicators": [
                {
                    "id": "ichimoku",
                    "type": "ichimoku",
                    "params": {"tenkan": 9, "kijun": 26, "senkouB": 52, "displacement": 2},
                },
                {"id": "fibonacci", "type": "fibonacci", "params": {}},
                {"id": "volumeProfile", "type": "volumeProfile", "params": {"bins": 6}},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["points"]) == 28 + 2
    assert body["drawings"]["fibonacci"]["high"] > 0
    assert len(body["drawings"]["volumeProfile"]["bins"]) == 6
