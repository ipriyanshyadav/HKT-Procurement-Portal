"""0047_einvoice_and_ewaybill

Revision ID: 0047_einvoice_and_ewaybill
Revises: 0046_ai_sourcing_copilot
Create Date: 2026-09-10 01:10:00.000000

Government E-Invoicing & E-Way Bill Integration:
- e_invoices: Official NIC India IRN, signed QR code, Peppol UBL XML
- e_way_bills: Part A and Part B E-Way Bills with distance tracking
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0047_einvoice_and_ewaybill"
down_revision: str | None = "0046_ai_sourcing_copilot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "e_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "invoice_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("invoices.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "asn_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("advance_shipping_notices.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("seller_gstin", sa.String(length=15), nullable=False),
        sa.Column("buyer_gstin", sa.String(length=15), nullable=False),
        sa.Column("doc_number", sa.String(length=50), nullable=False),
        sa.Column("doc_type", sa.String(length=10), nullable=False, server_default="INV"),
        sa.Column("financial_year", sa.String(length=10), nullable=False),
        sa.Column("irn", sa.String(length=64), nullable=False, unique=True, index=True),
        sa.Column("ack_number", sa.String(length=30), nullable=False),
        sa.Column("ack_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_invoice_value", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("total_tax_value", sa.Numeric(precision=18, scale=2), nullable=False, server_default="0.00"),
        sa.Column("signed_invoice", sa.Text(), nullable=False),
        sa.Column("signed_qr_code", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="GENERATED"),
        sa.Column("cancellation_reason", sa.String(length=255), nullable=True),
        sa.Column("peppol_xml", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "e_way_bills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "e_invoice_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("e_invoices.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "asn_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("advance_shipping_notices.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("ewb_number", sa.String(length=20), nullable=False, unique=True, index=True),
        sa.Column("ewb_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("transporter_id", sa.String(length=20), nullable=True),
        sa.Column("transporter_name", sa.String(length=255), nullable=True),
        sa.Column("vehicle_number", sa.String(length=20), nullable=False),
        sa.Column("distance_km", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("from_pincode", sa.String(length=10), nullable=False),
        sa.Column("to_pincode", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("e_way_bills")
    op.drop_table("e_invoices")
