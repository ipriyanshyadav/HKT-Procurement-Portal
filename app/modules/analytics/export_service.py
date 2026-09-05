from __future__ import annotations
import csv
import io
from typing import Any, List, Dict, Optional
from fastapi import Response
from fastapi.responses import StreamingResponse
import openpyxl


class AnalyticsExportService:
    async def export_csv(
        self,
        data: List[Dict[str, Any]],
        columns: Optional[List[str]] = None,
        filename: str = "analytics_export.csv",
    ) -> StreamingResponse:
        if not columns and data:
            columns = list(data[0].keys())
        elif not columns:
            columns = []

        def csv_generator():
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(columns)
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            for row in data:
                writer.writerow([row.get(col, "") for col in columns])
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        return StreamingResponse(
            csv_generator(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
        )

    async def export_excel(
        self,
        data: List[Dict[str, Any]],
        sheet_name: str = "Analytics",
        filename: str = "analytics_export.xlsx",
        max_rows: int = 100_000,
    ) -> Response:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = sheet_name[:31]

        truncated_data = data[:max_rows]
        if truncated_data:
            headers = list(truncated_data[0].keys())
            ws.append(headers)
            for row in truncated_data:
                ws.append([
                    str(v) if not isinstance(v, (int, float, type(None), bool)) else v
                    for v in row.values()
                ])
        else:
            ws.append(["No Data"])

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
        )


analytics_export_service = AnalyticsExportService()
