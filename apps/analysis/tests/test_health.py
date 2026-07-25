from fastapi.testclient import TestClient

from app.main import app, health


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "analysis"}


def test_health_function_direct() -> None:
    assert health() == {"status": "ok", "service": "analysis"}
