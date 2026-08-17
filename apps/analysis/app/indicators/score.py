"""
トレンドスコアの純関数（ADR 007）。

各指標を -100〜+100 に写し、グループ平均を配点へスケールする。
ウォームアップ不足は None。tanh / 区分線形で数値を固定しやすくする。
"""

from __future__ import annotations

import math
from typing import Sequence

from app.indicators.core import sma

GROUP_WEIGHTS: dict[str, float] = {
    "trend": 40.0,
    "momentum": 20.0,
    "oscillator": 10.0,
    "volatility": 10.0,
    "volume": 10.0,
    "cycle": 10.0,
}

SCORE_GROUPS: dict[str, str] = {
    "sma25": "trend",
    "sma75": "trend",
    "sma200": "trend",
    "ema50": "trend",
    "macd": "trend",
    "ichimoku": "trend",
    "psar": "trend",
    "momentum": "momentum",
    "roc": "momentum",
    "rsi": "oscillator",
    "cci": "oscillator",
    "stoch": "oscillator",
    "willr": "oscillator",
    "psy": "oscillator",
    "bb": "volatility",
    "atr": "volatility",
    "stdev": "volatility",
    "keltner": "volatility",
    "volume": "volume",
    "obv": "volume",
    "vwap": "volume",
    "mfi": "volume",
    "volumeProfile": "volume",
    "fibonacci": "cycle",
}

RSI_POINTS: list[tuple[float, float]] = [
    (20.0, 100.0),
    (30.0, 50.0),
    (50.0, 0.0),
    (70.0, -50.0),
    (80.0, -100.0),
]

CCI_POINTS: list[tuple[float, float]] = [
    (-200.0, 100.0),
    (-100.0, 50.0),
    (0.0, 0.0),
    (100.0, -50.0),
    (200.0, -100.0),
]


def clamp(value: float, lo: float = -100.0, hi: float = 100.0) -> float:
    """値を [lo, hi] に収める。"""
    return max(lo, min(hi, value))


def tanh_score(x: float) -> float:
    """100 * tanh(x)。方向性の連続量を ±100 に収める。"""
    return 100.0 * math.tanh(x)


def piecewise_linear(value: float, points: Sequence[tuple[float, float]]) -> float:
    """昇順の制御点を区分線形補間する。範囲外は端点。"""
    if not points:
        return 0.0
    if value <= points[0][0]:
        return points[0][1]
    for i in range(1, len(points)):
        x0, y0 = points[i - 1]
        x1, y1 = points[i]
        if value <= x1:
            t = (value - x0) / (x1 - x0)
            return y0 + t * (y1 - y0)
    return points[-1][1]


def ma_score(close: float, ma: float | None) -> float | None:
    """終値の移動平均からの乖離。約 5% で |score|≈76。"""
    if ma is None or ma == 0.0:
        return None
    return tanh_score((close - ma) / ma / 0.05)


def macd_score(
    close: float,
    line: float | None,
    signal: float | None,
    hist: float | None,
) -> float | None:
    """ヒストグラム 70% + ライン/シグナル符号 30%。"""
    if close == 0.0 or line is None or signal is None or hist is None:
        return None
    base = tanh_score(hist / (close * 0.01))
    if line > signal:
        align = 100.0
    elif line < signal:
        align = -100.0
    else:
        align = 0.0
    return clamp(0.7 * base + 0.3 * align)


def ichimoku_score(
    close: float,
    tenkan: float | None,
    kijun: float | None,
    senkou_a: float | None,
    senkou_b: float | None,
    past_close: float | None,
) -> float | None:
    """雲・転換/基準・26 本前終値の 3 要素平均。"""
    parts: list[float] = []
    if senkou_a is not None and senkou_b is not None:
        cloud_high = max(senkou_a, senkou_b)
        cloud_low = min(senkou_a, senkou_b)
        if close > cloud_high:
            parts.append(100.0)
        elif close < cloud_low:
            parts.append(-100.0)
        else:
            parts.append(0.0)
    if tenkan is not None and kijun is not None:
        if tenkan > kijun:
            parts.append(100.0)
        elif tenkan < kijun:
            parts.append(-100.0)
        else:
            parts.append(0.0)
    if past_close is not None:
        if close > past_close:
            parts.append(100.0)
        elif close < past_close:
            parts.append(-100.0)
        else:
            parts.append(0.0)
    if not parts:
        return None
    return sum(parts) / len(parts)


def psar_score(close: float, psar: float | None) -> float | None:
    """点が終値より下なら上昇、上なら下降。"""
    if psar is None:
        return None
    if close > psar:
        return 100.0
    if close < psar:
        return -100.0
    return 0.0


def momentum_score(close: float, mom: float | None) -> float | None:
    """N 本前差を終値の 5% で正規化。"""
    if mom is None or close == 0.0:
        return None
    return tanh_score(mom / (close * 0.05))


def roc_score(roc: float | None) -> float | None:
    """変化率 % を 5 で正規化。"""
    if roc is None:
        return None
    return tanh_score(roc / 5.0)


def rsi_like_score(value: float | None) -> float | None:
    """0〜100 オシレーターの平均回帰補正。"""
    if value is None:
        return None
    return piecewise_linear(value, RSI_POINTS)


def willr_score(willr: float | None) -> float | None:
    """Williams %R（0〜-100）を RSI スケールへ移して補正。"""
    if willr is None:
        return None
    return piecewise_linear(willr + 100.0, RSI_POINTS)


def cci_score(cci: float | None) -> float | None:
    """CCI の平均回帰補正。"""
    if cci is None:
        return None
    return piecewise_linear(cci, CCI_POINTS)


def percent_b_score(close: float, upper: float | None, lower: float | None) -> float | None:
    """バンド内位置を ±100 にする。幅 0 は 0。"""
    if upper is None or lower is None:
        return None
    span = upper - lower
    if span == 0.0:
        return 0.0
    pct_b = (close - lower) / span
    return clamp((pct_b - 0.5) * 200.0)


def trend_sign(close: float, sma25: float | None) -> float:
    """短期方向。SMA25 が無いときは 0。"""
    if sma25 is None:
        return 0.0
    if close > sma25:
        return 1.0
    if close < sma25:
        return -1.0
    return 0.0


def volatility_strength_score(
    value: float | None,
    value_sma: float | None,
    direction: float,
) -> float | None:
    """相対的な大きさ × 短期方向。"""
    if value is None or value_sma is None:
        return None
    if value_sma == 0.0:
        x = 0.0 if value == 0.0 else 1.0
    else:
        x = value / value_sma - 1.0
    return clamp(direction * tanh_score(x))


def volume_bar_score(
    close: float,
    open_: float,
    volume: float,
    vol_sma: float | None,
) -> float | None:
    """高出来高 × 陰陽。"""
    if vol_sma is None or vol_sma == 0.0:
        return None
    direction = 1.0 if close >= open_ else -1.0
    return clamp(direction * tanh_score(volume / vol_sma - 0.5))


def obv_score(obv: float | None, obv_sma: float | None) -> float | None:
    """OBV とその SMA の乖離。"""
    if obv is None or obv_sma is None:
        return None
    denom = abs(obv_sma) if obv_sma != 0.0 else 1.0
    return tanh_score((obv - obv_sma) / denom / 0.05)


def mfi_score(mfi: float | None) -> float | None:
    """MFI の 50 基準。出来高グループは方向の信頼性。"""
    if mfi is None:
        return None
    return tanh_score((mfi - 50.0) / 20.0)


def fibonacci_score(close: float, high: float, low: float) -> float:
    """表示期間の高値〜安値における位置。安値寄りがプラス。"""
    span = high - low
    if span == 0.0:
        return 0.0
    pos = (close - low) / span
    return clamp((0.5 - pos) * 200.0)


def poc_price(bins: Sequence[object] | None) -> float | None:
    """Volume Profile の最大出来高ビン中央。空なら None。"""
    if not bins:
        return None
    best = max(bins, key=lambda bin_: getattr(bin_, "volume"))
    return (float(getattr(best, "priceLow")) + float(getattr(best, "priceHigh"))) / 2.0


def rolling_sma(values: Sequence[float | None], period: int) -> list[float | None]:
    """None を NaN とみなして SMA する。"""
    filled = [float("nan") if value is None else float(value) for value in values]
    return sma(filled, period)


def aggregate_scores(
    indicator_scores: dict[str, float | None],
) -> tuple[float | None, dict[str, float | None]]:
    """
    グループ平均を配点へスケールして合算する。

    有効点が 0 件のグループ寄与は None。全て None なら総合も None。
    """
    by_group: dict[str, list[float]] = {group: [] for group in GROUP_WEIGHTS}
    for indicator_id, score in indicator_scores.items():
        group = SCORE_GROUPS.get(indicator_id)
        if group is None or score is None:
            continue
        by_group[group].append(score)

    contrib: dict[str, float | None] = {}
    total = 0.0
    any_group = False
    for group, weight in GROUP_WEIGHTS.items():
        values = by_group[group]
        if not values:
            contrib[group] = None
            continue
        avg = sum(values) / len(values)
        part = (avg / 100.0) * weight
        contrib[group] = part
        total += part
        any_group = True

    if not any_group:
        return None, contrib
    return clamp(total), contrib
