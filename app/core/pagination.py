from __future__ import annotations
import base64
import json
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Tuple, Any, Optional, Union, List
from app.core.responses import PaginationMeta, Links


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: Optional[str] = "created_at"
    sort_dir: str = "desc"
    cursor: Optional[str] = None

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return min(self.page_size, 100)


def encode_cursor(last_id: Any) -> str:
    """Encode last seen ID (UUID, string, or dictionary) into a URL-safe base64 cursor string."""
    if isinstance(last_id, dict):
        return base64.urlsafe_b64encode(json.dumps(last_id).encode()).decode()
    return base64.urlsafe_b64encode(str(last_id).encode()).decode()


def decode_cursor(cursor: Optional[str]) -> Any:
    """Decode a URL-safe base64 cursor string back to UUID, dict, or string."""
    if not cursor:
        return {}
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        try:
            return json.loads(raw)
        except Exception:
            pass
        try:
            return UUID(raw)
        except Exception:
            return raw
    except Exception:
        return {}


def paginate_query(
    query: Any,
    params: PaginationParams,
    model_or_total: Any,
    allowed_sort_fields: Optional[List[str]] = None,
) -> Any:
    """
    Paginate query. Supports both:
    1. (query, params, total_count: int) -> returns (query, PaginationMeta, Links)
    2. (query, params, model, allowed_sort_fields) -> returns query with limit/offset/cursor
    """
    if isinstance(model_or_total, int):
        total_count = model_or_total
        page_size = params.limit
        total_pages = (total_count + page_size - 1) // page_size if page_size else 1
        meta = PaginationMeta(
            page=params.page,
            page_size=page_size,
            total=total_count,
            total_count=total_count,
            total_pages=total_pages,
            has_next=params.page < total_pages,
            has_prev=params.page > 1,
        )

        links = Links(
            self=f"?page={params.page}&page_size={page_size}",
            next=f"?page={params.page + 1}&page_size={page_size}" if meta.has_next else None,
            prev=f"?page={params.page - 1}&page_size={page_size}" if meta.has_prev else None,
        )

        offset = (params.page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        return query, meta, links

    model = model_or_total
    if params.sort_by and allowed_sort_fields and params.sort_by in allowed_sort_fields:
        if hasattr(model, params.sort_by):
            col = getattr(model, params.sort_by)
            query = query.order_by(col.desc() if params.sort_dir == "desc" else col.asc())
    if params.cursor:
        last_id = decode_cursor(params.cursor)
        if last_id and hasattr(model, "id"):
            query = query.where(model.id > last_id)
    return query.limit(params.limit + 1)

