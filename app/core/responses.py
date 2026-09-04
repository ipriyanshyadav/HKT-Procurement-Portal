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
