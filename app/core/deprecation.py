from __future__ import annotations
from datetime import date
from typing import Optional
from fastapi import Response


def add_deprecation_headers(
    response: Response,
    sunset_date: date,
    successor_url: str = "",
) -> Response:
    """Add standard Deprecation, Sunset, and Link headers to an outgoing HTTP response."""
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = sunset_date.strftime("%a, %d %b %Y 00:00:00 GMT")
    if successor_url:
        response.headers["Link"] = f'<{successor_url}>; rel="successor-version"'
    return response
