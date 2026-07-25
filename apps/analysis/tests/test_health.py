"""analysis アプリのヘルスチェック単体テスト。

HTTP 経由と関数直接呼び出しの両方を通し、カバレッジ 100% を満たす。
"""

from fastapi.testclient import TestClient

from app.main import app, health


def test_health_endpoint() -> None:
    """GET /health が 200 と固定 JSON を返すこと。"""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "analysis"}


def test_health_function_direct() -> None:
    """ルートハンドラを直接呼び出せること（カバレッジ補完）。"""
    assert health() == {"status": "ok", "service": "analysis"}
