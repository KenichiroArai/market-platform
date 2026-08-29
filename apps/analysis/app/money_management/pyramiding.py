"""ピラミッディング（買い増し）判定。"""

from __future__ import annotations


def next_pyramid_level_price(
    *,
    is_long: bool,
    first_entry_price: float,
    atr_value: float,
    step_atr_multiple: float,
    next_unit_index: int,
) -> float:
    """次ユニットを追加できる価格水準。

    next_unit_index: これから建てるユニット番号（2 なら 1 回目の追加 = Entry±1×step）。
    """
    step = atr_value * step_atr_multiple
    offset = step * (next_unit_index - 1)
    if is_long:
        return first_entry_price + offset
    return first_entry_price - offset


def can_add_pyramid_unit(
    *,
    enabled: bool,
    is_long: bool,
    first_entry_price: float,
    current_price: float,
    atr_value: float,
    step_atr_multiple: float,
    current_units: int,
    max_units: int,
) -> bool:
    """順行かつ負けていないポジションへの追加可否。"""
    if not enabled or atr_value <= 0.0 or step_atr_multiple <= 0.0:
        return False
    if current_units >= max_units:
        return False
    # 負けているポジションには追加しない
    if is_long and current_price < first_entry_price:
        return False
    if (not is_long) and current_price > first_entry_price:
        return False
    level = next_pyramid_level_price(
        is_long=is_long,
        first_entry_price=first_entry_price,
        atr_value=atr_value,
        step_atr_multiple=step_atr_multiple,
        next_unit_index=current_units + 1,
    )
    if is_long:
        return current_price >= level
    return current_price <= level
