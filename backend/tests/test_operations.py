from __future__ import annotations
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from backend.app.database import Base, get_db
from backend.app.main import app

@pytest.fixture()
def client():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(engine)
    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()

def create_product(client, *, sku="SKU-1", stock=10, price="12.50"):
    return client.post("/api/v1/products", json={"sku": sku, "name": "Test product", "unit_price": price,
        "stock_quantity": stock, "reorder_threshold": 2})

def test_product_validation_duplicate_sku_and_filtering(client):
    assert create_product(client).status_code == 201
    assert create_product(client).status_code == 409
    invalid = client.post("/api/v1/products", json={"sku": "bad sku", "name": "Bad", "unit_price": "-1",
        "stock_quantity": -1, "reorder_threshold": 0})
    assert invalid.status_code == 422
    assert client.get("/api/v1/products", params={"low_stock": "true"}).json() == []

def test_shipment_decrements_stock_and_duplicate_reference_is_rejected(client):
    product = create_product(client, stock=5).json()
    payload = {"reference": "SHP-1", "product_id": product["id"], "quantity": 3}
    created = client.post("/api/v1/shipments", json=payload)
    assert created.status_code == 201
    assert created.json()["unit_price_snapshot"] == "12.50"
    assert client.post("/api/v1/shipments", json=payload).status_code == 409
    assert client.get("/api/v1/products").json()[0]["stock_quantity"] == 2

def test_insufficient_stock_does_not_create_shipment(client):
    product = create_product(client, stock=1).json()
    response = client.post("/api/v1/shipments", json={"reference": "SHP-2", "product_id": product["id"], "quantity": 2})
    assert response.status_code == 409
    assert client.get("/api/v1/shipments").json() == []
    assert client.get("/api/v1/products").json()[0]["stock_quantity"] == 1

def test_cancellation_restores_inventory_and_terminal_states_reject_changes(client):
    product = create_product(client, stock=7).json()
    shipment = client.post("/api/v1/shipments", json={"reference": "SHP-3", "product_id": product["id"], "quantity": 4}).json()
    assert client.get("/api/v1/products").json()[0]["stock_quantity"] == 3
    assert client.patch(f"/api/v1/shipments/{shipment['id']}/status", json={"status": "cancelled"}).status_code == 200
    assert client.get("/api/v1/products").json()[0]["stock_quantity"] == 7
    assert client.patch(f"/api/v1/shipments/{shipment['id']}/status", json={"status": "delivered"}).status_code == 409

def test_delivered_value_uses_price_snapshot(client):
    product = create_product(client, stock=8, price="15.00").json()
    shipment = client.post("/api/v1/shipments", json={"reference": "SHP-4", "product_id": product["id"], "quantity": 3}).json()
    assert client.patch(f"/api/v1/shipments/{shipment['id']}/status", json={"status": "in_transit"}).status_code == 200
    assert client.patch(f"/api/v1/shipments/{shipment['id']}/status", json={"status": "delivered"}).status_code == 200
    summary = client.get("/api/v1/analytics/operations").json()
    assert summary["active_products"] == 1
    assert summary["delivered_shipments"] == 1
    assert Decimal(summary["delivered_value"]) == Decimal("45.00")
