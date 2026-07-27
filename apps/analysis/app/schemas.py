"""
NestJS と揃えた API 契約（Pydantic モデル）。

TypeScript の shared-types には依存させず、JSON 形だけをミラーする。
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


HealthStatus = Literal["ok", "degraded", "error"]
IndicatorType = Literal["sma", "ema", "rsi", "macd"]


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
    """
    1 指標の計算指定。

    type に応じて period または fast/slow/signal を使う。
    """

    type: IndicatorType
    period: int | None = None
    fast: int | None = None
    slow: int | None = None
    signal: int | None = None

    @model_validator(mode="after")
    def validate_params(self) -> IndicatorSpec:
        """type ごとの必須パラメータを検証する。"""
        if self.type in ("sma", "ema", "rsi"):
            if self.period is None or self.period < 1:
                raise ValueError(f"{self.type} requires period >= 1")
        elif self.type == "macd":
            if self.fast is None or self.slow is None or self.signal is None:
                raise ValueError("macd requires fast, slow, and signal")
            if self.fast < 1 or self.slow < 1 or self.signal < 1:
                raise ValueError("macd fast/slow/signal must be >= 1")
            if self.fast >= self.slow:
                raise ValueError("macd fast must be < slow")
        return self


class IndicatorSeriesPoint(BaseModel):
    """1 日分の指標値。要求されたキーだけが埋まる。"""

    date: str
    sma: float | None = None
    ema: float | None = None
    rsi: float | None = None
    macd: float | None = None
    macdSignal: float | None = None
    macdHistogram: float | None = None


class ComputeIndicatorsRequest(BaseModel):
    """POST /indicators のリクエスト。"""

    bars: list[OhlcBar]
    indicators: list[IndicatorSpec] = Field(min_length=1)


class ComputeIndicatorsResponse(BaseModel):
    """POST /indicators のレスポンス（shared-types IndicatorsResponseDto と同形）。"""

    indicators: list[IndicatorSpec]
    points: list[IndicatorSeriesPoint]
