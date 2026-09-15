"""銘柄リスク評価。"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RiskRatingResult:
    """低/普通/高と星・根拠。"""

    level: str
    stars: int
    atr_percent: float | None
    notes: list[str]


def compute_risk_rating(
    *,
    atr: float | None,
    close: float,
    stdev: float | None = None,
    volume_ratio: float | None = None,
    adx: float | None = None,
    gap_percent: float | None = None,
) -> RiskRatingResult:
    """ATR%・ボラ・出来高・ADX・ギャップからリスクを数値化する。"""
    notes: list[str] = []
    score = 0  # 高いほど高リスク

    atr_pct: float | None = None
    if atr is not None and close > 0:
        atr_pct = 100.0 * atr / close
        if atr_pct >= 4.0:
            score += 2
            notes.append(f"ATR% が高い ({atr_pct:.2f}%)")
        elif atr_pct >= 2.0:
            score += 1
            notes.append(f"ATR% は中程度 ({atr_pct:.2f}%)")
        else:
            notes.append(f"ATR% は低い ({atr_pct:.2f}%)")

    if stdev is not None and close > 0:
        vol_pct = 100.0 * stdev / close
        if vol_pct >= 3.0:
            score += 2
            notes.append(f"標準偏差が大きい ({vol_pct:.2f}%)")
        elif vol_pct >= 1.5:
            score += 1
            notes.append(f"標準偏差は中程度 ({vol_pct:.2f}%)")

    if volume_ratio is not None:
        if volume_ratio >= 2.0:
            score += 1
            notes.append(f"出来高急増 (平均比 {volume_ratio:.2f})")
        elif volume_ratio <= 0.5:
            notes.append(f"出来高低調 (平均比 {volume_ratio:.2f})")

    if adx is not None:
        if adx >= 40:
            score += 1
            notes.append(f"強いトレンド (ADX {adx:.1f})")
        elif adx < 20:
            notes.append(f"レンジ寄り (ADX {adx:.1f})")

    if gap_percent is not None:
        abs_gap = abs(gap_percent)
        if abs_gap >= 3.0:
            score += 2
            notes.append(f"大きなギャップ ({gap_percent:.2f}%)")
        elif abs_gap >= 1.5:
            score += 1
            notes.append(f"ギャップあり ({gap_percent:.2f}%)")

    if score >= 4:
        level = "high"
        stars = 5
    elif score >= 2:
        level = "medium"
        stars = 3
    else:
        level = "low"
        stars = 1

    if not notes:
        notes.append("特記すべきリスク要因なし")

    return RiskRatingResult(
        level=level,
        stars=stars,
        atr_percent=round(atr_pct, 2) if atr_pct is not None else None,
        notes=notes,
    )
