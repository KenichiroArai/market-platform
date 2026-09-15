"""トレードプラン用 Strategy 層（ADR 018）。

判定・エントリー・損切・利確・RR・ポジション・リスク・理由を分離し、
trade_plan.compute_trade_plan で束ねる。バックテストの exitPolicy からも再利用する。
"""

from __future__ import annotations

from app.strategy.entry_price import compute_recommended_entry
from app.strategy.judgment import compute_judgment
from app.strategy.position_plan import compute_position_plan
from app.strategy.reasons import build_trade_reasons
from app.strategy.risk_rating import compute_risk_rating
from app.strategy.risk_reward import compute_risk_reward
from app.strategy.stop_loss import StopLossMethod, compute_stop_loss_candidates, pick_recommended_stop
from app.strategy.take_profit import (
    TakeProfitMethod,
    compute_take_profit_candidates,
    pick_recommended_target,
)
from app.strategy.trade_plan import compute_trade_plan

__all__ = [
    "StopLossMethod",
    "TakeProfitMethod",
    "build_trade_reasons",
    "compute_judgment",
    "compute_position_plan",
    "compute_recommended_entry",
    "compute_risk_rating",
    "compute_risk_reward",
    "compute_stop_loss_candidates",
    "compute_take_profit_candidates",
    "compute_trade_plan",
    "pick_recommended_stop",
    "pick_recommended_target",
]
