from __future__ import annotations
from datetime import datetime, timezone
from typing import Generic, TypeVar, Optional, Any, Dict, List
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationMeta(BaseModel):
    total: Optional[int] = None
    page: Optional[int] = 1
    page_size: Optional[int] = 20
    total_count: int = 0
    total_pages: int = 1
    has_next: bool = False
    has_prev: bool = False
    next_cursor: Optional[str] = None
    prev_cursor: Optional[str] = None

    # Tolerant aliases / compatibility fields
    page_number: Optional[int] = None
    total_records: Optional[int] = None
    has_next_page: Optional[bool] = None
    has_prev_page: Optional[bool] = None
    unread_count: Optional[int] = None

    def model_post_init(self, __context: Any) -> None:
        if self.page_number is not None and self.page == 1:
            self.page = self.page_number
        if self.total_records is not None and self.total_count == 0:
            self.total_count = self.total_records
        if self.total is not None and self.total_count == 0:
            self.total_count = self.total
        if self.total_count is not None and self.total is None:
            self.total = self.total_count

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
    self: Optional[str] = None
    next: Optional[str] = None
    prev: Optional[str] = None
    related: Optional[Dict[str, str]] = None

    # Tolerant aliases
    self_: Optional[str] = None
    next_: Optional[str] = None
    prev_: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if self.self_ and not self.self:
            self.self = self.self_
        if self.next_ and not self.next:
            self.next = self.next_
        if self.prev_ and not self.prev:
            self.prev = self.prev_
        if self.self and not self.self_:
            self.self_ = self.self
        if self.next and not self.next_:
            self.next_ = self.next
        if self.prev and not self.prev_:
            self.prev_ = self.prev


class APIResponse(BaseModel, Generic[T]):
    data: T
    meta: Optional[PaginationMeta] = None
    links: Optional[Links] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _filter_fields(data: Any, field_set: set[str]) -> Any:
    """Filter fields in a dictionary or list of dictionaries based on field_set."""
    if isinstance(data, dict):
        return {k: v for k, v in data.items() if k in field_set}
    elif isinstance(data, list):
        return [_filter_fields(item, field_set) for item in data]
    elif hasattr(data, "model_dump"):
        dumped = data.model_dump()
        return {k: v for k, v in dumped.items() if k in field_set}
    return data


def success_response(
    data: Any,
    meta: Optional[PaginationMeta | dict] = None,
    links: Optional[Links | dict] = None,
    status_code: int = 200,
    fields: Optional[str] = None,
) -> dict:
    if fields:
        field_set = {f.strip() for f in fields.split(",") if f.strip()}
        if field_set:
            data = _filter_fields(data, field_set)

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
                "next_cursor": meta.get("next_cursor"),
                "prev_cursor": meta.get("prev_cursor"),
            }
            for k, v in meta.items():
                if k not in serialized_meta:
                    serialized_meta[k] = v
        elif hasattr(meta, "model_dump"):
            dumped = meta.model_dump()
            if "total" not in dumped or dumped["total"] is None:
                dumped["total"] = dumped.get("total_count", 0)
            serialized_meta = dumped
        else:
            serialized_meta = meta

    serialized_links = None
    if links is not None:
        if hasattr(links, "model_dump"):
            serialized_links = links.model_dump(exclude_none=True)
        elif isinstance(links, dict):
            serialized_links = links

    return {
        "data": data,
        "meta": serialized_meta,
        "links": serialized_links,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def created_response(
    data: Any,
    links: Optional[Links | dict] = None,
    meta: Optional[PaginationMeta | dict] = None,
) -> dict:
    return success_response(data=data, meta=meta, links=links, status_code=201)


def no_content_response() -> dict:
    return {}
