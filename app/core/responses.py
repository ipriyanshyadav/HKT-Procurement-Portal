from __future__ import annotations
from datetime import datetime
from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel

T = TypeVar('T')

class PaginationMeta(BaseModel):
    page: int = 1
    page_size: int = 20
    total_count: int = 0
    total_pages: int = 1
    has_next: bool = False
    has_prev: bool = False

    # Tolerant aliases / compatibility fields
    page_number: Optional[int] = None
    total_records: Optional[int] = None
    has_next_page: Optional[bool] = None
    has_prev_page: Optional[bool] = None

    def model_post_init(self, __context: Any) -> None:
        if self.page_number is not None and self.page == 1:
            self.page = self.page_number
        if self.total_records is not None and self.total_count == 0:
            self.total_count = self.total_records
        if self.has_next_page is not None:
            self.has_next = self.has_next_page
        if self.has_prev_page is not None:
            self.has_prev = self.has_prev_page
        if self.page_number is None:
            self.page_number = self.page
        if self.total_records is None:
            self.total_records = self.total_count
        if self.has_next_page is None:
            self.has_next_page = self.has_next
        if self.has_prev_page is None:
            self.has_prev_page = self.has_prev

class Links(BaseModel):
    self_: Optional[str] = None
    next_: Optional[str] = None
    prev_: Optional[str] = None

class APIResponse(BaseModel, Generic[T]):
    data: T
    meta: Optional[PaginationMeta] = None
    links: Optional[Links] = None
    timestamp: datetime = datetime.utcnow()

def success_response(data: Any, meta: Optional[PaginationMeta | dict] = None, links: Optional[Links | dict] = None) -> dict:
    serialized_meta = None
    if meta is not None:
        if isinstance(meta, dict):
            total = meta.get("total") if "total" in meta else (meta.get("total_count") or meta.get("total_records") or 0)
            page = meta.get("page") or meta.get("page_number") or 1
            page_size = meta.get("page_size") or 20
            total_pages = meta.get("total_pages") or ((total + page_size - 1) // page_size if page_size else 1)
            serialized_meta = {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_count": total,
                "total_records": total,
                "total_pages": total_pages,
                "page_number": page,
                "has_next": meta.get("has_next", page < total_pages),
                "has_prev": meta.get("has_prev", page > 1),
            }
            for k, v in meta.items():
                if k not in serialized_meta:
                    serialized_meta[k] = v
        elif hasattr(meta, "model_dump"):
            dumped = meta.model_dump()
            if "total" not in dumped:
                dumped["total"] = dumped.get("total_count", 0)
            serialized_meta = dumped
        else:
            serialized_meta = meta

    serialized_links = None
    if links is not None:
        if hasattr(links, "model_dump"):
            serialized_links = links.model_dump(by_alias=True)
        elif isinstance(links, dict):
            serialized_links = links

    return {
        "data": data,
        "meta": serialized_meta,
        "links": serialized_links,
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
