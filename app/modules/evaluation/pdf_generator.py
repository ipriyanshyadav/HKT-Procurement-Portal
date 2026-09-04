from __future__ import annotations
import io
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID
from loguru import logger
from minio import Minio
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from app.config import settings


class CSPDFGenerator:
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
        cs: Any,
        rfq: Any,
        bids: List[Any],
        lots: List[Any],
        vendor_names: Optional[dict[UUID, str]] = None,
        rankings: Optional[List[Any]] = None,
    ) -> bytes:
        """Build the Comparative Statement PDF in memory using ReportLab."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=30,
            leftMargin=30,
            topMargin=30,
            bottomMargin=30,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CSTitle",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#1e293b"),
        )
        subtitle_style = ParagraphStyle(
            "CSSubtitle",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#64748b"),
        )
        section_style = ParagraphStyle(
            "CSSection",
            parent=styles["Heading2"],
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=10,
            spaceAfter=6,
        )
        cell_style = ParagraphStyle(
            "CSCell",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
        )
        header_cell_style = ParagraphStyle(
            "CSHeaderCell",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.white,
            fontName="Helvetica-Bold",
        )

        elements = []

        # Title Banner
        elements.append(Paragraph("COMPARATIVE STATEMENT (CS)", title_style))
        elements.append(
            Paragraph(
                f"CS Number: {cs.cs_number} (v{cs.cs_version}) &bull; Status: {cs.status} &bull; Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
                subtitle_style,
            )
        )
        elements.append(Spacer(1, 10))

        # RFQ Summary Table
        summary_data = [
            [
                Paragraph("<b>RFQ Number</b>", cell_style),
                Paragraph(str(rfq.rfq_number), cell_style),
                Paragraph("<b>Title</b>", cell_style),
                Paragraph(str(rfq.title), cell_style),
            ],
            [
                Paragraph("<b>Methodology</b>", cell_style),
                Paragraph(str(cs.evaluation_methodology), cell_style),
                Paragraph("<b>Estimated Value</b>", cell_style),
                Paragraph(f"INR {rfq.estimated_value:,.2f}", cell_style),
            ],
            [
                Paragraph("<b>Cost of Capital</b>", cell_style),
                Paragraph(f"{float(cs.cost_of_capital_rate)*100:.2f}%", cell_style),
                Paragraph("<b>L1 Total Value</b>", cell_style),
                Paragraph(f"INR {float(cs.l1_total_value or 0):,.2f}", cell_style),
            ],
        ]
        summary_table = Table(summary_data, colWidths=[110, 260, 110, 260])
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("PADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        elements.append(summary_table)
        elements.append(Spacer(1, 15))

        # Comparative Rankings Table
        elements.append(Paragraph("Vendor Bid Rankings & Commercial Evaluation", section_style))

        # Build columns: Rank | Vendor | Lot/Line | Tech Score | Commercial Score | Composite | Raw Total | Landed Total | L1?
        vnames = vendor_names or {}
        table_rows = [
            [
                Paragraph("Rank", header_cell_style),
                Paragraph("Vendor", header_cell_style),
                Paragraph("Lot / Item", header_cell_style),
                Paragraph("Tech Score", header_cell_style),
                Paragraph("Comm Score", header_cell_style),
                Paragraph("Composite", header_cell_style),
                Paragraph("Landed (INR)", header_cell_style),
                Paragraph("Result", header_cell_style),
            ]
        ]

        active_rankings = rankings if rankings is not None else (getattr(cs, "rankings", []) or [])
        sorted_rankings = sorted(active_rankings, key=lambda r: (r.rank, -(float(r.composite_score or 0))))

        for r in sorted_rankings:
            vendor_display = vnames.get(r.vendor_id, f"Vendor {str(r.vendor_id)[:8]}")
            lot_label = f"Lot {str(r.lot_id)[:6]}" if r.lot_id else (f"Line {str(r.rfq_line_id)[:6]}" if r.rfq_line_id else "All")
            tech_str = f"{float(r.technical_score):.1f}" if r.technical_score is not None else "-"
            comm_str = f"{float(r.commercial_score):.1f}" if r.commercial_score is not None else "-"
            comp_str = f"{float(r.composite_score):.1f}" if r.composite_score is not None else "-"
            cost_str = f"INR {float(r.lot_total_inr or r.landed_cost or 0):,.2f}"
            l1_badge = "L1 (WINNER)" if (r.is_l1 or r.rank == 1) else f"L{r.rank}"

            table_rows.append(
                [
                    Paragraph(str(r.rank), cell_style),
                    Paragraph(vendor_display, cell_style),
                    Paragraph(lot_label, cell_style),
                    Paragraph(tech_str, cell_style),
                    Paragraph(comm_str, cell_style),
                    Paragraph(comp_str, cell_style),
                    Paragraph(cost_str, cell_style),
                    Paragraph(f"<b>{l1_badge}</b>", cell_style),
                ]
            )

        col_widths = [45, 175, 100, 75, 75, 75, 120, 75]
        ranks_table = Table(table_rows, colWidths=col_widths)
        table_style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]

        # Highlight L1 rows in soft green
        for row_idx, r in enumerate(sorted_rankings, start=1):
            if r.is_l1 or r.rank == 1:
                table_style.append(
                    ("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#dcfce7"))
                )
            elif row_idx % 2 == 0:
                table_style.append(
                    ("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#f8fafc"))
                )

        ranks_table.setStyle(TableStyle(table_style))
        elements.append(ranks_table)
        elements.append(Spacer(1, 15))

        # Recommendations & Audit Notes
        elements.append(Paragraph("Recommendations & Evaluation Findings", section_style))
        rec_text = cs.recommendations or (
            f"L1 discovered with total value INR {float(cs.l1_total_value or 0):,.2f}. "
            f"Savings of {float(cs.savings_percentage or 0):.2f}% achieved against estimated value."
        )
        elements.append(Paragraph(rec_text, cell_style))

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    async def generate(
        self,
        cs: Any,
        rfq: Any,
        bids: List[Any],
        lots: List[Any],
        org_id: UUID,
        vendor_names: Optional[dict[UUID, str]] = None,
        rankings: Optional[List[Any]] = None,
    ) -> str:
        """
        Generate CS PDF using ReportLab, upload to MinIO 'comparative-statement' bucket,
        and return the MinIO storage path.
        """
        filename = f"cs_{cs.id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.pdf"
        minio_path = f"{org_id}/rfq/{rfq.id}/cs/{filename}"
        bucket_name = getattr(settings, "MINIO_BUCKET_COMPARATIVE_STATEMENT", "comparative-statement")

        pdf_bytes = self.build_pdf_bytes(cs, rfq, bids, lots, vendor_names, rankings=rankings)

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
            logger.info("Uploaded CS PDF to MinIO: bucket={}, path={}", bucket_name, minio_path)
        except Exception as e:
            logger.warning("MinIO upload skipped or failed: {}", e)

        return minio_path


pdf_generator = CSPDFGenerator()
