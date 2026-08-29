"""ドローダウンに応じた実効リスク率。"""

from __future__ import annotations

import math


def effective_risk_rate(
    *,
    base_risk_rate: float,
    equity: float,
    equity_high: float,
    enabled: bool,
    threshold_rate: float,
    risk_reduction_rate: float,
) -> tuple[float, int]:
    """Equity High からのドローダウン段数に応じてリスク率を縮小する。

    例: 閾値 10%、縮小 20% なら、DD 10% で 0.8 倍、20% で 0.64 倍。
    戻り値: (実効リスク率, 適用段数)
    """
    if not enabled or equity_high <= 0.0 or threshold_rate <= 0.0:
        return base_risk_rate, 0
    drawdown = max(0.0, (equity_high - equity) / equity_high)
    steps = int(math.floor(drawdown / threshold_rate))
    if steps <= 0:
        return base_risk_rate, 0
    factor = (1.0 - risk_reduction_rate) ** steps
    return base_risk_rate * max(0.0, factor), steps
