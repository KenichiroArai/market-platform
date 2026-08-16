"""
カタログ ID ごとの指標計算を points.values / drawings に書き込む。
"""

from __future__ import annotations

import app.indicators.extras as extras
from app.indicators.core import ema, macd, rsi, sma
from app.schemas import (
    FibonacciDrawing,
    IndicatorDrawings,
    IndicatorSeriesPoint,
    IndicatorSpec,
    OhlcBar,
    VolumeProfileBin,
    VolumeProfileDrawing,
)


def compute_indicator_series(
    bars: list[OhlcBar],
    specs: list[IndicatorSpec],
    range_start_index: int = 0,
) -> tuple[list[IndicatorSeriesPoint], IndicatorDrawings | None]:
    """
    OHLC 配列に対して要求された指標を計算する。

    一目があるときは先行スパン用の未来日付を points 末尾に足す。
    VWAP / フィボ / VP は range_start_index 以降だけを使う。
    """
    dates = [bar.date for bar in bars]
    highs = [bar.high for bar in bars]
    lows = [bar.low for bar in bars]
    closes = [bar.close for bar in bars]
    volumes = [bar.volume for bar in bars]
    n = len(bars)
    start = max(0, range_start_index)

    future = 0
    for spec in specs:
        if spec.type == "ichimoku":
            future = max(future, int(spec.params.get("displacement", 26)))

    extra_dates: list[str] = []
    if future > 0 and n > 0:
        extra_dates = extras.next_dates(dates[-1], future, extras.infer_bar_step_days(dates))

    points = [IndicatorSeriesPoint(date=d, values={}) for d in dates + extra_dates]
    drawings = IndicatorDrawings()
    has_drawing = False

    for spec in specs:
        if _apply_spec(
            spec,
            points,
            highs=highs,
            lows=lows,
            closes=closes,
            volumes=volumes,
            dates=dates,
            start=start,
            drawings=drawings,
        ):
            has_drawing = True

    return points, drawings if has_drawing else None


def _apply_spec(
    spec: IndicatorSpec,
    points: list[IndicatorSeriesPoint],
    *,
    highs: list[float],
    lows: list[float],
    closes: list[float],
    volumes: list[float],
    dates: list[str],
    start: int,
    drawings: IndicatorDrawings,
) -> bool:
    """1 スペックを points / drawings に反映する。drawings を書いたら True。"""
    params = spec.params
    kind = spec.type

    if kind == "sma":
        _write(points, spec.id, sma(closes, int(params.get("period", 25))))
    elif kind == "ema":
        _write(points, spec.id, ema(closes, int(params.get("period", 50))))
    elif kind == "rsi":
        _write(points, "rsi", rsi(closes, int(params.get("period", 14))))
    elif kind == "macd":
        line, signal, hist = macd(
            closes,
            fast=int(params.get("fast", 12)),
            slow=int(params.get("slow", 26)),
            signal=int(params.get("signal", 9)),
        )
        _write(points, "macd", line)
        _write(points, "macdSignal", signal)
        _write(points, "macdHistogram", hist)
    elif kind == "momentum":
        _write(points, "momentum", extras.momentum(closes, int(params.get("period", 10))))
    elif kind == "roc":
        _write(points, "roc", extras.roc(closes, int(params.get("period", 12))))
    elif kind == "cci":
        _write(points, "cci", extras.cci(highs, lows, closes, int(params.get("period", 20))))
    elif kind == "stoch":
        k_line, d_line = extras.stochastic(
            highs,
            lows,
            closes,
            k_period=int(params.get("kPeriod", 14)),
            k_smoothing=int(params.get("kSmoothing", 3)),
            d_period=int(params.get("dPeriod", 3)),
        )
        _write(points, "stochK", k_line)
        _write(points, "stochD", d_line)
    elif kind == "willr":
        _write(points, "willr", extras.williams_r(highs, lows, closes, int(params.get("period", 14))))
    elif kind == "psy":
        _write(points, "psy", extras.psychological(closes, int(params.get("period", 12))))
    elif kind == "bb":
        upper, mid, lower = extras.bollinger(
            closes,
            int(params.get("period", 20)),
            float(params.get("stdDev", 2)),
        )
        _write(points, "bbUpper", upper)
        _write(points, "bbMiddle", mid)
        _write(points, "bbLower", lower)
    elif kind == "atr":
        _write(points, "atr", extras.atr(highs, lows, closes, int(params.get("period", 14))))
    elif kind == "stdev":
        _write(points, "stdev", extras.stdev(closes, int(params.get("period", 20))))
    elif kind == "keltner":
        upper, mid, lower = extras.keltner(
            highs,
            lows,
            closes,
            ema_period=int(params.get("emaPeriod", 20)),
            atr_period=int(params.get("atrPeriod", 10)),
            multiplier=float(params.get("multiplier", 2)),
        )
        _write(points, "keltnerUpper", upper)
        _write(points, "keltnerMiddle", mid)
        _write(points, "keltnerLower", lower)
    elif kind == "obv":
        _write(points, "obv", extras.obv(closes, volumes))
    elif kind == "vwap":
        _write(points, "vwap", extras.vwap(highs, lows, closes, volumes, start))
    elif kind == "mfi":
        _write(points, "mfi", extras.mfi(highs, lows, closes, volumes, int(params.get("period", 14))))
    elif kind == "psar":
        _write(
            points,
            "psar",
            extras.parabolic_sar(
                highs,
                lows,
                closes,
                step=float(params.get("step", 0.02)),
                max_step=float(params.get("maxStep", 0.2)),
            ),
        )
    elif kind == "ichimoku":
        series = extras.ichimoku(
            highs,
            lows,
            closes,
            tenkan=int(params.get("tenkan", 9)),
            kijun=int(params.get("kijun", 26)),
            senkou_b=int(params.get("senkouB", 52)),
            displacement=int(params.get("displacement", 26)),
        )
        for key, values in series.items():
            _write(points, key, values)
    elif kind == "fibonacci":
        raw = extras.fibonacci_levels(highs, lows, dates, start)
        if raw is not None:
            drawings.fibonacci = FibonacciDrawing.model_validate(raw)
            return True
    else:
        raw = extras.volume_profile(highs, lows, volumes, start, int(params.get("bins", 24)))
        if raw is not None:
            drawings.volumeProfile = VolumeProfileDrawing(
                bins=[VolumeProfileBin.model_validate(row) for row in raw["bins"]],
            )
            return True
    return False


def _write(
    points: list[IndicatorSeriesPoint],
    key: str,
    values: list[float | None],
) -> None:
    """values を points.values[key] にコピーする。points より長い分は切る。"""
    for i, value in enumerate(values):
        if i >= len(points):
            break
        points[i].values[key] = value
