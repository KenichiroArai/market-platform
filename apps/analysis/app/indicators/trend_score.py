"""
トレンドスコアの組み立て（ADR 007）。

正本セットの指標を計算し、日足ごとに採点して総合スコアを返す。
一目の未来点はスコアに含めない。
"""

from __future__ import annotations

from app.indicators.compute import compute_indicator_series
from app.indicators.score import (
    cci_score,
    fibonacci_score,
    ichimoku_score,
    ma_score,
    macd_score,
    mfi_score,
    momentum_score,
    obv_score,
    percent_b_score,
    poc_price,
    psar_score,
    roc_score,
    rsi_like_score,
    rolling_sma,
    trend_sign,
    volatility_strength_score,
    volume_bar_score,
    willr_score,
    aggregate_scores,
)
from app.schemas import IndicatorSpec, OhlcBar, TrendScorePoint

ICHIMOKU_DISPLACEMENT = 26
VOLUME_SMA_PERIOD = 20
ATR_SMA_PERIOD = 14
STDEV_SMA_PERIOD = 20
OBV_SMA_PERIOD = 20

# カタログ既定と揃えた採点用スペック。volume / elliott は計算 API に送らない。
TREND_SCORE_SPECS: list[IndicatorSpec] = [
    IndicatorSpec(id="sma25", type="sma", params={"period": 25}),
    IndicatorSpec(id="sma75", type="sma", params={"period": 75}),
    IndicatorSpec(id="sma200", type="sma", params={"period": 200}),
    IndicatorSpec(id="ema50", type="ema", params={"period": 50}),
    IndicatorSpec(id="macd", type="macd", params={"fast": 12, "slow": 26, "signal": 9}),
    IndicatorSpec(id="ichimoku", type="ichimoku", params={"tenkan": 9, "kijun": 26, "senkouB": 52, "displacement": 26}),
    IndicatorSpec(id="psar", type="psar", params={"step": 0.02, "maxStep": 0.2}),
    IndicatorSpec(id="momentum", type="momentum", params={"period": 10}),
    IndicatorSpec(id="roc", type="roc", params={"period": 12}),
    IndicatorSpec(id="rsi", type="rsi", params={"period": 14}),
    IndicatorSpec(id="cci", type="cci", params={"period": 20}),
    IndicatorSpec(id="stoch", type="stoch", params={"kPeriod": 14, "kSmoothing": 3, "dPeriod": 3}),
    IndicatorSpec(id="willr", type="willr", params={"period": 14}),
    IndicatorSpec(id="psy", type="psy", params={"period": 12}),
    IndicatorSpec(id="bb", type="bb", params={"period": 20, "stdDev": 2}),
    IndicatorSpec(id="atr", type="atr", params={"period": 14}),
    IndicatorSpec(id="stdev", type="stdev", params={"period": 20}),
    IndicatorSpec(id="keltner", type="keltner", params={"emaPeriod": 20, "atrPeriod": 10, "multiplier": 2}),
    IndicatorSpec(id="obv", type="obv", params={}),
    IndicatorSpec(id="vwap", type="vwap", params={}),
    IndicatorSpec(id="mfi", type="mfi", params={"period": 14}),
    IndicatorSpec(id="volumeProfile", type="volumeProfile", params={"bins": 24}),
    IndicatorSpec(id="fibonacci", type="fibonacci", params={}),
]


def compute_trend_score(bars: list[OhlcBar], range_start_index: int = 0) -> list[TrendScorePoint]:
    """
    OHLC 配列に対して日足ごとのトレンドスコアを返す。

    空配列なら空。range_start_index は VWAP / フィボ / VP の表示期間始点。
    """
    if len(bars) == 0:
        return []

    start = max(0, range_start_index)
    points, drawings = compute_indicator_series(bars, TREND_SCORE_SPECS, range_start_index=start)
    n = len(bars)
    closes = [bar.close for bar in bars]
    opens = [bar.open for bar in bars]
    volumes = [bar.volume for bar in bars]

    atr_series = [points[i].values.get("atr") for i in range(n)]
    stdev_series = [points[i].values.get("stdev") for i in range(n)]
    obv_series = [points[i].values.get("obv") for i in range(n)]
    atr_sma = rolling_sma(atr_series, ATR_SMA_PERIOD)
    stdev_sma = rolling_sma(stdev_series, STDEV_SMA_PERIOD)
    obv_sma = rolling_sma(obv_series, OBV_SMA_PERIOD)
    vol_sma = rolling_sma(volumes, VOLUME_SMA_PERIOD)

    fib_high: float | None = None
    fib_low: float | None = None
    if drawings is not None and drawings.fibonacci is not None:
        fib_high = drawings.fibonacci.high
        fib_low = drawings.fibonacci.low

    poc: float | None = None
    if drawings is not None and drawings.volumeProfile is not None:
        poc = poc_price(drawings.volumeProfile.bins)

    out: list[TrendScorePoint] = []
    for i in range(n):
        values = points[i].values
        close = closes[i]
        sma25 = values.get("sma25")
        direction = trend_sign(close, sma25)
        past_close = closes[i - ICHIMOKU_DISPLACEMENT] if i >= ICHIMOKU_DISPLACEMENT else None

        indicator_scores: dict[str, float | None] = {
            "sma25": ma_score(close, sma25),
            "sma75": ma_score(close, values.get("sma75")),
            "sma200": ma_score(close, values.get("sma200")),
            "ema50": ma_score(close, values.get("ema50")),
            "macd": macd_score(
                close,
                values.get("macd"),
                values.get("macdSignal"),
                values.get("macdHistogram"),
            ),
            "ichimoku": ichimoku_score(
                close,
                values.get("ichimokuTenkan"),
                values.get("ichimokuKijun"),
                values.get("ichimokuSenkouA"),
                values.get("ichimokuSenkouB"),
                past_close,
            ),
            "psar": psar_score(close, values.get("psar")),
            "momentum": momentum_score(close, values.get("momentum")),
            "roc": roc_score(values.get("roc")),
            "rsi": rsi_like_score(values.get("rsi")),
            "cci": cci_score(values.get("cci")),
            "stoch": rsi_like_score(values.get("stochK")),
            "willr": willr_score(values.get("willr")),
            "psy": rsi_like_score(values.get("psy")),
            "bb": percent_b_score(close, values.get("bbUpper"), values.get("bbLower")),
            "atr": volatility_strength_score(atr_series[i], atr_sma[i], direction),
            "stdev": volatility_strength_score(stdev_series[i], stdev_sma[i], direction),
            "keltner": percent_b_score(close, values.get("keltnerUpper"), values.get("keltnerLower")),
            "volume": volume_bar_score(close, opens[i], volumes[i], vol_sma[i]),
            "obv": obv_score(obv_series[i], obv_sma[i]),
            "vwap": ma_score(close, values.get("vwap")),
            "mfi": mfi_score(values.get("mfi")),
            "volumeProfile": ma_score(close, poc) if i >= start else None,
            "fibonacci": (
                fibonacci_score(close, fib_high, fib_low)
                if i >= start and fib_high is not None and fib_low is not None
                else None
            ),
        }

        total, groups = aggregate_scores(indicator_scores)
        out.append(
            TrendScorePoint(
                date=bars[i].date,
                score=total,
                groups=groups,
                indicators=indicator_scores,
            )
        )
    return out
