from __future__ import annotations

import os
import pytest

if os.getenv("RUN_POSTGRES_INTEGRATION") != "1":
    pytest.skip("PostgreSQL API integration tests run only in the dedicated CI database.", allow_module_level=True)

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg://")):
    pytest.skip("DATABASE_URL must point to a PostgreSQL test database.", allow_module_level=True)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base, get_db
from backend.app.main import app


@pytest.fixture()
def postgres_client():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

    def override_get_db():
        session = testing_session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_postgres_api_reservation_duplicate_reference_and_delivered_kpi(postgres_client):
    product_response = postgres_client.post("/api/v1/products", json={
        "sku": "PG-API-1",
        "name": "PostgreSQL integration product",
        "unit_price": "7.25",
        "stock_quantity": 3,
        "reorder_threshold": 1,
    })
    assert product_response.status_code == 201, product_response.text
    product = product_response.json()

    payload = {"reference": "PG-SHP-1", "product_id": product["id"], "quantity": 2}
    created = postgres_client.post("/api/v1/shipments", json=payload)
    assert created.status_code == 201, created.text
    assert postgres_client.post("/api/v1/shipments", json=payload).status_code == 409
    assert postgres_client.get("/api/v1/products").json()[0]["stock_quantity"] == 1

    too_large = postgres_client.post("/api/v1/shipments", json={
        "reference": "PG-SHP-2", "product_id": product["id"], "quantity": 2
    })
    assert too_large.status_code == 409
    assert len(postgres_client.get("/api/v1/shipments").json()) == 1

    shipment_id = created.json()["id"]
    assert postgres_client.patch(f"/api/v1/shipments/{shipment_id}/status", json={"status": "in_transit"}).status_code == 200
    delivered = postgres_client.patch(f"/api/v1/shipments/{shipment_id}/status", json={"status": "delivered"})
    assert delivered.status_code == 200
    assert postgres_client.get("/api/v1/analytics/operations").json()["delivered_value"] == "14.50"


def test_postgres_api_cancellation_returns_stock_once(postgres_client):
    product_response = postgres_client.post("/api/v1/products", json={
        "sku": "PG-CANCEL-1",
        "name": "Cancellation integration product",
        "unit_price": "10.00",
        "stock_quantity": 4,
        "reorder_threshold": 1,
    })
    assert product_response.status_code == 201, product_response.text
    product = product_response.json()
    shipment_response = postgres_client.post("/api/v1/shipments", json={
        "reference": "PG-CANCEL-SHP-1", "product_id": product["id"], "quantity": 3
    })
    assert shipment_response.status_code == 201, shipment_response.text
    shipment = shipment_response.json()

    status_path = f"/api/v1/shipments/{shipment['id']}/status"
    assert postgres_client.patch(status_path, json={"status": "cancelled"}).status_code == 200
    assert postgres_client.patch(status_path, json={"status": "cancelled"}).status_code == 200
    products = postgres_client.get("/api/v1/products").json()
    restored = next(item for item in products if item["id"] == product["id"])
    assert restored["stock_quantity"] == 4
