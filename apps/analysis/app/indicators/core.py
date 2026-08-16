"""
SMA / EMA / RSI / MACD の純関数。

シグナル・バックテストからも使うため、カタログ拡張後もこのモジュールに残す。
pandas / numpy のみ。ウォームアップ不足は None。
"""

from __future__ import annotations

from typing import Sequence

import numpy as np
import pandas as pd


def sma(closes: Sequence[float], period: int) -> list[float | None]:
    """単純移動平均。先頭 period-1 本は None。"""
    if period < 1:
        raise ValueError("period must be >= 1")
    series = pd.Series(closes, dtype="float64")
    rolled = series.rolling(window=period, min_periods=period).mean()
    return to_nullable_list(rolled)


def ema(closes: Sequence[float], period: int) -> list[float | None]:
    """指数移動平均（再帰 EMA、span=period）。先頭 period-1 本は None。"""
    if period < 1:
        raise ValueError("period must be >= 1")
    series = pd.Series(closes, dtype="float64")
    values = series.ewm(span=period, adjust=False, min_periods=period).mean()
    return to_nullable_list(values)


def rsi(closes: Sequence[float], period: int) -> list[float | None]:
    """
    RSI（Wilder 平滑）。

    最初の平均 gain/loss は単純平均、以降は Wilder の平滑化。
    有効値が得られるのは index >= period（差分が period 本揃うため）。
    """
    if period < 1:
        raise ValueError("period must be >= 1")
    if len(closes) == 0:
        return []

    arr = np.asarray(closes, dtype="float64")
    deltas = np.diff(arr, prepend=np.nan)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    result: list[float | None] = [None] * len(closes)
    if len(closes) <= period:
        return result

    avg_gain = float(np.mean(gains[1 : period + 1]))
    avg_loss = float(np.mean(losses[1 : period + 1]))
    result[period] = rsi_from_averages(avg_gain, avg_loss)

    for i in range(period + 1, len(closes)):
        avg_gain = (avg_gain * (period - 1) + float(gains[i])) / period
        avg_loss = (avg_loss * (period - 1) + float(losses[i])) / period
        result[i] = rsi_from_averages(avg_gain, avg_loss)

    return result


def macd(
    closes: Sequence[float],
    *,
    fast: int,
    slow: int,
    signal: int,
) -> tuple[list[float | None], list[float | None], list[float | None]]:
    """MACD ライン・シグナル・ヒストグラム。"""
    if fast < 1 or slow < 1 or signal < 1:
        raise ValueError("fast, slow, signal must be >= 1")
    if fast >= slow:
        raise ValueError("fast must be < slow")

    fast_ema = ema(closes, fast)
    slow_ema = ema(closes, slow)

    macd_line: list[float | None] = []
    for f, s in zip(fast_ema, slow_ema, strict=True):
        if f is None or s is None:
            macd_line.append(None)
        else:
            macd_line.append(f - s)

    signal_line = ema_on_nullable(macd_line, signal)
    histogram: list[float | None] = []
    for m, sig in zip(macd_line, signal_line, strict=True):
        if m is None or sig is None:
            histogram.append(None)
        else:
            histogram.append(m - sig)

    return macd_line, signal_line, histogram


def rsi_from_averages(avg_gain: float, avg_loss: float) -> float:
    """平均 gain/loss から RSI 値（0〜100）を求める。"""
    if avg_loss == 0.0:
        return 100.0 if avg_gain > 0.0 else 0.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def ema_on_nullable(values: Sequence[float | None], period: int) -> list[float | None]:
    """None を含む系列に対する EMA。有効観測が period 未満の間は None。"""
    result: list[float | None] = [None] * len(values)
    alpha = 2.0 / (period + 1.0)
    ema_value: float | None = None
    seen = 0

    for i, value in enumerate(values):
        if value is None:
            continue
        seen += 1
        if ema_value is None:
            ema_value = value
        else:
            ema_value = alpha * value + (1.0 - alpha) * ema_value
        if seen >= period:
            result[i] = ema_value

    return result


def to_nullable_list(series: pd.Series) -> list[float | None]:
    """pandas Series を list[float | None] に変換する（NaN → None）。"""
    out: list[float | None] = []
    for value in series.tolist():
        if value is None or (isinstance(value, float) and np.isnan(value)):
            out.append(None)
        else:
            out.append(float(value))
    return out
