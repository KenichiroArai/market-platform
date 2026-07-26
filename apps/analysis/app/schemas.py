"""
NestJS と揃えた API 契約（Pydantic モデル）。

TypeScript の shared-types には依存させず、JSON 形だけをミラーする。
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


HealthStatus = Literal["ok", "degraded", "error"]


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
