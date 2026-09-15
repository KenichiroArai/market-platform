"""リスクリワード算出。"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RiskRewardResult:
    """Entry / Stop / Target と RR。"""

    entry: float
    stop: float
    target: float
    risk_reward: float


def compute_risk_reward(
    entry: float,
    stop: float | None,
    target: float | None,
    *,
    is_long: bool,
) -> RiskRewardResult | None:
    """リスク幅に対するリワード倍率を返す。無効なら None。"""
    if stop is None or target is None:
        return None
    risk = abs(entry - stop)
    if risk <= 0:
        return None
    # 方向と矛盾するターゲットは無効
    if is_long and target <= entry:
        return None
    if not is_long and target >= entry:
        return None
    reward = abs(target - entry)
    return RiskRewardResult(
        entry=entry,
        stop=stop,
        target=target,
        risk_reward=round(reward / risk, 2),
    )
