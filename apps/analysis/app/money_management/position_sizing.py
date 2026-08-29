"""ボラティリティベースのポジションサイズ。"""

from __future__ import annotations

import math


def round_quantity(quantity: float, *, allow_fractional: bool, decimals: int = 6) -> float:
    """数量を丸める。整数のみなら切り捨て、小数可なら指定桁で切り捨て。"""
    if quantity <= 0.0 or not math.isfinite(quantity):
        return 0.0
    if not allow_fractional:
        return float(math.floor(quantity))
    factor = 10**decimals
    return math.floor(quantity * factor) / factor


def compute_unit_quantity(
    *,
    equity: float,
    risk_rate: float,
    atr_value: float,
    stop_multiple: float,
    min_quantity: float,
    max_quantity: float | None,
    allow_fractional: bool,
) -> float:
    """リスク金額 ÷ ストップ幅 で 1 ユニット数量を算出する。

    ストップ幅 = ATR × stop_multiple。ATR やストップ幅が無効なら 0。
    """
    if equity <= 0.0 or risk_rate <= 0.0 or atr_value <= 0.0 or stop_multiple <= 0.0:
        return 0.0
    stop_width = atr_value * stop_multiple
    risk_amount = equity * risk_rate
    raw = risk_amount / stop_width
    qty = round_quantity(raw, allow_fractional=allow_fractional)
    if qty < min_quantity:
        return 0.0
    if max_quantity is not None and qty > max_quantity:
        qty = round_quantity(max_quantity, allow_fractional=allow_fractional)
    return qty
