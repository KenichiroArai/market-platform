"""資金管理の型定義（shared-types / money-management.ts と同期）。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

TradeSidePolicy = Literal["longOnly", "longShort"]
FeeMode = Literal["rate", "fixed"]
AtrKind = Literal["atr", "n"]


@dataclass
class CorrelationGroupConfig:
    """相関グループ（単一銘柄 BT では所属グループの上限を適用）。"""

    name: str
    symbolIds: list[str]
    maxUnits: float
    maxRisk: float


@dataclass
class PyramidingConfig:
    enabled: bool = True
    stepAtrMultiple: float = 0.5
    maxUnits: int = 4


@dataclass
class DrawdownConfig:
    enabled: bool = True
    thresholdRate: float = 0.1
    riskReductionRate: float = 0.2


@dataclass
class CorrelationConfig:
    enabled: bool = False
    groups: list[CorrelationGroupConfig] = field(default_factory=list)


@dataclass
class MoneyManagementConfig:
    """タートルズ系資金管理設定。"""

    enabled: bool = False
    riskRate: float = 0.01
    atrPeriod: int = 20
    atrKind: AtrKind = "n"
    stopMultiple: float = 2.0
    minQuantity: float = 0.0
    maxQuantity: float | None = None
    allowFractionalQuantity: bool = True
    pyramiding: PyramidingConfig = field(default_factory=PyramidingConfig)
    drawdown: DrawdownConfig = field(default_factory=DrawdownConfig)
    correlation: CorrelationConfig = field(default_factory=CorrelationConfig)


@dataclass
class MoneyManagementStats:
    """バックテスト集計用の資金管理統計。"""

    averageRiskRate: float | None = None
    maxRiskRate: float | None = None
    averageAtr: float | None = None
    averageUnits: float | None = None
    maxUnits: float | None = None
    pyramidingSuccessRate: float | None = None
    averageRiskRateInDrawdown: float | None = None


def default_money_management_config() -> MoneyManagementConfig:
    """UI・未指定時の基準設定（enabled=False）。"""
    return MoneyManagementConfig()


def money_management_from_dict(raw: dict | None) -> MoneyManagementConfig | None:
    """API JSON から設定を復元。None / 空は未使用扱い。"""
    if raw is None:
        return None
    pyr_raw = raw.get("pyramiding") or {}
    dd_raw = raw.get("drawdown") or {}
    corr_raw = raw.get("correlation") or {}
    groups = [
        CorrelationGroupConfig(
            name=str(g.get("name", "")),
            symbolIds=list(g.get("symbolIds") or []),
            maxUnits=float(g.get("maxUnits", 4)),
            maxRisk=float(g.get("maxRisk", 0.04)),
        )
        for g in (corr_raw.get("groups") or [])
    ]
    max_q = raw.get("maxQuantity")
    return MoneyManagementConfig(
        enabled=bool(raw.get("enabled", False)),
        riskRate=float(raw.get("riskRate", 0.01)),
        atrPeriod=int(raw.get("atrPeriod", 20)),
        atrKind=raw.get("atrKind", "n") if raw.get("atrKind") in ("atr", "n") else "n",
        stopMultiple=float(raw.get("stopMultiple", 2.0)),
        minQuantity=float(raw.get("minQuantity", 0.0)),
        maxQuantity=None if max_q is None else float(max_q),
        allowFractionalQuantity=bool(raw.get("allowFractionalQuantity", True)),
        pyramiding=PyramidingConfig(
            enabled=bool(pyr_raw.get("enabled", True)),
            stepAtrMultiple=float(pyr_raw.get("stepAtrMultiple", 0.5)),
            maxUnits=int(pyr_raw.get("maxUnits", 4)),
        ),
        drawdown=DrawdownConfig(
            enabled=bool(dd_raw.get("enabled", True)),
            thresholdRate=float(dd_raw.get("thresholdRate", 0.1)),
            riskReductionRate=float(dd_raw.get("riskReductionRate", 0.2)),
        ),
        correlation=CorrelationConfig(
            enabled=bool(corr_raw.get("enabled", False)),
            groups=groups,
        ),
    )


def stats_to_dict(stats: MoneyManagementStats) -> dict:
    """統計を JSON 互換 dict へ。"""
    return {
        "averageRiskRate": stats.averageRiskRate,
        "maxRiskRate": stats.maxRiskRate,
        "averageAtr": stats.averageAtr,
        "averageUnits": stats.averageUnits,
        "maxUnits": stats.maxUnits,
        "pyramidingSuccessRate": stats.pyramidingSuccessRate,
        "averageRiskRateInDrawdown": stats.averageRiskRateInDrawdown,
    }
