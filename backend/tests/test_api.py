from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_preview_csv() -> None:
    response = client.post(
        "/api/v1/sales/preview",
        files={"file": ("sales.csv", "تاریخ,فاکتور,مبلغ\n2026-10-01,F-1,1200\n".encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["columns"] == ["تاریخ", "فاکتور", "مبلغ"]
    assert payload["row_count"] == 1
    assert payload["persistent_storage"] is False


def test_preview_rejects_unknown_extension() -> None:
    response = client.post(
        "/api/v1/sales/preview",
        files={"file": ("bad.exe", b"nope", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "CSV یا XLSX" in response.json()["detail"]


def test_preview_rejects_duplicate_headers() -> None:
    response = client.post(
        "/api/v1/sales/preview",
        files={"file": ("sales.csv", "id,id\n1,2\n".encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 400
    assert "تکراری" in response.json()["detail"]
