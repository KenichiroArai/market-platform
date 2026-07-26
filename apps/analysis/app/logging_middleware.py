"""
リクエスト単位の簡易ログ middleware。

method / path / status / duration を残し、Nest の LoggingInterceptor と揃える。
追加ライブラリは使わない。
"""

from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("market.analysis.http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """完了時に HTTP アクセスログを 1 行出す。"""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "%s %s %s %sms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response
