import pytest
from app.core.pagination import PaginationParams, encode_cursor, decode_cursor

def test_pagination_params_defaults():
    params = PaginationParams()
    assert params.page == 1
    assert params.page_size == 20
    assert params.sort_by == "created_at"
    assert params.sort_dir == "desc"

def test_cursor_encoding_decoding():
    original = {"id": "123", "created_at": "2023-01-01T00:00:00Z"}
    encoded = encode_cursor(original)
    assert isinstance(encoded, str)
    
    decoded = decode_cursor(encoded)
    assert decoded == original

def test_decode_cursor_empty():
    assert decode_cursor("") == {}
    assert decode_cursor("invalid-base64") == {}
    assert decode_cursor(None) == {}
