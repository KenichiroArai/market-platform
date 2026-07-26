"""analysis アプリのヘルス・エラー・ログの単体テスト（カバレッジ 100%）。"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.errors import create_api_error_body, register_exception_handlers
from app.logging_middleware import RequestLoggingMiddleware
from app.main import app, health
from app.schemas import HealthResponse


def test_health_endpoint() -> None:
    """GET /health が 200 と HealthResponse 形を返すこと。"""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "analysis"
    assert "uptimeSeconds" in body["details"]


def test_health_function_direct() -> None:
    """ルートハンドラを直接呼び出せること（カバレッジ補完）。"""
    result = health()
    assert isinstance(result, HealthResponse)
    assert result.status == "ok"
    assert result.service == "analysis"


def test_create_api_error_body_omits_none() -> None:
    """details / path 未指定時はキー自体が無いこと。"""
    body = create_api_error_body(status_code=500, code="INTERNAL_ERROR", message="boom")
    assert body["statusCode"] == 500
    assert "details" not in body
    assert "path" not in body
    assert "timestamp" in body


def test_create_api_error_body_with_optional_fields() -> None:
    """details / path 指定時に含まれること。"""
    body = create_api_error_body(
        status_code=400,
        code="VALIDATION_FAILED",
        message="bad",
        details=["x"],
        path="/x",
    )
    assert body["details"] == ["x"]
    assert body["path"] == "/x"


def test_http_exception_handler_maps_401() -> None:
    """HTTPException 401 が AUTH_UNAUTHORIZED になること。"""
    mini = FastAPI()
    register_exception_handlers(mini)

    @mini.get("/secure")
    def secure() -> None:
        raise HTTPException(status_code=401, detail="no token")

    client = TestClient(mini, raise_server_exceptions=False)
    response = client.get("/secure")
    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_UNAUTHORIZED"


def test_http_exception_handler_maps_other_status() -> None:
    """その他の HTTPException が HTTP_{status} になること。"""
    mini = FastAPI()
    register_exception_handlers(mini)

    @mini.get("/gone")
    def gone() -> None:
        raise HTTPException(status_code=404, detail="missing")

    client = TestClient(mini, raise_server_exceptions=False)
    response = client.get("/gone")
    assert response.status_code == 404
    assert response.json()["code"] == "HTTP_404"


def test_validation_exception_handler() -> None:
    """バリデーション失敗が VALIDATION_FAILED になること。"""
    mini = FastAPI()
    register_exception_handlers(mini)

    @mini.post("/echo")
    def echo(payload: HealthResponse) -> HealthResponse:
        return payload

    client = TestClient(mini, raise_server_exceptions=False)
    response = client.post("/echo", json={"status": "nope", "service": "x"})
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_FAILED"


def test_unhandled_exception_handler() -> None:
    """未処理例外が INTERNAL_ERROR になること。"""
    mini = FastAPI()
    register_exception_handlers(mini)

    @mini.get("/boom")
    def boom() -> None:
        raise RuntimeError("explode")

    client = TestClient(mini, raise_server_exceptions=False)
    response = client.get("/boom")
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"


def test_request_logging_middleware() -> None:
    """middleware がレスポンスを通しつつログを出すこと。"""
    mini = FastAPI()
    mini.add_middleware(RequestLoggingMiddleware)

    @mini.get("/ping")
    def ping() -> dict[str, str]:
        return {"ok": "1"}

    client = TestClient(mini)
    response = client.get("/ping")
    assert response.status_code == 200
    assert response.json() == {"ok": "1"}
