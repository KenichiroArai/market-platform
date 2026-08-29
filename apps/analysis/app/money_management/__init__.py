"""資金管理（マネーマネージメント）パッケージ。

売買シグナルとは独立し、ポジションサイズ・ストップ・ピラミッド等を制御する（ADR 016）。
"""

from app.money_management.service import MoneyManagementService
from app.money_management.types import (
    FeeMode,
    MoneyManagementConfig,
    MoneyManagementStats,
    TradeSidePolicy,
    default_money_management_config,
)

__all__ = [
    "FeeMode",
    "MoneyManagementConfig",
    "MoneyManagementService",
    "MoneyManagementStats",
    "TradeSidePolicy",
    "default_money_management_config",
]
