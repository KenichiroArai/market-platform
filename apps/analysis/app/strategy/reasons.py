"""売買理由の説明可能リスト。"""

from __future__ import annotations

from app.strategy.judgment import JudgmentFactor


_REASON_CODE_LABELS: dict[str, str] = {
    "sma_golden_cross": "SMA ゴールデンクロス",
    "sma_dead_cross": "SMA デッドクロス",
    "macd_golden_cross": "MACD ゴールデンクロス",
    "macd_dead_cross": "MACD デッドクロス",
    "rsi_oversold": "RSI 売られすぎ反転",
    "rsi_overbought": "RSI 買われすぎ反転",
    "score_cross_up": "トレンドスコア上昇クロス",
    "score_cross_down": "トレンドスコア下降クロス",
}


def build_trade_reasons(
    *,
    factors: list[JudgmentFactor],
    entry_reason_code: str | None,
    is_long_bias: bool,
    sma25_slope_up: bool | None = None,
    volume_increasing: bool | None = None,
) -> tuple[list[str], list[str]]:
    """買い理由・売り理由のリストを返す。"""
    buy: list[str] = []
    sell: list[str] = []

    if entry_reason_code:
        label = _REASON_CODE_LABELS.get(entry_reason_code, entry_reason_code)
        if "dead" in entry_reason_code or "down" in entry_reason_code or "overbought" in entry_reason_code:
            sell.append(label)
        else:
            buy.append(label)

    for f in factors:
        if f.contribution > 0:
            buy.append(f"{f.label}: {f.note}")
        elif f.contribution < 0:
            sell.append(f"{f.label}: {f.note}")

    if sma25_slope_up is True:
        buy.append("25MA 上向き")
    elif sma25_slope_up is False:
        sell.append("25MA 下向き")

    if volume_increasing is True:
        buy.append("出来高増加")
    elif volume_increasing is False:
        sell.append("出来高減少")

    # バイアス側を優先表示（空なら反対側も残す）
    if is_long_bias and not buy and sell:  # pragma: no cover — 現状は両側を返す
        pass
    return buy, sell
