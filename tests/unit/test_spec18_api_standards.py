from __future__ import annotations

from datetime import date, timezone
from uuid import uuid4
import pytest
from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from sqlalchemy import Column, Integer, String, select
from sqlalchemy.orm import declarative_base

from app.core.deprecation import add_deprecation_headers
from app.core.filters import filter_builder
from app.core.idempotency import IdempotencyMiddleware
from app.core.pagination import (
    PaginationParams,
    decode_cursor,
    encode_cursor,
    paginate_query,
)
from app.core.responses import (
    Links,
    PaginationMeta,
    _filter_fields,
)
from app.core.streaming import generate_table_pdf, stream_csv, stream_pdf

Base = declarative_base()


class SampleModel(Base):
    __tablename__ = "sample_models"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    status = Column(String)
    age = Column(Integer)


def test_pagination_meta_and_compatibility():
    meta = PaginationMeta(
        total=50,
        page=2,
        page_size=10,
        has_next_page=True,
        unread_count=3,
        next_cursor="cursor123",
    )
    assert meta.total == 50
    assert meta.total_count == 50
    assert meta.page == 2
    assert meta.page_number == 2
    assert meta.has_next is True
    assert meta.unread_count == 3
    assert meta.next_cursor == "cursor123"


def test_links_and_aliases():
    links = Links(
        self_="/api/v1/items?page=1",
        next_="/api/v1/items?page=2",
        prev_="/api/v1/items?page=0",
        related={"details": "/api/v1/items/1"},
    )
    assert links.self == "/api/v1/items?page=1"
    assert links.next == "/api/v1/items?page=2"
    assert links.prev == "/api/v1/items?page=0"
    assert links.related["details"] == "/api/v1/items/1"


def test_field_selection_filtering():
    data = {
        "id": "abc-123",
        "name": "Acme",
        "sensitive": "hidden",
        "nested": {"a": 1, "b": 2},
    }
    filtered = _filter_fields(data, "id,name")
    assert filtered == {"id": "abc-123", "name": "Acme"}
    assert "sensitive" not in filtered

    list_data = [
        {"id": 1, "title": "Doc1", "secret": "x"},
        {"id": 2, "title": "Doc2", "secret": "y"},
    ]
    filtered_list = _filter_fields(list_data, "id,title")
    assert filtered_list == [{"id": 1, "title": "Doc1"}, {"id": 2, "title": "Doc2"}]


def test_cursor_encoding_and_decoding():
    uid = uuid4()
    enc_uid = encode_cursor(uid)
    dec_uid = decode_cursor(enc_uid)
    assert dec_uid == uid

    d = {"created_at": "2026-01-01T00:00:00Z", "id": str(uid)}
    enc_d = encode_cursor(d)
    dec_d = decode_cursor(enc_d)
    assert dec_d == d

    s = "arbitrary-cursor-string"
    enc_s = encode_cursor(s)
    dec_s = decode_cursor(enc_s)
    assert dec_s == s

    assert decode_cursor("") == {}
    assert decode_cursor(None) == {}


def test_pagination_params_and_paginate_query():
    params = PaginationParams(page=3, page_size=25, sort_by="name", sort_dir="asc")
    assert params.offset == 50
    assert params.limit == 25

    q = select(SampleModel)
    paginated_q, meta, links = paginate_query(q, params, 100)
    assert meta.total == 100
    assert meta.page == 3
    assert meta.page_size == 25
    assert meta.has_next is True
    assert meta.has_prev is True
    assert links.self == "?page=3&page_size=25"
    assert links.next == "?page=4&page_size=25"
    assert links.prev == "?page=2&page_size=25"


def test_filter_builder_sql_clauses():
    q = select(SampleModel)
    filtered_q = filter_builder.apply(
        q,
        SampleModel,
        {
            "status": "ACTIVE",
            "age": {"gte": 18, "lt": 65},
            "id": [1, 2, 3],
        },
    )
    assert filtered_q is not None


def test_add_deprecation_headers():
    sunset = date(2027, 1, 1)
    res = Response()
    add_deprecation_headers(res, sunset_date=sunset, successor_url="/api/v2/items")
    assert res.headers["Sunset"] == sunset.strftime("%a, %d %b %Y 00:00:00 GMT")
    assert res.headers["Deprecation"] == "true"
    assert 'rel="successor-version"' in res.headers["Link"]
    assert "/api/v2/items" in res.headers["Link"]


def test_streaming_csv_and_pdf_generation():
    headers = ["ID", "Name", "Amount"]
    rows = [
        ["1", "Alice", "100.00"],
        ["2", "Bob", "250.50"],
    ]

    # Test CSV stream
    csv_response = stream_csv(headers, rows, filename="test_export.csv")
    assert csv_response.media_type.startswith("text/csv")
    assert "test_export.csv" in csv_response.headers["Content-Disposition"]

    # Test PDF stream & table generation
    pdf_bytes = generate_table_pdf("Test Report", headers, rows)
    assert len(pdf_bytes) > 0
    assert pdf_bytes.startswith(b"%PDF")

    pdf_response = stream_pdf(pdf_bytes, filename="test_report.pdf")
    assert pdf_response.media_type == "application/pdf"
    assert "test_report.pdf" in pdf_response.headers["Content-Disposition"]


@pytest.mark.asyncio
async def test_idempotency_storage_and_middleware():
    test_app = FastAPI()
    test_app.add_middleware(IdempotencyMiddleware)

    counter = {"calls": 0}

    @test_app.post("/test-resource")
    async def create_resource(request: Request):
        counter["calls"] += 1
        return JSONResponse(
            content={"message": "created", "call_count": counter["calls"]},
            status_code=status.HTTP_201_CREATED,
        )

    client = TestClient(test_app)

    unique_key = f"test-key-{uuid4()}"
    # 1. Request with Idempotency-Key
    headers = {"Idempotency-Key": unique_key}
    r1 = client.post("/test-resource", json={"item": "widget"}, headers=headers)
    assert r1.status_code == 201
    data1 = r1.json()
    assert data1["call_count"] == 1
    assert "X-Cache" not in r1.headers

    # 2. Replay same request with same Idempotency-Key
    r2 = client.post("/test-resource", json={"item": "widget"}, headers=headers)
    assert r2.status_code == 201
    data2 = r2.json()
    assert data2["call_count"] == 1  # handler not called again
    assert r2.headers.get("X-Cache") == "HIT-IDEMPOTENCY"
    assert counter["calls"] == 1

    # 3. Request without Idempotency-Key
    r3 = client.post("/test-resource", json={"item": "widget"})
    assert r3.status_code == 201
    data3 = r3.json()
    assert data3["call_count"] == 2
    assert "X-Cache" not in r3.headers


@pytest.mark.asyncio
async def test_export_endpoints():
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.main import app
    from app.auth.dependencies import get_current_user
    from app.db.session import get_db

    mock_user = MagicMock()
    mock_user.id = uuid4()
    mock_user.org_id = uuid4()
    mock_user.email = "buyer@example.com"
    mock_user.roles = []
    mock_user.vendor_id = None
    mock_user.is_supplier_user = False

    async def override_user():
        return mock_user

    async def override_db():
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result
        yield mock_session

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_db] = override_db

    client = TestClient(app)

    endpoints = [
        "/api/v1/requisitions/export/csv",
        "/api/v1/requisitions/export/pdf",
        "/api/v1/rfqs/export/csv",
        "/api/v1/rfqs/export/pdf",
        "/api/v1/vendors/export/csv",
        "/api/v1/vendors/export/pdf",
        "/api/v1/invoices/export/csv",
        "/api/v1/invoices/export/pdf",
        "/api/v1/analytics/export/csv",
        "/api/v1/analytics/export/pdf",
    ]

    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 200, f"Export endpoint {ep} returned {res.status_code}: {res.text}"
        if ep.endswith("/csv"):
            assert "text/csv" in res.headers.get("content-type", "")
        elif ep.endswith("/pdf"):
            assert "application/pdf" in res.headers.get("content-type", "")

    app.dependency_overrides.clear()
