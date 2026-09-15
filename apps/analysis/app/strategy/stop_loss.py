"""損切ライン候補と推奨選定。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

StopLossMethod = Literal[
    "atr",
    "atr_x2",
    "recent_swing",
    "approx_support",
    "donchian_lower",
    "ma",
]


@dataclass(frozen=True)
class PriceLevel:
    """価格候補 1 本。"""

    method: str
    label: str
    price: float
    rationale: str
    recommended: bool = False


def compute_stop_loss_candidates(
    *,
    entry_price: float,
    is_long: bool,
    atr: float | None,
    recent_swing: float | None,
    approx_support: float | None,
    donchian_bound: float | None,
    ma: float | None,
    atr_multiple: float = 1.0,
) -> list[PriceLevel]:
    """複数方式の損切候補を列挙する（推奨フラグは未設定）。"""
    levels: list[PriceLevel] = []

    if atr is not None and atr > 0:
        width = atr * atr_multiple
        price = entry_price - width if is_long else entry_price + width
        levels.append(
            PriceLevel(
                method="atr",
                label="ATR",
                price=round(price, 4),
                rationale=f"エントリーから ATR×{atr_multiple:g}（{atr:.4f}）",
            )
        )
        width2 = atr * 2.0
        price2 = entry_price - width2 if is_long else entry_price + width2
        levels.append(
            PriceLevel(
                method="atr_x2",
                label="ATR×2",
                price=round(price2, 4),
                rationale=f"エントリーから ATR×2（{atr:.4f}）",
            )
        )

    if recent_swing is not None:
        # ロングは安値側、ショートは高値側のみ採用
        if (is_long and recent_swing < entry_price) or (not is_long and recent_swing > entry_price):
            levels.append(
                PriceLevel(
                    method="recent_swing",
                    label="直近安値" if is_long else "直近高値",
                    price=round(recent_swing, 4),
                    rationale="直近スイングを損切目安とする",
                )
            )

    if approx_support is not None:
        if (is_long and approx_support < entry_price) or (
            not is_long and approx_support > entry_price
        ):
            levels.append(
                PriceLevel(
                    method="approx_support",
                    label="近似サポート" if is_long else "近似レジスタンス",
                    price=round(approx_support, 4),
                    rationale="スイング／フィボ／POC から近似した水準",
                )
            )

    if donchian_bound is not None:
        if (is_long and donchian_bound < entry_price) or (
            not is_long and donchian_bound > entry_price
        ):
            levels.append(
                PriceLevel(
                    method="donchian_lower",
                    label="ドンチャン下限" if is_long else "ドンチャン上限",
                    price=round(donchian_bound, 4),
                    rationale="ドンチャンチャネル境界",
                )
            )

    if ma is not None:
        if (is_long and ma < entry_price) or (not is_long and ma > entry_price):
            levels.append(
                PriceLevel(
                    method="ma",
                    label="移動平均",
                    price=round(ma, 4),
                    rationale="参照移動平均を損切目安とする",
                )
            )

    return levels


def pick_recommended_stop(
    candidates: list[PriceLevel],
    *,
    entry_price: float,
    is_long: bool,
    prefer_method: StopLossMethod | None = None,
) -> PriceLevel | None:
    """推奨損切を 1 本選ぶ。

    prefer_method 指定時はその方式を優先。なければ ATR×2 を好み、
    なければリスク幅が中位の候補を選ぶ。
    """
    if not candidates:
        return None

    if prefer_method:
        for c in candidates:
            if c.method == prefer_method:
                return PriceLevel(
                    method=c.method,
                    label=c.label,
                    price=c.price,
                    rationale=c.rationale,
                    recommended=True,
                )

    by_method = {c.method: c for c in candidates}
    if "atr_x2" in by_method:
        c = by_method["atr_x2"]
        return PriceLevel(c.method, c.label, c.price, c.rationale, True)

    # リスク幅でソートし中央を選ぶ
    def risk_width(c: PriceLevel) -> float:
        return abs(entry_price - c.price)

    ordered = sorted(candidates, key=risk_width)
    mid = ordered[len(ordered) // 2]
    return PriceLevel(mid.method, mid.label, mid.price, mid.rationale, True)


def stop_price_for_method(
    *,
    method: StopLossMethod,
    entry_price: float,
    is_long: bool,
    atr: float | None,
    recent_swing: float | None,
    approx_support: float | None,
    donchian_bound: float | None,
    ma: float | None,
    atr_multiple: float = 1.0,
) -> float | None:
    """指定方式の損切価格だけを返す（BT exitPolicy 用）。"""
    candidates = compute_stop_loss_candidates(
        entry_price=entry_price,
        is_long=is_long,
        atr=atr,
        recent_swing=recent_swing,
        approx_support=approx_support,
        donchian_bound=donchian_bound,
        ma=ma,
        atr_multiple=atr_multiple,
    )
    for c in candidates:
        if c.method == method:
            return c.price
    # atr 方式だが候補に無い場合のフォールバック（防御）
    if method == "atr" and atr is not None and atr > 0:  # pragma: no cover
        width = atr * atr_multiple
        return entry_price - width if is_long else entry_price + width
    return None
