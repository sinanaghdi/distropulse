"""Create product, inventory, and shipment tables."""
from alembic import op
import sqlalchemy as sa

revision = "20261021_0001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sku", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reorder_threshold", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("stock_quantity >= 0", name="ck_products_stock_nonnegative"),
        sa.CheckConstraint("reorder_threshold >= 0", name="ck_products_reorder_nonnegative"),
        sa.CheckConstraint("unit_price >= 0", name="ck_products_price_nonnegative"),
    )
    op.create_index("ix_products_sku", "products", ["sku"], unique=True)
    op.create_index("ix_products_name", "products", ["name"], unique=False)
    op.create_table(
        "shipments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reference", sa.String(length=80), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price_snapshot", sa.Numeric(14, 2), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="planned"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("quantity > 0", name="ck_shipments_quantity_positive"),
        sa.CheckConstraint("unit_price_snapshot >= 0", name="ck_shipments_price_nonnegative"),
        sa.CheckConstraint("status IN ('planned', 'in_transit', 'delivered', 'cancelled')", name="ck_shipments_status_valid"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_shipments_reference", "shipments", ["reference"], unique=True)
    op.create_index("ix_shipments_product_id", "shipments", ["product_id"], unique=False)
    op.create_index("ix_shipments_status_created_at", "shipments", ["status", "created_at"], unique=False)

def downgrade() -> None:
    op.drop_index("ix_shipments_status_created_at", table_name="shipments")
    op.drop_index("ix_shipments_product_id", table_name="shipments")
    op.drop_index("ix_shipments_reference", table_name="shipments")
    op.drop_table("shipments")
    op.drop_index("ix_products_name", table_name="products")
    op.drop_index("ix_products_sku", table_name="products")
    op.drop_table("products")
