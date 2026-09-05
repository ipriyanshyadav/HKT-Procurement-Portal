from __future__ import annotations

import json
import re
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.core.redis_client import RedisKeys, get_redis_client
from ..http_client import SafeHTTPClient


GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


class GSTAdapter:
    """GSTN Portal verification adapter supporting live Taxpayer API, caching, and fallback."""

    def __init__(self, redis_client=None) -> None:
        self._redis = redis_client

    async def _get_redis(self):
        if self._redis is None:
            self._redis = get_redis_client(db_index=settings.REDIS_CACHE_DB)
        return self._redis

    @staticmethod
    def validate_format(gstin: str) -> bool:
        if not gstin:
            return False
        return bool(GSTIN_REGEX.match(gstin.strip().upper()))

    async def validate(self, gstin: str, vendor_legal_name: Optional[str] = None) -> dict[str, Any]:
        cleaned_gstin = gstin.strip().upper() if gstin else ""
        if not self.validate_format(cleaned_gstin):
            return {
                "gstin": cleaned_gstin,
                "is_valid": False,
                "error": "INVALID_GSTIN_FORMAT",
                "status": "INVALID",
                "flag_for_manual_review": True,
            }

        cache_key = RedisKeys.vendor_verify("gst", cleaned_gstin)
        redis = await self._get_redis()
        try:
            cached = await redis.get(cache_key)
            if cached:
                if isinstance(cached, bytes):
                    cached = cached.decode("utf-8")
                return json.loads(cached)
        except Exception:
            pass

        state_code = cleaned_gstin[:2]
        pan_from_gstin = cleaned_gstin[2:12]

        if settings.GST_API_BASE_URL and settings.GST_API_KEY:
            try:
                base_url = settings.GST_API_BASE_URL.rstrip("/")
                parsed_host = urlparse(base_url).hostname
                allowed = [parsed_host] if parsed_host else []
                client = SafeHTTPClient(allowed_domains=allowed)

                resp = await client.get(
                    f"{base_url}/taxpayer/{cleaned_gstin}",
                    headers={"Authorization": f"Bearer {settings.GST_API_KEY}"},
                )
                resp.raise_for_status()
                data = resp.json()
                result = {
                    "gstin": cleaned_gstin,
                    "is_valid": True,
                    "legal_name": data.get("lgnm", vendor_legal_name or "Verified Entity"),
                    "trade_name": data.get("tradeNam", ""),
                    "status": data.get("sts", "Active"),
                    "state_code": data.get("stcd", state_code),
                    "registration_date": data.get("rgdt", ""),
                    "pan": pan_from_gstin,
                    "flag_for_manual_review": data.get("sts", "").lower() != "active",
                }
            except httpx.HTTPStatusError:
                result = {
                    "gstin": cleaned_gstin,
                    "is_valid": False,
                    "status": "UNVERIFIED",
                    "error": "API_ERROR",
                    "flag_for_manual_review": True,
                }
            except (httpx.TimeoutException, httpx.RequestError, Exception):
                result = {
                    "gstin": cleaned_gstin,
                    "is_valid": False,
                    "status": "UNVERIFIED",
                    "error": "TIMEOUT",
                    "flag_for_manual_review": True,
                }
        else:
            result = {
                "gstin": cleaned_gstin,
                "is_valid": True,
                "legal_name": vendor_legal_name or "MOCK GST TAXPAYER",
                "trade_name": vendor_legal_name or "MOCK GST TAXPAYER",
                "status": "Active",
                "state_code": state_code,
                "pan": pan_from_gstin,
                "flag_for_manual_review": False,
            }

        try:
            ttl = settings.VENDOR_GST_CACHE_TTL_DAYS * 86400
            await redis.setex(cache_key, ttl, json.dumps(result))
        except Exception:
            pass

        return result
