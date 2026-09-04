"""
Purchase Order PDF Generator (SPEC_14 S14-13).

Generates professional Purchase Order documents using ReportLab and uploads to MinIO.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID

from loguru import logger
from minio import Minio
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import settings


class POPDFGenerator:
    """Generates PO PDF files and stores them in MinIO."""

    def __init__(self) -> None:
        self._minio_client: Optional[Minio] = None

    def _get_minio(self) -> Minio:
        if self._minio_client is None:
            self._minio_client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_USE_SSL,
            )
        return self._minio_client

    def build_pdf_bytes(
        self,
        po: Any,
        vendor: Any = None,
        lines: Optional[List[Any]] = None,
        org_name: str = "Enterprise S2P Procurement Portal",
    ) -> bytes:
        """Build the Purchase Order PDF in memory using ReportLab."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "POTitle",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0f172a"),
        )
        header_meta = ParagraphStyle(
            "POMeta",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#475569"),
        )
        section_style = ParagraphStyle(
            "POSection",
            parent=styles["Heading2"],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#1e293b"),
        )
        cell_style = ParagraphStyle(
            "POCell",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#1e293b"),
        )
        cell_bold = ParagraphStyle(
            "POCellBold",
            parent=cell_style,
            fontName="Helvetica-Bold",
        )

        elements = []

        # Top Header Banner
        header_data = [
            [
                Paragraph(f"<b>{org_name}</b><br/>Purchase Order Official Document", title_style),
                Paragraph(
                    f"<b>PO Number:</b> {po.po_number}<br/>"
                    f"<b>Date:</b> {po.created_at.strftime('%Y-%m-%d') if hasattr(po, 'created_at') and po.created_at else datetime.now(timezone.utc).strftime('%Y-%m-%d')}<br/>"
                    f"<b>Status:</b> {po.status}",
                    header_meta,
                ),
            ]
        ]
        t_head = Table(header_data, colWidths=[320, 200])
        t_head.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
        elements.append(t_head)
        elements.append(Spacer(1, 15))

        # Parties Info: Buyer & Vendor
        vendor_name = getattr(vendor, "legal_name", None) or getattr(vendor, "name", "Registered Vendor")
        vendor_code = getattr(vendor, "vendor_code", "N/A")

        parties_data = [
            [
                Paragraph("<b>BUYER ENTITY</b>", section_style),
                Paragraph("<b>SUPPLIER / VENDOR</b>", section_style),
            ],
            [
                Paragraph(
                    f"<b>Title:</b> {po.title}<br/>"
                    f"<b>Currency:</b> {po.currency}<br/>"
                    f"<b>Total Value:</b> {po.currency} {float(po.total_value or 0):,.2f}<br/>"
                    f"<b>Expected Delivery:</b> {po.expected_delivery_date or 'Per Line Schedule'}",
                    cell_style,
                ),
                Paragraph(
                    f"<b>Vendor:</b> {vendor_name}<br/>"
                    f"<b>Vendor Code:</b> {vendor_code}<br/>"
                    f"<b>Vendor ID:</b> {str(po.vendor_id)[:16]}...",
                    cell_style,
                ),
            ],
        ]
        t_parties = Table(parties_data, colWidths=[260, 260])
        t_parties.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        elements.append(t_parties)
        elements.append(Spacer(1, 15))

        # Line Items Table
        elements.append(Paragraph("Schedule of Items & Delivery Requirements", section_style))
        elements.append(Spacer(1, 6))

        lines_list = lines if lines is not None else getattr(po, "lines", [])
        line_rows = [
            [
                Paragraph("#", cell_bold),
                Paragraph("Description", cell_bold),
                Paragraph("Code", cell_bold),
                Paragraph("Qty", cell_bold),
                Paragraph("Unit Price", cell_bold),
                Paragraph("Tax %", cell_bold),
                Paragraph("Total", cell_bold),
                Paragraph("Delivery Date", cell_bold),
            ]
        ]

        total_lines_val = Decimal("0")
        for idx, line in enumerate(lines_list, 1):
            qty = Decimal(str(line.ordered_quantity or 0))
            price = Decimal(str(line.unit_price or 0))
            tax_rate = Decimal(str(line.tax_rate or 0))
            line_total = qty * price
            total_lines_val += line_total

            line_rows.append(
                [
                    Paragraph(str(idx), cell_style),
                    Paragraph(line.item_description, cell_style),
                    Paragraph(line.item_code or "-", cell_style),
                    Paragraph(f"{float(qty):,.2f}", cell_style),
                    Paragraph(f"{float(price):,.2f}", cell_style),
                    Paragraph(f"{float(tax_rate):.1f}%", cell_style),
                    Paragraph(f"{float(line_total):,.2f}", cell_style),
                    Paragraph(str(line.delivery_date or "Standard"), cell_style),
                ]
            )

        # Summary Row
        line_rows.append(
            [
                Paragraph("<b>Total</b>", cell_bold),
                Paragraph("", cell_style),
                Paragraph("", cell_style),
                Paragraph("", cell_style),
                Paragraph("", cell_style),
                Paragraph("", cell_style),
                Paragraph(f"<b>{po.currency} {float(total_lines_val):,.2f}</b>", cell_bold),
                Paragraph("", cell_style),
            ]
        )

        t_lines = Table(line_rows, colWidths=[25, 150, 55, 50, 60, 40, 70, 70])
        t_lines.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
                    ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
                ]
            )
        )
        elements.append(t_lines)
        elements.append(Spacer(1, 20))

        # Standard Terms & Acceptance Note
        terms = (
            "<b>General Terms & Conditions:</b><br/>"
            "1. Goods/Services must be delivered in strict accordance with specifications and scheduled delivery dates.<br/>"
            "2. Goods Receipt Note (GRN) and Quality Inspection clearance are mandatory prior to invoice acceptance.<br/>"
            "3. Supplier must acknowledge or reject this Purchase Order within the designated SLA timeframe.<br/>"
            "4. Three-way match verification (PO - GRN - Invoice) will govern payment release per agreed credit terms."
        )
        elements.append(Paragraph(terms, cell_style))
        elements.append(Spacer(1, 25))

        # Signatures
        sig_data = [
            [
                Paragraph("<b>Prepared / Issued By:</b><br/><br/>_______________________<br/>Authorized Procurement Officer", cell_style),
                Paragraph("<b>Supplier Acknowledged By:</b><br/><br/>_______________________<br/>Authorized Supplier Signatory", cell_style),
            ]
        ]
        t_sig = Table(sig_data, colWidths=[260, 260])
        t_sig.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        elements.append(t_sig)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    async def generate(
        self,
        po: Any,
        org_id: UUID,
        vendor: Any = None,
        lines: Optional[List[Any]] = None,
    ) -> str:
        """
        Generate PO PDF bytes, upload to MinIO 'purchase-order-documents' bucket,
        and return the MinIO storage path.
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        filename = f"po_{po.id}_{timestamp}.pdf"
        minio_path = f"{org_id}/po/{po.id}/{filename}"
        bucket_name = getattr(settings, "MINIO_BUCKET_PURCHASE_ORDER", "purchase-order-documents")

        pdf_bytes = self.build_pdf_bytes(po, vendor=vendor, lines=lines)

        try:
            client = self._get_minio()
            if not client.bucket_exists(bucket_name):
                client.make_bucket(bucket_name)
            client.put_object(
                bucket_name,
                minio_path,
                io.BytesIO(pdf_bytes),
                length=len(pdf_bytes),
                content_type="application/pdf",
            )
            logger.info("Uploaded PO PDF to MinIO: bucket={}, path={}", bucket_name, minio_path)
        except Exception as e:
            logger.warning("MinIO upload for PO PDF failed or skipped: {}", e)

        return minio_path


po_pdf_generator = POPDFGenerator()
