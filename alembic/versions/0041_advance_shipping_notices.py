"""Create advance_shipping_notices and asn_lines tables for ASN and Warehouse Intake

Revision ID: 0041_advance_shipping_notices
Revises: 0040_vendor_risk_assessment
Create Date: 2026-09-09 23:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "0041_advance_shipping_notices"
down_revision: Union[str, None] = "0040_vendor_risk_assessment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS advance_shipping_notices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id),
            asn_number VARCHAR(30) NOT NULL,
            po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            shipment_date DATE NOT NULL,
            expected_delivery_date DATE NOT NULL,
            carrier_name VARCHAR(100) NOT NULL,
            tracking_number VARCHAR(100) NOT NULL,
            vehicle_number VARCHAR(50),
            driver_name VARCHAR(100),
            driver_phone VARCHAR(30),
            packaging_type VARCHAR(30) NOT NULL DEFAULT 'BOX',
            package_count INTEGER NOT NULL DEFAULT 1,
            gross_weight_kg NUMERIC(10,2),
            status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            barcode_data VARCHAR(255) NOT NULL,
            notes TEXT,
            shipped_at TIMESTAMP WITH TIME ZONE,
            received_at TIMESTAMP WITH TIME ZONE,
            grn_id UUID REFERENCES goods_receipt_notes(id),
            created_by UUID REFERENCES users(id),
            updated_by UUID REFERENCES users(id),
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT uq_asn_org_number UNIQUE (org_id, asn_number)
        )
        """)
    )
    conn.execute(
        text("""
        CREATE INDEX IF NOT EXISTS idx_asn_org_status
            ON advance_shipping_notices (org_id, status)
        """)
    )
    conn.execute(
        text("""
        CREATE INDEX IF NOT EXISTS idx_asn_po_id
            ON advance_shipping_notices (po_id)
        """)
    )
    conn.execute(
        text("""
        CREATE INDEX IF NOT EXISTS idx_asn_vendor_id
            ON advance_shipping_notices (vendor_id)
        """)
    )
    conn.execute(
        text("""
        CREATE INDEX IF NOT EXISTS idx_asn_barcode
            ON advance_shipping_notices (org_id, barcode_data)
        """)
    )
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS asn_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id),
            asn_id UUID NOT NULL REFERENCES advance_shipping_notices(id) ON DELETE CASCADE,
            po_line_id UUID NOT NULL REFERENCES po_lines(id) ON DELETE CASCADE,
            item_code VARCHAR(50),
            item_description VARCHAR(500) NOT NULL,
            uom VARCHAR(20) NOT NULL DEFAULT 'UNIT',
            ordered_quantity NUMERIC(18,4) NOT NULL,
            shipped_quantity NUMERIC(18,4) NOT NULL,
            received_quantity NUMERIC(18,4) NOT NULL DEFAULT 0.0,
            lot_number VARCHAR(100),
            serial_numbers JSONB NOT NULL DEFAULT '[]',
            expiry_date DATE,
            manufacturing_date DATE,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE
        )
        """)
    )
    conn.execute(
        text("""
        CREATE INDEX IF NOT EXISTS idx_asn_lines_asn_id
            ON asn_lines (asn_id)
        """)
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DROP TABLE IF EXISTS asn_lines CASCADE"))
    conn.execute(text("DROP TABLE IF EXISTS advance_shipping_notices CASCADE"))
