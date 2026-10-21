# DistroPulse

**Distribution Operations, Inventory & Delivery Analytics**

DistroPulse is a portfolio MVP for small distributors and wholesalers. It combines an in-browser sales-file preview with a FastAPI backend for product catalogue, stock-safe shipment creation, shipment status transitions, and operational analytics.

> **Demo and deployment note:** dashboard sample rows are synthetic. The operational API persists records in PostgreSQL when configured with the provided Compose setup. Backend API tests use isolated in-memory SQLite. Authentication, organization-level access controls, payment integration, and multi-tenant isolation are not implemented; do not expose this demo to real customer data or the public internet.

## Current capabilities

- Responsive English-language dashboard with synthetic sample data and file preview.
- CSV/XLSX in-memory preview with file-size and row-count limits; preview uploads are not persisted.
- Product API with SKU uniqueness, filtering, low-stock filtering, and bounded pagination.
- Shipment API with atomic stock decrement, price snapshot, duplicate-reference protection, and guarded status transitions.
- Cancellation returns reserved stock; delivered and cancelled shipments are terminal.
- Operations summary: active products, low-stock products, shipment states, and delivered shipment value.
- SQLAlchemy 2 models, Alembic migration, PostgreSQL Compose service, OpenAPI docs, and unit/API tests.

## Quick start (Windows PowerShell)

### Option A — PostgreSQL with Docker

Requirements: Docker Desktop, Python 3.11+ for local tooling, and Node.js 20+ for the frontend.

    Copy-Item .env.example .env
    docker compose up --build

API health: http://localhost:8000/api/v1/health  
Interactive API docs: http://localhost:8000/docs

### Option B — local Python with SQLite for development only

    py -3.12 -m venv .venv
    .\.venv\Scripts\Activate.ps1
    python -m pip install --upgrade pip
    python -m pip install -e ".[test]"
    $env:DATABASE_URL = "sqlite:///./distropulse.db"
    alembic upgrade head
    uvicorn backend.app.main:app --reload --port 8000

### Frontend

In a second PowerShell window:

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173. The dashboard defaults to synthetic demo data. Imported files are parsed in the browser and are not submitted to the API.

### Tests and build

From the repository root:

    python -m pip install -e ".[test]"
    python -m pytest -q

Then:

    cd frontend
    npm test
    npm run build

## API overview

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/health | Health check |
| POST | /api/v1/sales/preview | In-memory file preview |
| GET / POST | /api/v1/products | List/create products |
| GET / POST | /api/v1/shipments | List/create shipments |
| PATCH | /api/v1/shipments/{id}/status | Guarded shipment state transition |
| GET | /api/v1/analytics/operations | Operational KPI summary |

See docs/API.md for endpoint contracts and documented limitations.

## Operational invariants

- Product stock cannot be negative; the database includes a check constraint.
- Shipment quantity must be positive.
- Shipment creation uses a conditional database update so concurrent reservations cannot consume more stock than is available.
- Shipment references are unique. Retrying a reference returns a conflict and cannot reserve the same stock twice.
- Cancelling a planned or in-transit shipment returns reserved units inside the same transaction.
- Delivered value is calculated only for delivered shipments using the unit-price snapshot captured at shipment creation. It is not profit or cash settlement.

## Limitations

Authentication, tenant/object authorization, customer data retention, background processing, payment, and external carrier integrations are not implemented. The file-preview flow is separate from the persisted operational API. Route unit tests use SQLite; CI additionally runs dedicated PostgreSQL 16 API integration tests for stock reservation, duplicate references, insufficient stock, cancellation restoration, and delivered-value calculations. High-concurrency load testing remains unimplemented.

## Future improvements

Add PostgreSQL API integration and concurrency tests, authenticated organization permissions, import mapping and reconciliation, audit logging, return workflows, delivery assignment, and a customer-approved pilot.
