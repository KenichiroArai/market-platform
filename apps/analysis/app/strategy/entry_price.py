"""推奨エントリー価格。"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EntryPriceResult:
    """現在価格と推奨エントリー。"""

    current_price: float
    recommended_price: float
    side: str
    rationale: str


def compute_recommended_entry(
    *,
    current_price: float,
    is_long: bool,
    sma25: float | None = None,
    bb_lower: float | None = None,
    bb_upper: float | None = None,
    recent_swing: float | None = None,
) -> EntryPriceResult:
    """押し目／戻りを想定した推奨エントリーを返す。

    ロングは現値より低い候補（BB 下限・25MA・直近安値）のうち、現値に近い妥当な水準を選ぶ。
    ショートは対称。
    """
    side = "long" if is_long else "short"
    candidates: list[tuple[float, str]] = []

    if is_long:
        if bb_lower is not None and bb_lower < current_price:
            candidates.append((bb_lower, "ボリンジャー下限"))
        if sma25 is not None and sma25 < current_price:
            candidates.append((sma25, "25日移動平均"))
        if recent_swing is not None and recent_swing < current_price:
            candidates.append((recent_swing, "直近安値"))
        if not candidates:
            # 押し目が取れないときは現値エントリー
            return EntryPriceResult(
                current_price=current_price,
                recommended_price=current_price,
                side=side,
                rationale="押し目候補がないため現在価格でのエントリーを推奨",
            )
        # 現値に最も近い（浅すぎない押し目）
        recommended, label = max(candidates, key=lambda x: x[0])
        return EntryPriceResult(
            current_price=current_price,
            recommended_price=round(recommended, 4),
            side=side,
            rationale=f"{label}（{recommended:.2f}）以下での押し目買いを推奨",
        )

    if bb_upper is not None and bb_upper > current_price:
        candidates.append((bb_upper, "ボリンジャー上限"))
    if sma25 is not None and sma25 > current_price:
        candidates.append((sma25, "25日移動平均"))
    if recent_swing is not None and recent_swing > current_price:
        candidates.append((recent_swing, "直近高値"))
    if not candidates:
        return EntryPriceResult(
            current_price=current_price,
            recommended_price=current_price,
            side=side,
            rationale="戻り候補がないため現在価格でのエントリーを推奨",
        )
    recommended, label = min(candidates, key=lambda x: x[0])
    return EntryPriceResult(
        current_price=current_price,
        recommended_price=round(recommended, 4),
        side=side,
        rationale=f"{label}（{recommended:.2f}）以上での戻り売りを推奨",
    )
