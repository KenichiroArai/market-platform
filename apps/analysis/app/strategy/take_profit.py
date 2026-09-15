"""利確ライン候補と推奨選定。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.strategy.risk_reward import compute_risk_reward

TakeProfitMethod = Literal[
    "atr_multiple",
    "rr_target",
    "approx_resistance",
    "fibonacci",
    "donchian_upper",
    "none",
]


@dataclass(frozen=True)
class PriceLevel:
    """価格候補 1 本。"""

    method: str
    label: str
    price: float
    rationale: str
    recommended: bool = False


def compute_take_profit_candidates(
    *,
    entry_price: float,
    stop_price: float | None,
    is_long: bool,
    atr: float | None,
    atr_target_multiple: float = 3.0,
    rr_multiple: float = 2.0,
    approx_resistance: float | None,
    fib_level: float | None,
    donchian_bound: float | None,
) -> list[PriceLevel]:
    """複数方式の利確候補を列挙する。"""
    levels: list[PriceLevel] = []

    if atr is not None and atr > 0:
        width = atr * atr_target_multiple
        price = entry_price + width if is_long else entry_price - width
        levels.append(
            PriceLevel(
                method="atr_multiple",
                label=f"ATR×{atr_target_multiple:g}",
                price=round(price, 4),
                rationale=f"エントリーから ATR×{atr_target_multiple:g}",
            )
        )

    if stop_price is not None:
        risk = abs(entry_price - stop_price)
        if risk > 0:
            price = entry_price + risk * rr_multiple if is_long else entry_price - risk * rr_multiple
            levels.append(
                PriceLevel(
                    method="rr_target",
                    label=f"RR {rr_multiple:g}",
                    price=round(price, 4),
                    rationale=f"損切幅の {rr_multiple:g} 倍を利確目標とする",
                )
            )

    if approx_resistance is not None:
        if (is_long and approx_resistance > entry_price) or (
            not is_long and approx_resistance < entry_price
        ):
            levels.append(
                PriceLevel(
                    method="approx_resistance",
                    label="近似レジスタンス" if is_long else "近似サポート",
                    price=round(approx_resistance, 4),
                    rationale="スイング／フィボ／POC から近似した水準",
                )
            )

    if fib_level is not None:
        if (is_long and fib_level > entry_price) or (not is_long and fib_level < entry_price):
            levels.append(
                PriceLevel(
                    method="fibonacci",
                    label="フィボナッチ",
                    price=round(fib_level, 4),
                    rationale="表示期間フィボナッチ拡張／戻し水準",
                )
            )

    if donchian_bound is not None:
        if (is_long and donchian_bound > entry_price) or (
            not is_long and donchian_bound < entry_price
        ):
            levels.append(
                PriceLevel(
                    method="donchian_upper",
                    label="ドンチャン上限" if is_long else "ドンチャン下限",
                    price=round(donchian_bound, 4),
                    rationale="ドンチャンチャネル境界",
                )
            )

    return levels


def pick_recommended_target(
    candidates: list[PriceLevel],
    *,
    entry_price: float,
    stop_price: float | None,
    is_long: bool,
    prefer_method: TakeProfitMethod | None = None,
    min_rr: float = 1.5,
) -> PriceLevel | None:
    """推奨利確を 1 本選ぶ。RR が min_rr 以上の候補を優先する。"""
    if not candidates:
        return None

    if prefer_method and prefer_method != "none":
        for c in candidates:
            if c.method == prefer_method:
                return PriceLevel(c.method, c.label, c.price, c.rationale, True)

    scored: list[tuple[float, PriceLevel]] = []
    for c in candidates:
        rr = compute_risk_reward(entry_price, stop_price, c.price, is_long=is_long)
        if rr is None:  # pragma: no cover — 候補生成時に方向整合済み
            continue
        if rr.risk_reward >= min_rr:
            scored.append((rr.risk_reward, c))

    if scored:
        # RR が十分かつ過大でないものを好む（3 付近）
        scored.sort(key=lambda x: abs(x[0] - 3.0))
        c = scored[0][1]
        return PriceLevel(c.method, c.label, c.price, c.rationale, True)

    c = candidates[0]
    return PriceLevel(c.method, c.label, c.price, c.rationale, True)


def target_price_for_method(
    *,
    method: TakeProfitMethod,
    entry_price: float,
    stop_price: float | None,
    is_long: bool,
    atr: float | None,
    atr_target_multiple: float = 3.0,
    rr_multiple: float = 2.0,
    approx_resistance: float | None,
    fib_level: float | None,
    donchian_bound: float | None,
) -> float | None:
    """指定方式の利確価格（BT 用）。none は None。"""
    if method == "none":
        return None
    candidates = compute_take_profit_candidates(
        entry_price=entry_price,
        stop_price=stop_price,
        is_long=is_long,
        atr=atr,
        atr_target_multiple=atr_target_multiple,
        rr_multiple=rr_multiple,
        approx_resistance=approx_resistance,
        fib_level=fib_level,
        donchian_bound=donchian_bound,
    )
    for c in candidates:
        if c.method == method:
            return c.price
    return None  # pragma: no cover — 方式に対応する候補が無い場合
