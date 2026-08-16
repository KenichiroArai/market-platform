"""
NestJS と揃えた API 契約（Pydantic モデル）。

TypeScript の shared-types には依存させず、JSON 形だけをミラーする。
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


HealthStatus = Literal["ok", "degraded", "error"]
IndicatorComputeType = Literal[
    "sma",
    "ema",
    "macd",
    "ichimoku",
    "psar",
    "momentum",
    "roc",
    "rsi",
    "cci",
    "stoch",
    "willr",
    "psy",
    "bb",
    "atr",
    "stdev",
    "keltner",
    "obv",
    "vwap",
    "mfi",
    "volumeProfile",
    "fibonacci",
]
SignalStrategyType = Literal["smaCross", "rsiThreshold", "macdCross"]
TradeSide = Literal["buy", "sell"]


class HealthResponse(BaseModel):
    """ヘルスチェックの標準レスポンス。Nest / web と同じフィールド名。"""

    status: HealthStatus
    service: str
    details: dict[str, Any] | None = None


class ApiErrorBody(BaseModel):
    """共通エラー形式。Nest の ApiExceptionFilter と同じ JSON 形。"""

    statusCode: int
    code: str
    message: str
    details: Any | None = None
    path: str | None = None
    timestamp: str = Field(description="ISO 8601 UTC")


class OhlcBar(BaseModel):
    """日足 1 本。Nest が Prisma DailyPrice からマッピングして渡す。"""

    date: str = Field(description="YYYY-MM-DD")
    open: float
    high: float
    low: float
    close: float
    volume: float


class IndicatorSpec(BaseModel):
    """1 指標の計算指定（カタログ ID + 種類 + 既定パラメータ）。"""

    id: str
    type: IndicatorComputeType
    params: dict[str, float] = Field(default_factory=dict)


class IndicatorSeriesPoint(BaseModel):
    """1 日分の指標値。キーは series.key（sma25, bbUpper など）。"""

    date: str
    values: dict[str, float | None] = Field(default_factory=dict)


class FibonacciLevel(BaseModel):
    """フィボナッチ 1 本。"""

    ratio: float
    price: float


class FibonacciDrawing(BaseModel):
    """表示期間の高値〜安値から引く水平線。"""

    high: float
    low: float
    highDate: str
    lowDate: str
    levels: list[FibonacciLevel]


class VolumeProfileBin(BaseModel):
    """Volume Profile の 1 ビン。"""

    priceLow: float
    priceHigh: float
    volume: float


class VolumeProfileDrawing(BaseModel):
    """価格帯ごとの出来高。"""

    bins: list[VolumeProfileBin]


class IndicatorDrawings(BaseModel):
    """日付列ではない描画データ。"""

    fibonacci: FibonacciDrawing | None = None
    volumeProfile: VolumeProfileDrawing | None = None


class ComputeIndicatorsRequest(BaseModel):
    """POST /indicators のリクエスト。"""

    bars: list[OhlcBar]
    indicators: list[IndicatorSpec] = Field(min_length=1)
    rangeStartIndex: int = 0


class ComputeIndicatorsResponse(BaseModel):
    """POST /indicators のレスポンス（shared-types IndicatorsResponseDto と同形）。"""

    indicators: list[IndicatorSpec]
    points: list[IndicatorSeriesPoint]
    drawings: IndicatorDrawings | None = None


class SignalSpec(BaseModel):
    """売買シグナル計算の戦略指定。type ごとに必要パラメータが異なる。"""

    strategyType: SignalStrategyType
    shortPeriod: int | None = None
    longPeriod: int | None = None
    period: int | None = None
    lower: float | None = None
    upper: float | None = None
    fast: int | None = None
    slow: int | None = None
    signal: int | None = None

    @model_validator(mode="after")
    def validate_params(self) -> "SignalSpec":
        if self.strategyType == "smaCross":
            if self.shortPeriod is None or self.longPeriod is None:
                raise ValueError("smaCross requires shortPeriod and longPeriod")
            if self.shortPeriod < 1 or self.longPeriod < 1:
                raise ValueError("smaCross periods must be >= 1")
            if self.shortPeriod >= self.longPeriod:
                raise ValueError("smaCross shortPeriod must be < longPeriod")
        elif self.strategyType == "rsiThreshold":
            if self.period is None or self.lower is None or self.upper is None:
                raise ValueError("rsiThreshold requires period, lower, upper")
            if self.period < 1:
                raise ValueError("rsiThreshold period must be >= 1")
            if self.lower < 0 or self.upper > 100 or self.lower >= self.upper:
                raise ValueError("rsiThreshold lower/upper must satisfy 0<=lower<upper<=100")
        elif self.strategyType == "macdCross":
            if self.fast is None or self.slow is None or self.signal is None:
                raise ValueError("macdCross requires fast, slow, signal")
            if self.fast < 1 or self.slow < 1 or self.signal < 1:
                raise ValueError("macdCross fast/slow/signal must be >= 1")
            if self.fast >= self.slow:
                raise ValueError("macdCross fast must be < slow")
        return self


class SignalPoint(BaseModel):
    """日次の売買シグナル。ロング限定で buy/sell を bool で返す。"""

    date: str
    buy: bool
    sell: bool


class ComputeSignalsRequest(BaseModel):
    """POST /signals/compute の入力。"""

    bars: list[OhlcBar]
    signal: SignalSpec


class ComputeSignalsResponse(BaseModel):
    """POST /signals/compute の出力。"""

    points: list[SignalPoint]


class BacktestTrade(BaseModel):
    """バックテスト内の約定行。"""

    symbolId: str
    entryDate: str
    exitDate: str
    entryPrice: float
    exitPrice: float
    quantity: float
    side: TradeSide
    grossPnl: float
    feeAmount: float
    slippageAmount: float
    netPnl: float


class BacktestEquityPoint(BaseModel):
    """エクイティカーブの一点。"""

    date: str
    cash: float
    positionValue: float
    equity: float
    drawdownRate: float


class BacktestSummary(BaseModel):
    """バックテスト集計。率は小数（例: 0.12 = 12%）。"""

    finalEquity: float
    totalReturnRate: float
    maxDrawdownRate: float
    totalTrades: int
    winRate: float


class RunBacktestRequest(BaseModel):
    """POST /backtests/run の入力。"""

    symbolId: str
    bars: list[OhlcBar]
    signal: SignalSpec
    initialCash: float = Field(gt=0)
    feeRate: float = Field(ge=0)
    slippageRate: float = Field(ge=0)


class RunBacktestResponse(BaseModel):
    """POST /backtests/run の出力。"""

    summary: BacktestSummary
    trades: list[BacktestTrade]
    equityPoints: list[BacktestEquityPoint]
