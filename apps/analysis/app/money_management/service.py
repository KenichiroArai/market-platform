"""資金管理 Facade。シミュレータから呼び出す入口。"""

from __future__ import annotations

from app.indicators.extras import atr as atr_wilder
from app.money_management.correlation_management import (
    correlation_allows_entry,
    correlation_unit_cap,
)
from app.money_management.position_sizing import compute_unit_quantity, round_quantity
from app.money_management.pyramiding import can_add_pyramid_unit
from app.money_management.risk_management import resolve_effective_risk_rate
from app.money_management.types import MoneyManagementConfig, MoneyManagementStats


class MoneyManagementService:
    """各 MM モジュールを束ねるサービス。enabled=False なら呼び出し側が全額パスを使う。"""

    def __init__(self, config: MoneyManagementConfig) -> None:
        self.config = config

    @property
    def enabled(self) -> bool:
        return self.config.enabled

    def compute_atr_series(
        self,
        highs: list[float],
        lows: list[float],
        closes: list[float],
    ) -> list[float | None]:
        """ATR / N 系列。現行はどちらも Wilder ATR（種類は記録用に保持）。"""
        return atr_wilder(highs, lows, closes, self.config.atrPeriod)

    def volatility_at(self, series: list[float | None], index: int) -> float | None:
        """指定インデックスの ATR/N。不足時 None。"""
        if index < 0 or index >= len(series):
            return None
        value = series[index]
        return None if value is None else float(value)

    def effective_risk(self, *, equity: float, equity_high: float) -> tuple[float, int]:
        return resolve_effective_risk_rate(self.config, equity=equity, equity_high=equity_high)

    def unit_quantity(
        self,
        *,
        equity: float,
        equity_high: float,
        atr_value: float,
    ) -> tuple[float, float, int]:
        """1 ユニット数量と実効リスク率・DD 段数。"""
        risk, steps = self.effective_risk(equity=equity, equity_high=equity_high)
        qty = compute_unit_quantity(
            equity=equity,
            risk_rate=risk,
            atr_value=atr_value,
            stop_multiple=self.config.stopMultiple,
            min_quantity=self.config.minQuantity,
            max_quantity=self.config.maxQuantity,
            allow_fractional=self.config.allowFractionalQuantity,
        )
        return qty, risk, steps

    def stop_price(self, *, is_long: bool, entry_price: float, atr_value: float) -> float:
        width = atr_value * self.config.stopMultiple
        if is_long:
            return entry_price - width
        return entry_price + width

    def round_qty(self, quantity: float) -> float:
        return round_quantity(
            quantity,
            allow_fractional=self.config.allowFractionalQuantity,
        )

    def max_units_for_symbol(self, symbol_id: str) -> int:
        return correlation_unit_cap(
            config=self.config.correlation,
            symbol_id=symbol_id,
            pyramid_max_units=self.config.pyramiding.maxUnits,
        )

    def allows_units(
        self,
        *,
        symbol_id: str,
        current_units: float,
        add_units: float,
        current_risk: float,
        add_risk: float,
    ) -> bool:
        return correlation_allows_entry(
            config=self.config.correlation,
            symbol_id=symbol_id,
            current_units=current_units,
            add_units=add_units,
            current_risk=current_risk,
            add_risk=add_risk,
        )

    def can_pyramid(
        self,
        *,
        is_long: bool,
        first_entry_price: float,
        current_price: float,
        atr_value: float,
        current_units: int,
        symbol_id: str,
        unit_risk: float,
    ) -> bool:
        max_units = self.max_units_for_symbol(symbol_id)
        if not can_add_pyramid_unit(
            enabled=self.config.pyramiding.enabled,
            is_long=is_long,
            first_entry_price=first_entry_price,
            current_price=current_price,
            atr_value=atr_value,
            step_atr_multiple=self.config.pyramiding.stepAtrMultiple,
            current_units=current_units,
            max_units=max_units,
        ):
            return False
        return self.allows_units(
            symbol_id=symbol_id,
            current_units=current_units,
            add_units=1,
            current_risk=unit_risk * current_units,
            add_risk=unit_risk,
        )


def build_mm_stats(
    *,
    risk_rates: list[float],
    atrs: list[float],
    units: list[float],
    pyramid_trades_won: int,
    pyramid_trades_total: int,
    dd_risk_rates: list[float],
) -> MoneyManagementStats | None:
    """トレードから統計を組み立てる。データが無ければ空に近い統計を返す。"""
    if not risk_rates and not atrs and not units:
        return MoneyManagementStats()

    def avg(values: list[float]) -> float | None:
        return None if not values else sum(values) / len(values)

    pyr_rate = None
    if pyramid_trades_total > 0:
        pyr_rate = pyramid_trades_won / pyramid_trades_total

    return MoneyManagementStats(
        averageRiskRate=avg(risk_rates),
        maxRiskRate=max(risk_rates) if risk_rates else None,
        averageAtr=avg(atrs),
        averageUnits=avg(units),
        maxUnits=max(units) if units else None,
        pyramidingSuccessRate=pyr_rate,
        averageRiskRateInDrawdown=avg(dd_risk_rates),
    )
