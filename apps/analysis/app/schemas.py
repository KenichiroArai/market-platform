"""
NestJS と揃えた API 契約（Pydantic モデル）。

TypeScript の shared-types には依存させず、JSON 形だけをミラーする。
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, SerializerFunctionWrapHandler, model_serializer, model_validator


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
SignalStrategyType = Literal["smaCross", "rsiThreshold", "macdCross", "trendScoreThreshold"]
TradeSide = Literal["buy", "sell"]
TradeSidePolicy = Literal["longOnly", "longShort"]
FeeMode = Literal["rate", "fixed"]
AtrKind = Literal["atr", "n"]


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

    @model_serializer(mode="wrap")
    def omit_none_fields(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        data = handler(self)
        return {key: value for key, value in data.items() if value is not None}


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

    @model_serializer(mode="wrap")
    def omit_null_drawings(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        data = handler(self)
        if data.get("drawings") is None:
            data.pop("drawings", None)
        return data


class TrendScorePoint(BaseModel):
    """1 日分のトレンドスコア。"""

    date: str
    score: float | None
    groups: dict[str, float | None]
    indicators: dict[str, float | None]


class ComputeTrendScoreRequest(BaseModel):
    """POST /trend-score のリクエスト。指標セットはサーバ側で固定。配点・パラメータは任意上書き。"""

    bars: list[OhlcBar]
    rangeStartIndex: int = 0
    groupWeights: dict[str, float] | None = None
    indicatorParams: dict[str, dict[str, float]] | None = None


class ComputeTrendScoreResponse(BaseModel):
    """POST /trend-score のレスポンス。"""

    points: list[TrendScorePoint]


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
    buyThreshold: float | None = None
    sellThreshold: float | None = None

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
        elif self.strategyType == "trendScoreThreshold":
            if self.buyThreshold is None or self.sellThreshold is None:
                raise ValueError("trendScoreThreshold requires buyThreshold and sellThreshold")
            if self.buyThreshold < -100 or self.buyThreshold > 100:
                raise ValueError("trendScoreThreshold buyThreshold must be in [-100, 100]")
            if self.sellThreshold < -100 or self.sellThreshold > 100:
                raise ValueError("trendScoreThreshold sellThreshold must be in [-100, 100]")
            if self.buyThreshold <= self.sellThreshold:
                raise ValueError("trendScoreThreshold buyThreshold must be > sellThreshold")
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
    """バックテスト内の約定行。

    entryReason / exitReason は安定コード（例: sma_golden_cross）。
    entryScore / exitScore は判断に使った数値（例: RSI・トレンドスコア）。スコア非採用時は None。
    entryScoreBreakdown / exitScoreBreakdown はトレンドスコア内訳（groups + indicators）。
    既存クライアント互換のため省略時は None。
    """

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
    entryReason: str | None = None
    exitReason: str | None = None
    entryScore: float | None = None
    exitScore: float | None = None
    entryScoreBreakdown: dict[str, Any] | None = None
    exitScoreBreakdown: dict[str, Any] | None = None
    atr: float | None = None
    n: float | None = None
    riskRate: float | None = None
    initialQuantity: float | None = None
    addCount: int | None = None
    stopPrice: float | None = None
    unitCount: int | None = None


class MoneyManagementStatsModel(BaseModel):
    """資金管理統計（ADR 016）。"""

    averageRiskRate: float | None = None
    maxRiskRate: float | None = None
    averageAtr: float | None = None
    averageUnits: float | None = None
    maxUnits: float | None = None
    pyramidingSuccessRate: float | None = None
    averageRiskRateInDrawdown: float | None = None


class BacktestEquityPoint(BaseModel):
    """エクイティカーブの一点。"""

    date: str
    cash: float
    positionValue: float
    equity: float
    drawdownRate: float
    decisionScore: float | None = None
    scoreBreakdown: dict[str, Any] | None = None


class BacktestSummary(BaseModel):
    """バックテスト集計。率は小数（例: 0.12 = 12%）。

    sharpeRatio: 日次エクイティ収益率の年率シャープ（リスクフリー 0、√252）。
    profitFactor: 勝ちトレード純損益合計 / |負け合計|。負け 0 かつ勝ちありなら勝ち合計、
                  トレードなしまたは勝ちなしなら 0。
    buyHold*: 初日終値で全額買い・末日終値で評価（fee/slippage なし）。
    """

    finalEquity: float
    totalReturnRate: float
    maxDrawdownRate: float
    totalTrades: int
    winRate: float
    sharpeRatio: float
    profitFactor: float
    buyHoldReturnRate: float
    buyHoldFinalEquity: float
    moneyManagement: MoneyManagementStatsModel | None = None


class RunBacktestRequest(BaseModel):
    """POST /backtests/run の入力。

    rangeStartIndex: lookback 付き bars のうち、売買・エクイティを開始するインデックス。
    チャートのトレンドスコアと同様、ウォームアップ分はシグナル計算に使うがシミュレーションには含めない。
    """

    symbolId: str
    bars: list[OhlcBar]
    signal: SignalSpec
    initialCash: float = Field(gt=0)
    feeRate: float = Field(ge=0)
    feeMode: FeeMode = "rate"
    feeFixed: float = Field(default=0.0, ge=0)
    slippageRate: float = Field(ge=0)
    tradeSidePolicy: TradeSidePolicy = "longOnly"
    moneyManagement: dict[str, Any] | None = None
    rangeStartIndex: int = Field(default=0, ge=0)


class RunBacktestResponse(BaseModel):
    """POST /backtests/run の出力。"""

    summary: BacktestSummary
    trades: list[BacktestTrade]
    equityPoints: list[BacktestEquityPoint]


class OptimizeBacktestRequest(BaseModel):
    """POST /backtests/optimize の入力。SMA Cross の short/long 総当たり。"""

    symbolId: str
    bars: list[OhlcBar]
    initialCash: float = Field(gt=0)
    feeRate: float = Field(ge=0)
    feeMode: FeeMode = "rate"
    feeFixed: float = Field(default=0.0, ge=0)
    slippageRate: float = Field(ge=0)
    tradeSidePolicy: TradeSidePolicy = "longOnly"
    moneyManagement: dict[str, Any] | None = None
    strategyType: Literal["smaCross"] = "smaCross"
    shortMin: int = Field(default=5, ge=1)
    shortMax: int = Field(default=50, ge=1)
    longMin: int = Field(default=5, ge=1)
    longMax: int = Field(default=50, ge=1)

    @model_validator(mode="after")
    def validate_ranges(self) -> "OptimizeBacktestRequest":
        if self.shortMin > self.shortMax:
            raise ValueError("shortMin must be <= shortMax")
        if self.longMin > self.longMax:
            raise ValueError("longMin must be <= longMax")
        return self


class OptimizeBacktestResultItem(BaseModel):
    """最適化の 1 組み合わせ結果。"""

    shortPeriod: int
    longPeriod: int
    summary: BacktestSummary


class OptimizeBacktestResponse(BaseModel):
    """POST /backtests/optimize の出力。totalReturnRate 降順。"""

    results: list[OptimizeBacktestResultItem]
