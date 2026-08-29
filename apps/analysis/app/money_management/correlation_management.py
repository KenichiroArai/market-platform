"""相関グループによるユニット／リスク制限（単一銘柄向け）。"""

from __future__ import annotations

from app.money_management.types import CorrelationConfig, CorrelationGroupConfig


def find_groups_for_symbol(
    config: CorrelationConfig,
    symbol_id: str,
) -> list[CorrelationGroupConfig]:
    """銘柄が属する相関グループ一覧。"""
    if not config.enabled:
        return []
    return [g for g in config.groups if symbol_id in g.symbolIds]


def correlation_allows_entry(
    *,
    config: CorrelationConfig,
    symbol_id: str,
    current_units: float,
    add_units: float,
    current_risk: float,
    add_risk: float,
) -> bool:
    """新規／追加エントリーがグループ上限を超えないか。

    単一銘柄 BT では、その銘柄の現ユニット＋追加が各所属グループの maxUnits / maxRisk 以内であること。
    """
    groups = find_groups_for_symbol(config, symbol_id)
    if not groups:
        return True
    new_units = current_units + add_units
    new_risk = current_risk + add_risk
    for group in groups:
        if new_units > group.maxUnits + 1e-12:
            return False
        if new_risk > group.maxRisk + 1e-12:
            return False
    return True


def correlation_unit_cap(
    *,
    config: CorrelationConfig,
    symbol_id: str,
    pyramid_max_units: int,
) -> int:
    """ピラミッド最大ユニットと相関グループ上限の小さい方。"""
    groups = find_groups_for_symbol(config, symbol_id)
    if not groups:
        return pyramid_max_units
    group_cap = min(int(g.maxUnits) for g in groups)
    return min(pyramid_max_units, group_cap)
