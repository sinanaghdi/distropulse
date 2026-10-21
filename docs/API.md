# DistroPulse API

Base path: /api/v1. Interactive OpenAPI documentation is at /docs.

## Health and sales-file preview

- GET /health returns service name, version and status.
- POST /sales/preview accepts multipart form field file (CSV or XLSX, at most 5 MiB). It returns headers, row counts and at most 20 preview records. File content is processed in memory and is not persisted. Invalid format returns 400; files over the size limit return 413.

## Products

POST /products creates a product with SKU, name, unit price, current stock and reorder threshold. Duplicate SKU returns 409; schema errors return 422.

GET /products?q=paper&low_stock=true&limit=50&offset=0 returns active products with optional search and low-stock filtering. Limit is bounded to 1–100 and offset cannot be negative.

## Shipments and stock

POST /shipments with reference, product_id and positive quantity creates a planned shipment and atomically reserves inventory. Unit price is captured as a snapshot at creation. Duplicate reference returns 409 without a second stock decrement. Missing/inactive products return 404; insufficient stock returns 409.

GET /shipments?status=in_transit&limit=50&offset=0 lists shipment records. Status filters are planned, in_transit, delivered and cancelled.

PATCH /shipments/{id}/status takes a JSON body such as {"status":"in_transit"}.

Allowed transitions: planned → in_transit or cancelled; in_transit → delivered or cancelled. Delivered and cancelled are terminal. Repeating the current status is idempotent. Cancellation releases the reserved units within the same transaction. Invalid transitions return 409; a missing shipment returns 404.

## Operational analytics

GET /analytics/operations returns active product count, low-stock product count, total shipments, in-transit shipments, delivered shipments and delivered shipment value. Delivered value = sum(quantity × unit_price_snapshot) for delivered shipments only. It is not profit, accounting revenue or cash settlement.

## Persistence and security limits

Operational tables are created by Alembic migrations. PostgreSQL is the intended Compose/CI database; route unit tests also use isolated SQLite fixtures. Authentication, tenant isolation and object-level authorization are not implemented. Do not deploy the service publicly or with customer data until those controls and PostgreSQL integration tests have been reviewed.
