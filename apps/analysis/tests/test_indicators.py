"""テクニカル指標の純関数・POST /indicators の単体テスト。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import indicators
from app.main import (
    app,
    compute_indicators,
    _buy_hold_metrics,
    _profit_factor,
    _sharpe_ratio,
)
from app.schemas import (
    BacktestEquityPoint,
    BacktestTrade,
    ComputeIndicatorsRequest,
    IndicatorSpec,
    OhlcBar,
    OptimizeBacktestRequest,
    SignalSpec,
)


def _bars(closes: list[float], start: str = "2024-01-01") -> list[dict[str, float | str]]:
    """テスト用 OHLC JSON（終値だけ意味を持ち、他は同値）。"""
    from datetime import date, timedelta

    base = date.fromisoformat(start)
    out: list[dict[str, float | str]] = []
    for i, close in enumerate(closes):
        d = (base + timedelta(days=i)).isoformat()
        out.append(
            {
                "date": d,
                "open": close,
                "high": close,
                "low": close,
                "close": close,
                "volume": 0,
            }
        )
    return out


def test_sma_known_series() -> None:
    """SMA(3) が既知の平均になること。"""
    closes = [1.0, 2.0, 3.0, 4.0, 5.0]
    result = indicators.sma(closes, 3)
    assert result[0] is None
    assert result[1] is None
    assert result[2] == pytest.approx(2.0)
    assert result[3] == pytest.approx(3.0)
    assert result[4] == pytest.approx(4.0)


def test_sma_rejects_invalid_period() -> None:
    """period < 1 で ValueError。"""
    with pytest.raises(ValueError):
        indicators.sma([1.0], 0)


def test_ema_warmup_and_value() -> None:
    """EMA は period 未満が None、以降は有限値。"""
    closes = [float(i) for i in range(1, 11)]
    result = indicators.ema(closes, 3)
    assert result[0] is None
    assert result[1] is None
    assert result[2] is not None
    assert result[-1] is not None


def test_ema_rejects_invalid_period() -> None:
    with pytest.raises(ValueError):
        indicators.ema([1.0], 0)


def test_rsi_constant_prices() -> None:
    """値動きゼロのとき RSI は 0（gain=loss=0）。"""
    closes = [100.0] * 20
    result = indicators.rsi(closes, 14)
    assert all(v is None for v in result[:14])
    assert result[14] == pytest.approx(0.0)


def test_rsi_monotonic_up() -> None:
    """単調増加なら RSI は 100 に近い。"""
    closes = [float(i) for i in range(1, 30)]
    result = indicators.rsi(closes, 14)
    assert result[14] == pytest.approx(100.0)


def test_rsi_empty_and_short() -> None:
    assert indicators.rsi([], 14) == []
    short = indicators.rsi([1.0, 2.0], 14)
    assert all(v is None for v in short)


def test_rsi_rejects_invalid_period() -> None:
    with pytest.raises(ValueError):
        indicators.rsi([1.0], 0)


def test_macd_shapes() -> None:
    """MACD 3 系列が同じ長さで、slow 以降に値が立つこと。"""
    closes = [float(i) for i in range(1, 60)]
    macd_line, signal, hist = indicators.macd(closes, fast=12, slow=26, signal=9)
    assert len(macd_line) == len(closes)
    assert len(signal) == len(closes)
    assert len(hist) == len(closes)
    assert all(v is None for v in macd_line[:25])
    assert macd_line[25] is not None


def test_macd_rejects_bad_params() -> None:
    with pytest.raises(ValueError):
        indicators.macd([1.0], fast=0, slow=26, signal=9)
    with pytest.raises(ValueError):
        indicators.macd([1.0], fast=26, slow=12, signal=9)


def test_indicator_spec_validation() -> None:
    """未知 type は ValidationError。正規スペックは通る。"""
    with pytest.raises(ValidationError):
        IndicatorSpec(id="sma25", type="nope", params={})  # type: ignore[arg-type]
    ok = IndicatorSpec(id="ema50", type="ema", params={"period": 50})
    assert ok.params["period"] == 50
    macd_ok = IndicatorSpec(id="macd", type="macd", params={"fast": 12, "slow": 26, "signal": 9})
    assert macd_ok.params["fast"] == 12


def test_post_indicators_endpoint() -> None:
    """POST /indicators が SMA を values に返すこと。"""
    client = TestClient(app)
    payload = {
        "bars": _bars([1.0, 2.0, 3.0, 4.0, 5.0]),
        "indicators": [{"id": "sma25", "type": "sma", "params": {"period": 3}}],
    }
    response = client.post("/indicators", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert len(body["points"]) == 5
    assert body["points"][2]["values"]["sma25"] == pytest.approx(2.0)
    assert body["points"][0]["values"]["sma25"] is None


def test_post_indicators_all_types() -> None:
    """4 指標を同時に要求できること。"""
    client = TestClient(app)
    closes = [float(100 + (i % 5)) for i in range(80)]
    payload = {
        "bars": _bars(closes),
        "indicators": [
            {"id": "sma25", "type": "sma", "params": {"period": 20}},
            {"id": "ema50", "type": "ema", "params": {"period": 50}},
            {"id": "rsi", "type": "rsi", "params": {"period": 14}},
            {"id": "macd", "type": "macd", "params": {"fast": 12, "slow": 26, "signal": 9}},
        ],
    }
    response = client.post("/indicators", json=payload)
    assert response.status_code == 200
    last = response.json()["points"][-1]["values"]
    assert last["sma25"] is not None
    assert last["ema50"] is not None
    assert last["rsi"] is not None
    assert last["macd"] is not None
    assert last["macdSignal"] is not None
    assert last["macdHistogram"] is not None


def test_post_indicators_validation_error() -> None:
    """不正ボディは VALIDATION_FAILED。"""
    client = TestClient(app)
    response = client.post("/indicators", json={"bars": [], "indicators": []})
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_FAILED"


def test_post_indicators_empty_bars() -> None:
    """空 bars でも 200 と空 points。"""
    client = TestClient(app)
    response = client.post(
        "/indicators",
        json={"bars": [], "indicators": [{"id": "sma25", "type": "sma", "params": {"period": 5}}]},
    )
    assert response.status_code == 200
    assert response.json()["points"] == []


def test_compute_indicators_direct() -> None:
    """ハンドラを直接呼び出せること（カバレッジ補完）。"""
    bars = [OhlcBar(**b) for b in _bars([1.0, 2.0, 3.0])]
    body = ComputeIndicatorsRequest(
        bars=bars,
        indicators=[IndicatorSpec(id="sma25", type="sma", params={"period": 2})],
    )
    result = compute_indicators(body)
    assert len(result.points) == 3
    assert result.points[1].values["sma25"] == pytest.approx(1.5)


def test_post_signals_compute_sma_cross() -> None:
    """SMAクロス戦略で buy/sell シグナルを返す。"""
    client = TestClient(app)
    payload = {
        "bars": _bars([1.0, 1.0, 1.0, 2.0, 2.0, 1.0]),
        "signal": {"strategyType": "smaCross", "shortPeriod": 2, "longPeriod": 3},
    }
    response = client.post("/signals/compute", json=payload)
    assert response.status_code == 200
    points = response.json()["points"]
    assert len(points) == 6
    assert any(point["buy"] for point in points)
    assert any(point["sell"] for point in points)


def test_post_signals_compute_rsi() -> None:
    """RSIしきい値戦略で bool シグナル配列を返す。"""
    client = TestClient(app)
    closes = [100.0] * 20
    response = client.post(
        "/signals/compute",
        json={
            "bars": _bars(closes),
            "signal": {"strategyType": "rsiThreshold", "period": 14, "lower": 30, "upper": 70},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["points"]) == len(closes)
    assert body["points"][14]["buy"] is True


def test_post_signals_compute_macd() -> None:
    """MACDクロス戦略が計算可能。"""
    client = TestClient(app)
    closes = [float(100 + (i % 7)) for i in range(100)]
    response = client.post(
        "/signals/compute",
        json={
            "bars": _bars(closes),
            "signal": {"strategyType": "macdCross", "fast": 12, "slow": 26, "signal": 9},
        },
    )
    assert response.status_code == 200
    assert len(response.json()["points"]) == len(closes)


def test_post_signals_validation_error() -> None:
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/signals/compute",
        json={"bars": [], "signal": {"strategyType": "unknown"}},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_FAILED"


def test_signal_spec_validation_for_thresholds() -> None:
    with pytest.raises(ValidationError):
        SignalSpec(strategyType="rsiThreshold", period=14, lower=80, upper=20)
    with pytest.raises(ValidationError):
        SignalSpec(strategyType="smaCross")
    with pytest.raises(ValidationError):
        SignalSpec(strategyType="smaCross", shortPeriod=0, longPeriod=5)
    with pytest.raises(ValidationError):
        SignalSpec(strategyType="smaCross", shortPeriod=10, longPeriod=5)
    with pytest.raises(ValidationError):
        SignalSpec(strategyType="rsiThreshold")
    with pytest.raises(ValidationError):
        SignalSpec(strategyType="rsiThreshold", period=0, lower=10, upper=90)
    with pytest.raises(ValidationError):
        SignalSpec(strategyType="macdCross")
    with pytest.raises(ValidationError):
        SignalSpec(strategyType="macdCross", fast=0, slow=26, signal=9)
    with pytest.raises(ValidationError):
        SignalSpec(strategyType="macdCross", fast=26, slow=12, signal=9)


def test_post_backtests_run_with_trade() -> None:
    """エントリー/エグジットが発生するケース。"""
    client = TestClient(app)
    payload = {
        "symbolId": "sym_1",
        "bars": _bars([1.0, 1.0, 1.0, 2.0, 2.0, 1.0]),
        "signal": {"strategyType": "smaCross", "shortPeriod": 2, "longPeriod": 3},
        "initialCash": 10000,
        "feeRate": 0.001,
        "slippageRate": 0.001,
    }
    response = client.post("/backtests/run", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["totalTrades"] >= 1
    assert len(body["equityPoints"]) == 6
    summary = body["summary"]
    assert "sharpeRatio" in summary
    assert "profitFactor" in summary
    assert "buyHoldReturnRate" in summary
    assert "buyHoldFinalEquity" in summary
    # Buy & Hold: 1.0 → 1.0 なのでリターン 0
    assert summary["buyHoldFinalEquity"] == 10000.0
    assert summary["buyHoldReturnRate"] == 0.0


def test_post_backtests_run_without_trade() -> None:
    """シグナルが発生しないとトレード0件。"""
    client = TestClient(app)
    payload = {
        "symbolId": "sym_1",
        "bars": _bars([100.0] * 10),
        "signal": {"strategyType": "rsiThreshold", "period": 14, "lower": 0, "upper": 100},
        "initialCash": 10000,
        "feeRate": 0.0,
        "slippageRate": 0.0,
    }
    response = client.post("/backtests/run", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["totalTrades"] == 0
    assert body["summary"]["winRate"] == 0
    assert body["summary"]["profitFactor"] == 0
    assert body["summary"]["sharpeRatio"] == 0
    assert body["summary"]["buyHoldReturnRate"] == 0.0


def test_post_backtests_run_force_close_at_end() -> None:
    """最終日に未決済ならクローズされる。"""
    client = TestClient(app)
    payload = {
        "symbolId": "sym_1",
        "bars": _bars([1.0, 1.0, 1.0, 2.0, 3.0, 4.0]),
        "signal": {"strategyType": "smaCross", "shortPeriod": 2, "longPeriod": 3},
        "initialCash": 10000,
        "feeRate": 0.0,
        "slippageRate": 0.0,
    }
    response = client.post("/backtests/run", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["totalTrades"] >= 1
    assert body["equityPoints"][-1]["positionValue"] == 0
    # Buy & Hold: 1 → 4 で 4 倍
    assert body["summary"]["buyHoldFinalEquity"] == 40000.0
    assert body["summary"]["buyHoldReturnRate"] == 3.0


def test_post_backtests_run_buy_hold_metrics() -> None:
    """Buy&Hold は初日→末日の終値比で算出する。"""
    client = TestClient(app)
    payload = {
        "symbolId": "sym_1",
        "bars": _bars([1.0, 1.0, 1.0, 2.0, 3.0, 4.0]),
        "signal": {"strategyType": "smaCross", "shortPeriod": 2, "longPeriod": 3},
        "initialCash": 1000,
        "feeRate": 0.0,
        "slippageRate": 0.0,
    }
    response = client.post("/backtests/run", json=payload)
    assert response.status_code == 200
    summary = response.json()["summary"]
    assert summary["buyHoldFinalEquity"] == 4000.0
    assert summary["buyHoldReturnRate"] == 3.0
    assert isinstance(summary["sharpeRatio"], float)
    assert isinstance(summary["profitFactor"], float)


def test_post_backtests_optimize_sma_grid() -> None:
    """SMA 総当たりが short < long のみ返し、リターン降順になる。"""
    client = TestClient(app)
    payload = {
        "symbolId": "sym_1",
        "bars": _bars([1.0, 1.0, 1.0, 2.0, 3.0, 2.0, 4.0, 5.0, 4.0, 6.0]),
        "initialCash": 10000,
        "feeRate": 0.0,
        "slippageRate": 0.0,
        "shortMin": 2,
        "shortMax": 3,
        "longMin": 3,
        "longMax": 4,
    }
    response = client.post("/backtests/optimize", json=payload)
    assert response.status_code == 200
    results = response.json()["results"]
    # (2,3), (2,4), (3,4) の 3 組
    assert len(results) == 3
    pairs = {(item["shortPeriod"], item["longPeriod"]) for item in results}
    assert pairs == {(2, 3), (2, 4), (3, 4)}
    returns = [item["summary"]["totalReturnRate"] for item in results]
    assert returns == sorted(returns, reverse=True)


def test_optimize_backtest_request_validation() -> None:
    """最適化レンジの検証（shortMin>shortMax / longMin>longMax）。"""
    with pytest.raises(ValidationError):
        OptimizeBacktestRequest(
            symbolId="sym_1",
            bars=[],
            initialCash=10000,
            feeRate=0.0,
            slippageRate=0.0,
            shortMin=10,
            shortMax=5,
        )
    with pytest.raises(ValidationError):
        OptimizeBacktestRequest(
            symbolId="sym_1",
            bars=[],
            initialCash=10000,
            feeRate=0.0,
            slippageRate=0.0,
            longMin=40,
            longMax=10,
        )


def test_backtest_helper_edge_cases() -> None:
    """Buy&Hold / Sharpe / ProfitFactor の境界。"""
    assert _buy_hold_metrics(initial_cash=1000, closes=[]) == (1000, 0.0)
    assert _buy_hold_metrics(initial_cash=1000, closes=[0.0, 10.0]) == (1000, 0.0)
    assert _sharpe_ratio([]) == 0.0
    assert _sharpe_ratio(
        [
            BacktestEquityPoint(date="2026-01-01", cash=0, positionValue=0, equity=0, drawdownRate=0),
            BacktestEquityPoint(date="2026-01-02", cash=100, positionValue=0, equity=100, drawdownRate=0),
        ]
    ) == 0.0  # prev.equity == 0 の日は return 0、その後の分散次第だが少なくとも例外なし

    # 負けトレードのみ → profitFactor 0
    losing = BacktestTrade(
        symbolId="s",
        entryDate="2026-01-01",
        exitDate="2026-01-02",
        entryPrice=10,
        exitPrice=5,
        quantity=1,
        side="buy",
        grossPnl=-5,
        feeAmount=0,
        slippageAmount=0,
        netPnl=-5,
    )
    assert _profit_factor([losing]) == 0.0

    # 勝ちと負け
    winning = BacktestTrade(
        symbolId="s",
        entryDate="2026-01-01",
        exitDate="2026-01-02",
        entryPrice=5,
        exitPrice=15,
        quantity=1,
        side="buy",
        grossPnl=10,
        feeAmount=0,
        slippageAmount=0,
        netPnl=10,
    )
    assert _profit_factor([winning, losing]) == 2.0

    # 勝ちのみ → 勝ち合計
    assert _profit_factor([winning]) == 10.0

    # エクイティ変動あり → 非ゼロ Sharpe
    points = [
        BacktestEquityPoint(date="2026-01-01", cash=100, positionValue=0, equity=100, drawdownRate=0),
        BacktestEquityPoint(date="2026-01-02", cash=110, positionValue=0, equity=110, drawdownRate=0),
        BacktestEquityPoint(date="2026-01-03", cash=105, positionValue=0, equity=105, drawdownRate=0),
    ]
    assert _sharpe_ratio(points) != 0.0

    # initial_cash == 0 の Buy&Hold
    assert _buy_hold_metrics(initial_cash=0.0, closes=[1.0, 2.0]) == (0.0, 0.0)
