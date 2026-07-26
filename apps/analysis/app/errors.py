"""
共通エラー形式への変換と例外ハンドラ登録。

NestJS の ApiErrorBody と同じキーで返し、api / web が同じ分岐を使えるようにする。
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas import ApiErrorBody


def _now_iso() -> str:
    """UTC の ISO 8601 文字列を返す。"""
    return datetime.now(timezone.utc).isoformat()


def create_api_error_body(
    *,
    status_code: int,
    code: str,
    message: str,
    details: object | None = None,
    path: str | None = None,
) -> dict[str, object]:
    """ApiErrorBody 互換の dict を組み立てる（レスポンス用）。"""
    body = ApiErrorBody(
        statusCode=status_code,
        code=code,
        message=message,
        details=details,
        path=path,
        timestamp=_now_iso(),
    )
    # exclude_none で未設定フィールドを落とし、ペイロードを最小にする
    return body.model_dump(exclude_none=True)


def register_exception_handlers(app: FastAPI) -> None:
    """FastAPI アプリに共通エラーハンドラを登録する。"""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "AUTH_UNAUTHORIZED" if exc.status_code == 401 else f"HTTP_{exc.status_code}"
        return JSONResponse(
            status_code=exc.status_code,
            content=create_api_error_body(
                status_code=exc.status_code,
                code=code,
                message=str(exc.detail),
                path=str(request.url.path),
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=create_api_error_body(
                status_code=422,
                code="VALIDATION_FAILED",
                message="Validation failed",
                details=exc.errors(),
                path=str(request.url.path),
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        # クライアントには内部詳細を出さず、ログは uvicorn 側に任せる
        return JSONResponse(
            status_code=500,
            content=create_api_error_body(
                status_code=500,
                code="INTERNAL_ERROR",
                message="Internal server error",
                path=str(request.url.path),
            ),
        )
