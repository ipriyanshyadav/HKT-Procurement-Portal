from __future__ import annotations
import base64
import json
from pydantic import BaseModel
from typing import Tuple, Any, Optional
from app.core.responses import PaginationMeta, Links

class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20
    sort_by: str = "created_at"
    sort_dir: str = "desc"

def encode_cursor(values: dict) -> str:
    return base64.b64encode(json.dumps(values).encode()).decode()

def decode_cursor(cursor: Optional[str]) -> dict:
    if not cursor:
        return {}
    try:
        return json.loads(base64.b64decode(cursor.encode()).decode())
    except Exception:
        return {}

def paginate_query(query: Any, params: PaginationParams, total_count: int) -> Tuple[Any, PaginationMeta, Links]:
    total_pages = (total_count + params.page_size - 1) // params.page_size
    meta = PaginationMeta(
        page=params.page,
        page_size=params.page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_next=params.page < total_pages,
        has_prev=params.page > 1
    )
    
    links = Links(
        self_=f"?page={params.page}&page_size={params.page_size}",
        next_=f"?page={params.page + 1}&page_size={params.page_size}" if meta.has_next else None,
        prev_=f"?page={params.page - 1}&page_size={params.page_size}" if meta.has_prev else None
    )
    
    offset = (params.page - 1) * params.page_size
    query = query.offset(offset).limit(params.page_size)
    return query, meta, links
