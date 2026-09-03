# IMPLEMENTATION PLAN — SPEC_18: API Design Standards
**Module:** 18 | **Phase:** Foundation (Cross-Cutting) | **Squad:** A
**Spec File:** SPEC_18_API_DESIGN.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S18-01 | Base URL: /api/v1/ for all endpoints | app/main.py router registration | PLANNED |
| S18-02 | Response envelope: {data, meta, links} | core/responses.py | PLANNED |
| S18-03 | Error envelope: {error: {code, message, details, trace_id, timestamp}} | core/exceptions.py | PLANNED |
| S18-04 | Pagination: cursor-based + page-based (both supported) | core/pagination.py | PLANNED |
| S18-05 | Sorting: sort_by, sort_dir query params | core/pagination.py | PLANNED |
| S18-06 | Filtering: field=value, range filters, IN filters | core/filters.py | PLANNED |
| S18-07 | Idempotency: X-Idempotency-Key header on POST/PUT | core/idempotency.py (already) | PLANNED |
| S18-08 | Versioning: v1 in URL; header X-API-Version for future | app/main.py | PLANNED |
| S18-09 | Rate limiting: 5 tiers via Kong | kong/kong.yml (already) | PLANNED |
| S18-10 | Content negotiation: application/json only | FastAPI default | PLANNED |
| S18-11 | HTTP status codes (15 scenarios mapped) | core/exceptions.py | PLANNED |
| S18-12 | OpenAPI spec auto-generated (/openapi.json) | FastAPI auto | PLANNED |
| S18-13 | OpenAPI tags (one per module) | Each router: tags=["module_name"] | PLANNED |
| S18-14 | Bulk operations: POST /bulk-create, POST /bulk-update, DELETE /bulk-delete | Per-module where applicable | PLANNED |
| S18-15 | Streaming responses for CSV/PDF exports | core/streaming.py | PLANNED |
| S18-16 | Request ID tracking (X-Request-ID) | middleware (already) | PLANNED |
| S18-17 | HATEOAS links in response envelope | core/responses.py | PLANNED |
| S18-18 | Field selection: ?fields=id,name,status | core/responses.py | PLANNED |
| S18-19 | Deprecation header for sunset endpoints | core/deprecation.py | PLANNED |
| S18-20 | Webhook delivery for external consumers | integration/webhook.py | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-18-1 | Cursor-based pagination uses `cursor={base64(last_id)}` format; page-based uses `page=N&page_size=M` (max 100); default page_size=25 | SPEC Section 4; exact format not specified | LOW | Squad A |
| A-18-2 | Field selection (?fields=) implemented as response post-processing filter, not SQL projection; simpler to maintain at scale | SPEC Section 18; DB projection adds complexity | LOW | Squad A |
| A-18-3 | HATEOAS links included only where navigable relationships exist (e.g. PR→RFQ, RFQ→bids); not forced on every response | SPEC Section 17; full HATEOAS is verbose | LOW | Squad A |
| A-18-4 | Bulk operations max 50 items per request; enforced by Pydantic validator on request schema | SPEC Section 14 bulk; no limit stated | LOW | Squad A |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/core/responses.py`
```python
from typing import TypeVar, Generic, Optional, Any
from pydantic import BaseModel

T = TypeVar("T")

class PaginationMeta(BaseModel):
    total: Optional[int] = None
    page: Optional[int] = None
    page_size: Optional[int] = None
    has_next: bool = False
    has_prev: bool = False
    next_cursor: Optional[str] = None
    prev_cursor: Optional[str] = None

class Links(BaseModel):
    self: Optional[str] = None
    next: Optional[str] = None
    prev: Optional[str] = None
    related: Optional[dict[str, str]] = None

class APIResponse(BaseModel, Generic[T]):
    data: T
    meta: Optional[PaginationMeta] = None
    links: Optional[Links] = None

def success_response(data: Any, meta: Optional[PaginationMeta] = None,
                     links: Optional[Links] = None, status_code: int = 200):
    from fastapi.responses import JSONResponse
    content = APIResponse(data=data, meta=meta, links=links).model_dump(exclude_none=True)
    return JSONResponse(content=content, status_code=status_code)

def created_response(data: Any, links: Optional[Links] = None):
    return success_response(data, links=links, status_code=201)
```

### 2.2 `app/core/pagination.py`
```python
import base64
from uuid import UUID
from fastapi import Query
from pydantic import BaseModel
from typing import Optional

class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 25
    sort_by: Optional[str] = None
    sort_dir: str = "asc"
    cursor: Optional[str] = None

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return min(self.page_size, 100)

def encode_cursor(last_id: UUID) -> str:
    return base64.urlsafe_b64encode(str(last_id).encode()).decode()

def decode_cursor(cursor: str) -> UUID:
    return UUID(base64.urlsafe_b64decode(cursor.encode()).decode())

def paginate_query(query, params: PaginationParams, model, allowed_sort_fields: list[str]):
    if params.sort_by and params.sort_by in allowed_sort_fields:
        col = getattr(model, params.sort_by)
        query = query.order_by(col.desc() if params.sort_dir == "desc" else col.asc())
    if params.cursor:
        last_id = decode_cursor(params.cursor)
        query = query.where(model.id > last_id)
    return query.limit(params.limit + 1)  # +1 to detect has_next
```

### 2.3 `app/core/filters.py`
```python
from typing import Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy import and_, or_, between

class FilterBuilder:
    """Builds SQLAlchemy filter conditions from query parameters."""

    def apply(self, query, model, filters: dict):
        conditions = []
        for field, value in filters.items():
            if not hasattr(model, field):
                continue
            col = getattr(model, field)
            if isinstance(value, list):
                conditions.append(col.in_(value))
            elif isinstance(value, dict):
                if "gte" in value: conditions.append(col >= value["gte"])
                if "lte" in value: conditions.append(col <= value["lte"])
                if "gt" in value:  conditions.append(col > value["gt"])
                if "lt" in value:  conditions.append(col < value["lt"])
            elif value is None:
                conditions.append(col.is_(None))
            else:
                conditions.append(col == value)
        return query.where(and_(*conditions)) if conditions else query
```

### 2.4 `app/core/streaming.py`
```python
from fastapi.responses import StreamingResponse
import csv, io

def stream_csv(headers: list[str], rows: list[dict], filename: str) -> StreamingResponse:
    def generate():
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        yield output.getvalue()
        output.seek(0); output.truncate()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in headers})
            yield output.getvalue()
            output.seek(0); output.truncate()
    return StreamingResponse(generate(), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})

def stream_pdf(pdf_bytes: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})
```

### 2.5 `app/core/deprecation.py`
```python
from fastapi import Response
from datetime import date

def add_deprecation_headers(response: Response, sunset_date: date, successor_url: str = ""):
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = sunset_date.strftime("%a, %d %b %Y 00:00:00 GMT")
    if successor_url:
        response.headers["Link"] = f'<{successor_url}>; rel="successor-version"'
```

### 2.6 All Routers — Standard Patterns
Every module router MUST follow:
```python
router = APIRouter(prefix="/api/v1/{module}", tags=["{module_name}"])

@router.get("", response_model=APIResponse[list[EntityResponse]])
async def list_entities(
    params: PaginationParams = Depends(),
    status: Optional[str] = None,
    current_user: User = Depends(require_permission(PermissionCode.ENTITY_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
):
    items, total = await service.list(db, params, current_user.org_id, {"status": status})
    meta = PaginationMeta(total=total, page=params.page, page_size=params.limit)
    return success_response([item.to_response() for item in items], meta=meta)
```

---
## STEP 3 — TEST
```python
def test_pagination_cursor_encode_decode():
    uid = uuid4()
    assert decode_cursor(encode_cursor(uid)) == uid

async def test_list_endpoint_returns_envelope(client, factory):
    resp = await client.get("/api/v1/requisitions")
    assert "data" in resp.json()
    assert "meta" in resp.json()

async def test_error_response_has_trace_id(client):
    resp = await client.get("/api/v1/requisitions/nonexistent-id")
    assert "trace_id" in resp.json()["error"]

async def test_page_size_capped_at_100(client, factory):
    resp = await client.get("/api/v1/vendors?page_size=500")
    assert len(resp.json()["data"]) <= 100

async def test_idempotency_key_deduplicates(client, factory):
    key = str(uuid4())
    r1 = await client.post("/api/v1/requisitions", json=data, headers={"X-Idempotency-Key": key})
    r2 = await client.post("/api/v1/requisitions", json=data, headers={"X-Idempotency-Key": key})
    assert r1.json()["data"]["id"] == r2.json()["data"]["id"]
```
