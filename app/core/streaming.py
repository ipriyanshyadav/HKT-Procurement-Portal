from __future__ import annotations
import csv
import io
from typing import Any, Dict, List, Union
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def stream_csv(headers: List[str], rows: List[Dict[str, Any]], filename: str) -> StreamingResponse:
    """Stream tabular rows as a downloadable CSV file."""
    def generate():
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        for row in rows:
            # Flatten or stringify complex types (UUID, datetime, dict, etc.)
            clean_row = {}
            for h in headers:
                val = row.get(h, "")
                if val is None:
                    clean_row[h] = ""
                elif hasattr(val, "isoformat"):
                    clean_row[h] = val.isoformat()
                else:
                    clean_row[h] = str(val)
            writer.writerow(clean_row)
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    if not filename.endswith(".csv"):
        filename = f"{filename}.csv"

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def stream_pdf(pdf_bytes: bytes, filename: str) -> StreamingResponse:
    """Stream in-memory PDF bytes as a downloadable PDF file."""
    if not filename.endswith(".pdf"):
        filename = f"{filename}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def generate_table_pdf(
    title: str,
    headers: List[str],
    rows: List[Union[Dict[str, Any], List[Any]]],
    orientation: str = "portrait",
) -> bytes:
    """Generate professional PDF bytes from tabular data using ReportLab."""
    buffer = io.BytesIO()
    pagesize = landscape(A4) if orientation == "landscape" else A4
    doc = SimpleDocTemplate(
        buffer,
        pagesize=pagesize,
        rightMargin=28,
        leftMargin=28,
        topMargin=28,
        bottomMargin=28,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#0f172a"),
    )
    cell_style = ParagraphStyle(
        "ReportCell",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#334155"),
    )
    header_style = ParagraphStyle(
        "ReportHeaderCell",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
        fontName="Helvetica-Bold",
        textColor=colors.white,
    )

    story = []
    story.append(Paragraph(title, title_style))
    story.append(Spacer(1, 14))

    # Format table data
    table_data = []
    # Header row
    table_data.append([Paragraph(str(h).replace("_", " ").title(), header_style) for h in headers])

    for row in rows:
        formatted_row = []
        for h in headers:
            if isinstance(row, dict):
                val = row.get(h, "")
            else:
                idx = headers.index(h)
                val = row[idx] if idx < len(row) else ""
            if val is None:
                val_str = ""
            elif hasattr(val, "isoformat"):
                val_str = val.isoformat()
            else:
                val_str = str(val)
            formatted_row.append(Paragraph(val_str, cell_style))
        table_data.append(formatted_row)

    report_table = Table(table_data, repeatRows=1)
    report_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ]
        )
    )
    story.append(report_table)
    doc.build(story)
    return buffer.getvalue()
