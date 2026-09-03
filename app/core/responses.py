from __future__ import annotations
from datetime import datetime
from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel

T = TypeVar('T')

class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_count: int
    total_pages: int
    has_next: bool
    has_prev: bool

class Links(BaseModel):
    self_: Optional[str] = None
    next_: Optional[str] = None
    prev_: Optional[str] = None

class APIResponse(BaseModel, Generic[T]):
    data: T
    meta: Optional[PaginationMeta] = None
    links: Optional[Links] = None
    timestamp: datetime = datetime.utcnow()

def success_response(data: Any, meta: Optional[PaginationMeta] = None, links: Optional[Links] = None) -> dict:
    return {
        "data": data,
        "meta": meta.model_dump() if meta else None,
        "links": links.model_dump(by_alias=True) if links else None,
        "timestamp": datetime.utcnow().isoformat()
    }

def created_response(data: Any) -> dict:
    return {
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
        # A hint for fastapi status_code=201
    }

def no_content_response() -> dict:
    return {}
