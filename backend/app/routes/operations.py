from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import Product, Shipment
from backend.app.schemas import OperationsSummary, ProductCreate, ProductRead, ShipmentCreate, ShipmentRead, ShipmentStatusUpdate

router = APIRouter(prefix="/api/v1", tags=["distribution operations"])

@router.get("/products", response_model=list[ProductRead], summary="List and filter products")
def list_products(q: str | None = Query(default=None, min_length=1, max_length=100), low_stock: bool = False,
                 limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0),
                 db: Session = Depends(get_db)) -> list[Product]:
    statement = select(Product).where(Product.is_active.is_(True))
    if q:
        pattern = f"%{q.strip()}%"
        statement = statement.where(or_(Product.sku.ilike(pattern), Product.name.ilike(pattern)))
    if low_stock:
        statement = statement.where(Product.stock_quantity <= Product.reorder_threshold)
    return list(db.scalars(statement.order_by(Product.id).offset(offset).limit(limit)).all())

@router.post("/products", response_model=ProductRead, status_code=201, summary="Create a product")
def create_product(payload: ProductCreate, db: Session = Depends(get_db)) -> Product:
    product = Product(**payload.model_dump())
    db.add(product)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A product with this SKU already exists.") from exc
    db.refresh(product)
    return product

@router.post("/shipments", response_model=ShipmentRead, status_code=201, summary="Create a shipment and reserve stock")
def create_shipment(payload: ShipmentCreate, db: Session = Depends(get_db)) -> Shipment:
    if db.scalar(select(Shipment.id).where(Shipment.reference == payload.reference)) is not None:
        raise HTTPException(status_code=409, detail="Shipment reference already exists; duplicate request was not applied.")
    product = db.get(Product, payload.product_id)
    if product is None or not product.is_active:
        raise HTTPException(status_code=404, detail="Active product was not found.")
    # Conditional SQL update prevents concurrent requests from reserving the same final units.
    changed = db.execute(update(Product).where(
        Product.id == payload.product_id, Product.is_active.is_(True), Product.stock_quantity >= payload.quantity
    ).values(stock_quantity=Product.stock_quantity - payload.quantity))
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Insufficient stock for this shipment.")
    shipment = Shipment(reference=payload.reference, product_id=product.id, quantity=payload.quantity,
                        unit_price_snapshot=product.unit_price, status="planned")
    db.add(shipment)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Shipment reference already exists; no stock change was committed.") from exc
    db.refresh(shipment)
    return shipment

@router.get("/shipments", response_model=list[ShipmentRead], summary="List shipments")
def list_shipments(status: str | None = Query(default=None, pattern="^(planned|in_transit|delivered|cancelled)$"),
                   limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0),
                   db: Session = Depends(get_db)) -> list[Shipment]:
    statement = select(Shipment)
    if status:
        statement = statement.where(Shipment.status == status)
    return list(db.scalars(statement.order_by(Shipment.id.desc()).offset(offset).limit(limit)).all())

@router.patch("/shipments/{shipment_id}/status", response_model=ShipmentRead, summary="Transition shipment state")
def update_shipment_status(shipment_id: int, payload: ShipmentStatusUpdate,
                            db: Session = Depends(get_db)) -> Shipment:
    shipment = db.get(Shipment, shipment_id)
    if shipment is None:
        raise HTTPException(status_code=404, detail="Shipment was not found.")
    current, requested = shipment.status, payload.status
    if requested == current:
        return shipment
    allowed = {"planned": {"in_transit", "cancelled"}, "in_transit": {"delivered", "cancelled"},
               "delivered": set(), "cancelled": set()}
    if requested not in allowed.get(current, set()):
        raise HTTPException(status_code=409, detail=f"Invalid shipment transition: {current} -> {requested}.")
    values = {"status": requested}
    if requested == "delivered":
        values["delivered_at"] = datetime.now(timezone.utc)
    changed = db.execute(update(Shipment).where(Shipment.id == shipment_id, Shipment.status == current).values(**values))
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Shipment state changed concurrently; reload and retry.")
    if requested == "cancelled":
        db.execute(update(Product).where(Product.id == shipment.product_id)
                   .values(stock_quantity=Product.stock_quantity + shipment.quantity))
    db.commit()
    refreshed = db.get(Shipment, shipment_id)
    assert refreshed is not None
    return refreshed

@router.get("/analytics/operations", response_model=OperationsSummary, summary="Summarize distribution operations")
def operations_summary(db: Session = Depends(get_db)) -> OperationsSummary:
    active = db.scalar(select(func.count()).select_from(Product).where(Product.is_active.is_(True))) or 0
    low_stock = db.scalar(select(func.count()).select_from(Product).where(
        Product.is_active.is_(True), Product.stock_quantity <= Product.reorder_threshold)) or 0
    total_shipments = db.scalar(select(func.count()).select_from(Shipment)) or 0
    in_transit = db.scalar(select(func.count()).select_from(Shipment).where(Shipment.status == "in_transit")) or 0
    delivered = db.scalar(select(func.count()).select_from(Shipment).where(Shipment.status == "delivered")) or 0
    delivered_value = db.scalar(select(func.coalesce(func.sum(Shipment.quantity * Shipment.unit_price_snapshot), 0))
                                 .where(Shipment.status == "delivered")) or Decimal("0")
    return OperationsSummary(active_products=int(active), low_stock_products=int(low_stock), total_shipments=int(total_shipments),
                             in_transit_shipments=int(in_transit), delivered_shipments=int(delivered),
                             delivered_value=Decimal(delivered_value))
