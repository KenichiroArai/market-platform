"""
分析 API（FastAPI）のエントリ。

Phase 1 ではヘルスチェックに加え、共通エラー形式・リクエストログ・OpenAPI 整備を行う。
テクニカル分析・バックテスト・AI は後続 Phase でここに拡張する。
NestJS（api）からは内部 HTTP（ANALYSIS_URL）経由で呼ばれる想定（認証なし）。
"""

from __future__ import annotations

import time

from fastapi import FastAPI

from app.errors import register_exception_handlers
from app.logging_middleware import RequestLoggingMiddleware
from app.schemas import HealthResponse

# プロセス起動時刻。uptimeSeconds 算出用。
_STARTED_AT = time.time()

app = FastAPI(
    title="market-analysis",
    version="0.1.0",
    description="market-platform 分析 API（FastAPI）。NestJS から内部 HTTP で呼ばれる。",
)

# 共通エラーとリクエストログを配線
register_exception_handlers(app)
app.add_middleware(RequestLoggingMiddleware)


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """プロセス生存確認用。依存 DB は持たない（永続化は NestJS 側の責務）。"""
    return HealthResponse(
        status="ok",
        service="analysis",
        details={"uptimeSeconds": int(time.time() - _STARTED_AT)},
    )
