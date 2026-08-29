"""実効リスク率のヘルパ（ドローダウン縮小を含む）。"""

from __future__ import annotations

from app.money_management.drawdown_management import effective_risk_rate
from app.money_management.types import MoneyManagementConfig


def resolve_effective_risk_rate(
    config: MoneyManagementConfig,
    *,
    equity: float,
    equity_high: float,
) -> tuple[float, int]:
    """設定に基づく実効リスク率と DD 段数。"""
    return effective_risk_rate(
        base_risk_rate=config.riskRate,
        equity=equity,
        equity_high=equity_high,
        enabled=config.drawdown.enabled,
        threshold_rate=config.drawdown.thresholdRate,
        risk_reduction_rate=config.drawdown.riskReductionRate,
    )
