"""統合エントリー判定（複数指標 + トレンドスコア）。"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class JudgmentFactor:
    """判定に寄与した要因。"""

    id: str
    label: str
    contribution: float
    note: str


@dataclass(frozen=True)
class JudgmentResult:
    """5 段階判定と 0–100 スコア。"""

    level: str
    score: float
    stars: int
    label: str
    factors: list[JudgmentFactor]


_LEVEL_LABELS = {
    "strong_buy": "買い",
    "buy": "やや買い",
    "neutral": "中立",
    "sell": "やや売り",
    "strong_sell": "売り",
}


def compute_judgment(
    *,
    trend_score: float | None,
    rsi: float | None = None,
    macd_hist: float | None = None,
    adx: float | None = None,
    plus_di: float | None = None,
    minus_di: float | None = None,
    volume_ratio: float | None = None,
    bb_percent_b: float | None = None,
) -> JudgmentResult:
    """指標寄与を合成し、買い寄り 100 / 売り寄り 0 のスコアにする。

    トレンドスコア（-100〜+100）を主軸に、RSI・MACD・ADX・出来高・BB を加点減点する。
    """
    factors: list[JudgmentFactor] = []
    # トレンドスコアを 0–100 に写像（主軸 60%）
    base = 50.0
    if trend_score is not None:
        mapped = (float(trend_score) + 100.0) / 2.0
        base = mapped * 0.6 + 50.0 * 0.4
        factors.append(
            JudgmentFactor(
                id="trend_score",
                label="トレンドスコア",
                contribution=mapped - 50.0,
                note=f"スコア {trend_score:.1f}",
            )
        )

    adj = 0.0
    if rsi is not None:
        if rsi <= 30:
            adj += 8.0
            factors.append(JudgmentFactor("rsi", "RSI", 8.0, f"売られすぎ ({rsi:.1f})"))
        elif rsi >= 70:
            adj -= 8.0
            factors.append(JudgmentFactor("rsi", "RSI", -8.0, f"買われすぎ ({rsi:.1f})"))
        elif rsi < 45:
            adj += 3.0
            factors.append(JudgmentFactor("rsi", "RSI", 3.0, f"やや低位 ({rsi:.1f})"))
        elif rsi > 55:
            adj -= 3.0
            factors.append(JudgmentFactor("rsi", "RSI", -3.0, f"やや高位 ({rsi:.1f})"))

    if macd_hist is not None:
        if macd_hist > 0:
            adj += 5.0
            factors.append(JudgmentFactor("macd", "MACD", 5.0, "ヒストグラム正"))
        else:
            adj -= 5.0
            factors.append(JudgmentFactor("macd", "MACD", -5.0, "ヒストグラム負"))

    if adx is not None and plus_di is not None and minus_di is not None:
        if adx >= 25:
            if plus_di > minus_di:
                adj += 6.0
                factors.append(JudgmentFactor("adx", "ADX", 6.0, f"強い上昇トレンド (ADX {adx:.1f})"))
            elif minus_di > plus_di:
                adj -= 6.0
                factors.append(JudgmentFactor("adx", "ADX", -6.0, f"強い下降トレンド (ADX {adx:.1f})"))
        else:
            factors.append(JudgmentFactor("adx", "ADX", 0.0, f"トレンド弱い (ADX {adx:.1f})"))

    if volume_ratio is not None:
        if volume_ratio >= 1.2:
            # 方向はトレンドスコア符号に合わせる
            direction = 1.0 if (trend_score or 0) >= 0 else -1.0
            contrib = 4.0 * direction
            adj += contrib
            factors.append(
                JudgmentFactor("volume", "出来高", contrib, f"平均比 {volume_ratio:.2f}")
            )
        elif volume_ratio <= 0.7:
            factors.append(JudgmentFactor("volume", "出来高", 0.0, f"閑散 ({volume_ratio:.2f})"))

    if bb_percent_b is not None:
        if bb_percent_b <= 0.1:
            adj += 4.0
            factors.append(JudgmentFactor("bb", "ボリンジャー", 4.0, "下限付近"))
        elif bb_percent_b >= 0.9:
            adj -= 4.0
            factors.append(JudgmentFactor("bb", "ボリンジャー", -4.0, "上限付近"))

    score = max(0.0, min(100.0, base + adj))
    level = _level_from_score(score)
    stars = _stars_from_score(score)
    return JudgmentResult(
        level=level,
        score=round(score, 1),
        stars=stars,
        label=_LEVEL_LABELS[level],
        factors=factors,
    )


def _level_from_score(score: float) -> str:
    if score >= 75:
        return "strong_buy"
    if score >= 60:
        return "buy"
    if score <= 25:
        return "strong_sell"
    if score <= 40:
        return "sell"
    return "neutral"


def _stars_from_score(score: float) -> int:
    """買い寄りスコアを 1–5 星に写像する。"""
    if score >= 80:
        return 5
    if score >= 65:
        return 4
    if score >= 45:
        return 3
    if score >= 30:
        return 2
    return 1
