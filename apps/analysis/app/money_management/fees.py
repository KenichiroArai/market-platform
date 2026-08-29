"""約定手数料（レートまたは固定額。0 可）。"""

from __future__ import annotations

from app.money_management.types import FeeMode


def compute_fee(
    *,
    notional: float,
    fee_mode: FeeMode,
    fee_rate: float,
    fee_fixed: float,
) -> float:
    """1 約定あたりの手数料。

    rate: notional × fee_rate
    fixed: fee_fixed（約定ごと。0 可）
    """
    if fee_mode == "fixed":
        return max(0.0, float(fee_fixed))
    return max(0.0, abs(notional) * max(0.0, float(fee_rate)))
