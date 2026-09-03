import pytest
from app.core.responses import APIResponse, PaginationMeta, success_response, created_response

def test_pagination_meta():
    meta = PaginationMeta(
        total_count=100,
        total_pages=5,
        page=1,
        page_size=20,
        has_next=True,
        has_prev=False
    )
    assert meta.total_count == 100
    assert meta.total_pages == 5
    assert meta.page == 1
    assert meta.page_size == 20
    assert meta.has_next is True
    assert meta.has_prev is False

def test_api_response_wrapper():
    resp = APIResponse(data={"key": "value"})
    assert resp.data == {"key": "value"}
    assert resp.meta is None
    assert resp.links is None
    assert resp.timestamp is not None

def test_success_response():
    resp = success_response(data={"id": 1})
    assert resp["data"] == {"id": 1}
    assert "timestamp" in resp

def test_created_response():
    resp = created_response(data={"id": 1})
    assert resp["data"] == {"id": 1}
    assert "timestamp" in resp
