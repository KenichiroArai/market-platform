"""ポジションサイズ（資金管理）。

タートルズ系の ATR ユニットは MoneyManagementService を再利用し、
一般の「許容損失 ÷ 損切幅」も同一モジュールで提供する。
"""

from __future__ import annotations

from dataclasses import dataclass

from app.money_management.position_sizing import compute_unit_quantity, round_quantity


@dataclass(frozen=True)
class PositionPlanResult:
    """推奨株数と損失見込み。"""

    recommended_shares: float
    max_shares: float
    required_capital: float
    max_loss: float
    equity: float
    risk_rate: float


def compute_position_plan(
    *,
    equity: float,
    risk_rate: float,
    entry_price: float,
    stop_price: float,
    allow_fractional: bool = False,
    min_quantity: float = 1.0,
    max_quantity: float | None = None,
    atr: float | None = None,
    stop_multiple: float | None = None,
) -> PositionPlanResult | None:
    """総資産・許容損失率・Entry・Stop から推奨株数を算出する。

    損切幅が有効なとき: shares = (equity * risk_rate) / |entry - stop|
    ATR と stop_multiple がある場合はタートル系ユニットも参考に下限を取らない（推奨は損切幅ベース）。
    """
    if equity <= 0 or risk_rate <= 0 or entry_price <= 0:
        return None
    stop_width = abs(entry_price - stop_price)
    if stop_width <= 0:
        return None

    risk_amount = equity * risk_rate
    raw = risk_amount / stop_width
    recommended = round_quantity(raw, allow_fractional=allow_fractional)
    if recommended < min_quantity:
        recommended = 0.0
    if max_quantity is not None and recommended > max_quantity:
        recommended = round_quantity(max_quantity, allow_fractional=allow_fractional)

    # 最大株数: 全額投下（整数切り捨て）
    max_shares = round_quantity(equity / entry_price, allow_fractional=allow_fractional)
    if max_quantity is not None and max_shares > max_quantity:
        max_shares = round_quantity(max_quantity, allow_fractional=allow_fractional)
    if recommended > max_shares:  # pragma: no cover — max_quantity で先に抑えることが多い
        recommended = max_shares

    # ATR ベースの参考（MM 再利用）。推奨より小さい場合は採用しない（損切幅ベースを正とする）
    if atr is not None and atr > 0 and stop_multiple is not None and stop_multiple > 0:
        _ = compute_unit_quantity(
            equity=equity,
            risk_rate=risk_rate,
            atr_value=atr,
            stop_multiple=stop_multiple,
            min_quantity=min_quantity,
            max_quantity=max_quantity,
            allow_fractional=allow_fractional,
        )

    required = recommended * entry_price
    max_loss = recommended * stop_width
    return PositionPlanResult(
        recommended_shares=recommended,
        max_shares=max_shares,
        required_capital=round(required, 2),
        max_loss=round(max_loss, 2),
        equity=equity,
        risk_rate=risk_rate,
    )
