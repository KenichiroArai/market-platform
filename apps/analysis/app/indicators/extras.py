"""
カタログ拡張指標の純関数（ADR 006）。

OHLC + volume を使う。TA-Lib には依存しない。
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Sequence

from app.indicators.core import ema, to_nullable_list
import pandas as pd


def _require_positive(name: str, value: int | float) -> None:
    if value < 1:
        raise ValueError(f"{name} must be >= 1")


def typical_price(highs: Sequence[float], lows: Sequence[float], closes: Sequence[float]) -> list[float]:
    """Typical Price = (H + L + C) / 3。"""
    return [(float(h) + float(l) + float(c)) / 3.0 for h, l, c in zip(highs, lows, closes, strict=True)]


def momentum(closes: Sequence[float], period: int) -> list[float | None]:
    """終値 − N 本前の終値。"""
    _require_positive("period", period)
    result: list[float | None] = [None] * len(closes)
    for i in range(period, len(closes)):
        result[i] = float(closes[i]) - float(closes[i - period])
    return result


def roc(closes: Sequence[float], period: int) -> list[float | None]:
    """Rate of Change（%）。分母 0 は None。"""
    _require_positive("period", period)
    result: list[float | None] = [None] * len(closes)
    for i in range(period, len(closes)):
        prev = float(closes[i - period])
        if prev == 0.0:
            result[i] = None
        else:
            result[i] = (float(closes[i]) - prev) / prev * 100.0
    return result


def cci(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
    period: int,
) -> list[float | None]:
    """Commodity Channel Index。MAD が 0 なら 0。"""
    _require_positive("period", period)
    tps = typical_price(highs, lows, closes)
    result: list[float | None] = [None] * len(tps)
    for i in range(period - 1, len(tps)):
        window = tps[i - period + 1 : i + 1]
        mean = sum(window) / period
        mad = sum(abs(v - mean) for v in window) / period
        if mad == 0.0:
            result[i] = 0.0
        else:
            result[i] = (tps[i] - mean) / (0.015 * mad)
    return result


def stochastic(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
    *,
    k_period: int,
    k_smoothing: int,
    d_period: int,
) -> tuple[list[float | None], list[float | None]]:
    """%K / %D。レンジ 0 のときは %K=50。"""
    _require_positive("k_period", k_period)
    _require_positive("k_smoothing", k_smoothing)
    _require_positive("d_period", d_period)
    raw_k: list[float | None] = [None] * len(closes)
    for i in range(k_period - 1, len(closes)):
        window_h = highs[i - k_period + 1 : i + 1]
        window_l = lows[i - k_period + 1 : i + 1]
        highest = max(window_h)
        lowest = min(window_l)
        span = highest - lowest
        if span == 0.0:
            raw_k[i] = 50.0
        else:
            raw_k[i] = 100.0 * (float(closes[i]) - lowest) / span
    k_line = _sma_on_nullable(raw_k, k_smoothing)
    d_line = _sma_on_nullable(k_line, d_period)
    return k_line, d_line


def williams_r(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
    period: int,
) -> list[float | None]:
    """Williams %R。レンジ 0 なら -50。"""
    _require_positive("period", period)
    result: list[float | None] = [None] * len(closes)
    for i in range(period - 1, len(closes)):
        highest = max(highs[i - period + 1 : i + 1])
        lowest = min(lows[i - period + 1 : i + 1])
        span = highest - lowest
        if span == 0.0:
            result[i] = -50.0
        else:
            result[i] = -100.0 * (highest - float(closes[i])) / span
    return result


def psychological(closes: Sequence[float], period: int) -> list[float | None]:
    """直近 period 本のうち陽線（終値 > 前日終値）の割合。"""
    _require_positive("period", period)
    result: list[float | None] = [None] * len(closes)
    if len(closes) < period + 1:
        return result
    ups = [0] * len(closes)
    for i in range(1, len(closes)):
        ups[i] = 1 if float(closes[i]) > float(closes[i - 1]) else 0
    for i in range(period, len(closes)):
        result[i] = sum(ups[i - period + 1 : i + 1]) / period * 100.0
    return result


def bollinger(
    closes: Sequence[float],
    period: int,
    std_dev: float,
) -> tuple[list[float | None], list[float | None], list[float | None]]:
    """中心 SMA と ±kσ（母集団、ddof=0）。"""
    _require_positive("period", period)
    if std_dev <= 0:
        raise ValueError("std_dev must be > 0")
    series = pd.Series(closes, dtype="float64")
    mid = series.rolling(window=period, min_periods=period).mean()
    std = series.rolling(window=period, min_periods=period).std(ddof=0)
    upper = mid + std_dev * std
    lower = mid - std_dev * std
    return to_nullable_list(upper), to_nullable_list(mid), to_nullable_list(lower)


def true_range(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
) -> list[float]:
    """True Range。先頭は high-low。"""
    result: list[float] = []
    prev_close: float | None = None
    for high, low, close in zip(highs, lows, closes, strict=True):
        hl = float(high) - float(low)
        if prev_close is None:
            result.append(hl)
        else:
            result.append(max(hl, abs(float(high) - prev_close), abs(float(low) - prev_close)))
        prev_close = float(close)
    return result


def atr(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
    period: int,
) -> list[float | None]:
    """Average True Range（Wilder）。"""
    _require_positive("period", period)
    tr = true_range(highs, lows, closes)
    result: list[float | None] = [None] * len(tr)
    if len(tr) < period:
        return result
    avg = sum(tr[:period]) / period
    result[period - 1] = avg
    for i in range(period, len(tr)):
        avg = (avg * (period - 1) + tr[i]) / period
        result[i] = avg
    return result


def stdev(closes: Sequence[float], period: int) -> list[float | None]:
    """終値のローリング標準偏差（ddof=0）。"""
    _require_positive("period", period)
    series = pd.Series(closes, dtype="float64")
    rolled = series.rolling(window=period, min_periods=period).std(ddof=0)
    return to_nullable_list(rolled)


def keltner(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
    *,
    ema_period: int,
    atr_period: int,
    multiplier: float,
) -> tuple[list[float | None], list[float | None], list[float | None]]:
    """EMA ± ATR × 乗数。"""
    _require_positive("ema_period", ema_period)
    _require_positive("atr_period", atr_period)
    if multiplier <= 0:
        raise ValueError("multiplier must be > 0")
    mid = ema(closes, ema_period)
    ranges = atr(highs, lows, closes, atr_period)
    upper: list[float | None] = []
    lower: list[float | None] = []
    for m, a in zip(mid, ranges, strict=True):
        if m is None or a is None:
            upper.append(None)
            lower.append(None)
        else:
            upper.append(m + multiplier * a)
            lower.append(m - multiplier * a)
    return upper, mid, lower


def obv(closes: Sequence[float], volumes: Sequence[float]) -> list[float | None]:
    """On Balance Volume。先頭は 0。"""
    result: list[float | None] = [None] * len(closes)
    if len(closes) == 0:
        return result
    total = 0.0
    result[0] = 0.0
    for i in range(1, len(closes)):
        if float(closes[i]) > float(closes[i - 1]):
            total += float(volumes[i])
        elif float(closes[i]) < float(closes[i - 1]):
            total -= float(volumes[i])
        result[i] = total
    return result


def vwap(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
    volumes: Sequence[float],
    range_start: int,
) -> list[float | None]:
    """表示期間始点からの累積 VWAP。"""
    tps = typical_price(highs, lows, closes)
    result: list[float | None] = [None] * len(closes)
    start = max(0, range_start)
    cum_tpv = 0.0
    cum_vol = 0.0
    for i in range(start, len(closes)):
        cum_tpv += tps[i] * float(volumes[i])
        cum_vol += float(volumes[i])
        if cum_vol == 0.0:
            result[i] = None
        else:
            result[i] = cum_tpv / cum_vol
    return result


def mfi(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
    volumes: Sequence[float],
    period: int,
) -> list[float | None]:
    """Money Flow Index。"""
    _require_positive("period", period)
    tps = typical_price(highs, lows, closes)
    result: list[float | None] = [None] * len(closes)
    pos = [0.0] * len(closes)
    neg = [0.0] * len(closes)
    for i in range(1, len(tps)):
        flow = tps[i] * float(volumes[i])
        if tps[i] > tps[i - 1]:
            pos[i] = flow
        elif tps[i] < tps[i - 1]:
            neg[i] = flow
    for i in range(period, len(closes)):
        pos_sum = sum(pos[i - period + 1 : i + 1])
        neg_sum = sum(neg[i - period + 1 : i + 1])
        if neg_sum == 0.0:
            result[i] = 100.0 if pos_sum > 0.0 else 0.0
        else:
            result[i] = 100.0 - (100.0 / (1.0 + pos_sum / neg_sum))
    return result


def parabolic_sar(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
    *,
    step: float,
    max_step: float,
) -> list[float | None]:
    """パラボリック SAR。"""
    if step <= 0 or max_step <= 0:
        raise ValueError("step and max_step must be > 0")
    if step > max_step:
        raise ValueError("step must be <= max_step")
    n = len(closes)
    result: list[float | None] = [None] * n
    if n < 2:
        return result

    bullish = float(closes[1]) >= float(closes[0])
    af = step
    ep = float(highs[0]) if bullish else float(lows[0])
    sar = float(lows[0]) if bullish else float(highs[0])
    result[0] = sar

    for i in range(1, n):
        sar = sar + af * (ep - sar)
        if bullish:
            if i >= 2:
                sar = min(sar, float(lows[i - 1]), float(lows[i - 2]))
            else:
                sar = min(sar, float(lows[i - 1]))
            if float(lows[i]) < sar:
                bullish = False
                sar = ep
                ep = float(lows[i])
                af = step
            elif float(highs[i]) > ep:
                ep = float(highs[i])
                af = min(af + step, max_step)
        else:
            if i >= 2:
                sar = max(sar, float(highs[i - 1]), float(highs[i - 2]))
            else:
                sar = max(sar, float(highs[i - 1]))
            if float(highs[i]) > sar:
                bullish = True
                sar = ep
                ep = float(highs[i])
                af = step
            elif float(lows[i]) < ep:
                ep = float(lows[i])
                af = min(af + step, max_step)
        result[i] = sar
    return result


def ichimoku(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
    *,
    tenkan: int,
    kijun: int,
    senkou_b: int,
    displacement: int,
) -> dict[str, list[float | None]]:
    """
    一目均衡表。

    先行スパンは displacement 本先のインデックスに置く。
    呼び出し側が未来日付のスロットを points に足す。
    遅行スパンは close[i+displacement] を日付 i に置く。
    """
    _require_positive("tenkan", tenkan)
    _require_positive("kijun", kijun)
    _require_positive("senkou_b", senkou_b)
    _require_positive("displacement", displacement)
    n = len(closes)
    out_len = n + displacement
    tenkan_line = _donchian_mid(highs, lows, tenkan, out_len)
    kijun_line = _donchian_mid(highs, lows, kijun, out_len)
    senkou_b_raw = _donchian_mid(highs, lows, senkou_b, n)

    senkou_a = [None] * out_len
    senkou_b_line = [None] * out_len
    chikou = [None] * out_len
    for i in range(n):
        t = tenkan_line[i]
        k = kijun_line[i]
        dest = i + displacement
        if t is not None and k is not None:
            senkou_a[dest] = (t + k) / 2.0
        if senkou_b_raw[i] is not None:
            senkou_b_line[dest] = senkou_b_raw[i]
        if i + displacement < n:
            chikou[i] = float(closes[i + displacement])

    return {
        "ichimokuTenkan": tenkan_line,
        "ichimokuKijun": kijun_line,
        "ichimokuSenkouA": senkou_a,
        "ichimokuSenkouB": senkou_b_line,
        "ichimokuChikou": chikou,
    }


def fibonacci_levels(
    highs: Sequence[float],
    lows: Sequence[float],
    dates: Sequence[str],
    range_start: int,
) -> dict[str, object] | None:
    """表示期間の最高値〜最安値からフィボ水平線を作る。"""
    start = max(0, range_start)
    if start >= len(highs):
        return None
    high = float(highs[start])
    low = float(lows[start])
    high_date = dates[start]
    low_date = dates[start]
    for i in range(start, len(highs)):
        if float(highs[i]) >= high:
            high = float(highs[i])
            high_date = dates[i]
        if float(lows[i]) <= low:
            low = float(lows[i])
            low_date = dates[i]
    span = high - low
    ratios = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618]
    levels = [{"ratio": ratio, "price": high - span * ratio} for ratio in ratios]
    return {
        "high": high,
        "low": low,
        "highDate": high_date,
        "lowDate": low_date,
        "levels": levels,
    }


def volume_profile(
    highs: Sequence[float],
    lows: Sequence[float],
    volumes: Sequence[float],
    range_start: int,
    bins: int,
) -> dict[str, object] | None:
    """表示期間の出来高を高値〜安値の価格ビンに分配する。"""
    _require_positive("bins", bins)
    start = max(0, range_start)
    if start >= len(highs):
        return None
    price_min = min(float(lows[i]) for i in range(start, len(lows)))
    price_max = max(float(highs[i]) for i in range(start, len(highs)))
    if price_max == price_min:
        return {
            "bins": [{"priceLow": price_min, "priceHigh": price_max, "volume": sum(float(volumes[i]) for i in range(start, len(volumes)))}],
        }
    width = (price_max - price_min) / bins
    totals = [0.0] * bins
    for i in range(start, len(highs)):
        low = float(lows[i])
        high = float(highs[i])
        vol = float(volumes[i])
        if high == low:
            idx = min(bins - 1, int((low - price_min) / width))
            totals[idx] += vol
            continue
        bar_span = high - low
        for b in range(bins):
            bin_low = price_min + b * width
            bin_high = bin_low + width
            overlap = min(high, bin_high) - max(low, bin_low)
            if overlap > 0:
                totals[b] += vol * (overlap / bar_span)
    out_bins = []
    for b in range(bins):
        out_bins.append(
            {
                "priceLow": price_min + b * width,
                "priceHigh": price_min + (b + 1) * width,
                "volume": totals[b],
            }
        )
    return {"bins": out_bins}


def infer_bar_step_days(dates: Sequence[str]) -> int:
    """直近 2 本の間隔から日足=1 / 週足=7 を推定する。"""
    if len(dates) < 2:
        return 1
    last = date.fromisoformat(dates[-1])
    prev = date.fromisoformat(dates[-2])
    delta = (last - prev).days
    return 7 if delta >= 5 else 1


def next_dates(last_date: str, count: int, step_days: int) -> list[str]:
    """最終日から count 本の未来日付を作る。日足は土日を飛ばす。"""
    _require_positive("count", count)
    _require_positive("step_days", step_days)
    current = date.fromisoformat(last_date)
    out: list[str] = []
    while len(out) < count:
        current = current + timedelta(days=step_days if step_days > 1 else 1)
        if step_days == 1 and current.weekday() >= 5:
            continue
        out.append(current.isoformat())
    return out


def _donchian_mid(
    highs: Sequence[float],
    lows: Sequence[float],
    period: int,
    out_len: int,
) -> list[float | None]:
    """期間内高値と安値の中点。out_len が入力より長くても末尾は None。"""
    n = len(highs)
    result: list[float | None] = [None] * out_len
    for i in range(period - 1, n):
        result[i] = (max(highs[i - period + 1 : i + 1]) + min(lows[i - period + 1 : i + 1])) / 2.0
    return result


def _sma_on_nullable(values: Sequence[float | None], period: int) -> list[float | None]:
    """None を含む系列の SMA。連続する有効値が period 本揃った位置に平均を置く。"""
    result: list[float | None] = [None] * len(values)
    window: list[float] = []
    for i, value in enumerate(values):
        if value is None:
            window = []
            continue
        window.append(value)
        if len(window) > period:
            window.pop(0)
        if len(window) == period:
            result[i] = sum(window) / period
    return result
