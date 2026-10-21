from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._/-]+$")
    name: str = Field(min_length=1, max_length=200)
    unit_price: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    stock_quantity: int = Field(ge=0, le=2_000_000_000)
    reorder_threshold: int = Field(default=0, ge=0, le=2_000_000_000)

class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    name: str
    unit_price: Decimal
    stock_quantity: int
    reorder_threshold: int
    is_active: bool
    created_at: datetime

class ShipmentCreate(BaseModel):
    reference: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9._/-]+$")
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=2_000_000_000)

class ShipmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    reference: str
    product_id: int
    quantity: int
    unit_price_snapshot: Decimal
    status: Literal["planned", "in_transit", "delivered", "cancelled"]
    created_at: datetime
    delivered_at: datetime | None

class ShipmentStatusUpdate(BaseModel):
    status: Literal["planned", "in_transit", "delivered", "cancelled"]

class OperationsSummary(BaseModel):
    active_products: int
    low_stock_products: int
    total_shipments: int
    in_transit_shipments: int
    delivered_shipments: int
    delivered_value: Decimal
