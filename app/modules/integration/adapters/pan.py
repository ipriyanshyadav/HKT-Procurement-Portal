from __future__ import annotations

import json
import re
from typing import Any, Optional
import httpx
from app.config import settings
from app.core.redis_client import RedisKeys, get_redis_client


PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")


class PANAdapter:
    """
    Income Tax Department PAN Verification Adapter.
    Validates format, entity classification, and checks NSDL / Protean API with Redis caching.
    """

    def __init__(self, redis_client=None) -> None:
        self._redis = redis_client

    async def _get_redis(self):
        if self._redis is None:
            self._redis = get_redis_client(db_index=settings.REDIS_CACHE_DB)
        return self._redis

    @staticmethod
    def validate_format(pan: str) -> bool:
        if not pan:
            return False
        return bool(PAN_REGEX.match(pan.strip().upper()))

    async def validate(self, pan: str, name: Optional[str] = None) -> dict[str, Any]:
        cleaned_pan = pan.strip().upper() if pan else ""
        if not self.validate_format(cleaned_pan):
            return {
                "pan": cleaned_pan,
                "is_valid": False,
                "error": "INVALID_PAN_FORMAT",
                "pan_status": "INVALID",
                "flag_for_manual_review": True,
            }

        cache_key = RedisKeys.vendor_verify("pan", cleaned_pan)
        redis = await self._get_redis()
        try:
            cached = await redis.get(cache_key)
            if cached:
                if isinstance(cached, bytes):
                    cached = cached.decode("utf-8")
                return json.loads(cached)
        except Exception:
            pass

        entity_type_char = cleaned_pan[3]
        entity_types = {
            "C": "COMPANY",
            "P": "INDIVIDUAL",
            "H": "HUF",
            "F": "FIRM_LLP",
            "A": "AOP",
            "T": "TRUST",
            "B": "BOI",
            "L": "LOCAL_AUTHORITY",
            "J": "ARTIFICIAL_JURIDICAL",
            "G": "GOVERNMENT",
        }
        entity_type = entity_types.get(entity_type_char, "OTHER")

        nsdl_url = getattr(settings, "NSDL_API_BASE_URL", None)
        nsdl_key = getattr(settings, "NSDL_API_KEY", None)

        if nsdl_url and nsdl_key:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{nsdl_url}/verify",
                        json={"pan": cleaned_pan, "name": name or ""},
                        headers={"Authorization": f"Bearer {nsdl_key}"},
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    result = {
                        "pan": cleaned_pan,
                        "is_valid": data.get("valid", True),
                        "name_on_pan": data.get("name", name or "VERIFIED PAN HOLDER"),
                        "name_match": data.get("name_match", True),
                        "pan_status": data.get("status", "VALID"),
                        "entity_type": entity_type,
                        "flag_for_manual_review": not data.get("valid", True),
                    }
            except httpx.HTTPStatusError:
                result = {
                    "pan": cleaned_pan,
                    "is_valid": False,
                    "status": "UNVERIFIED",
                    "error": "API_ERROR",
                    "flag_for_manual_review": True,
                }
            except (httpx.TimeoutException, httpx.RequestError):
                result = {
                    "pan": cleaned_pan,
                    "is_valid": False,
                    "status": "UNVERIFIED",
                    "error": "TIMEOUT",
                    "flag_for_manual_review": True,
                }
        else:
            # Deterministic Mock / Simulation mode
            result = {
                "pan": cleaned_pan,
                "is_valid": True,
                "name_on_pan": name or "VERIFIED CORPORATE ENTITY",
                "name_match": True,
                "pan_status": "VALID",
                "entity_type": entity_type,
                "flag_for_manual_review": False,
            }

        try:
            ttl = getattr(settings, "VENDOR_GST_CACHE_TTL_DAYS", 30) * 86400
            await redis.setex(cache_key, ttl, json.dumps(result))
        except Exception:
            pass

        return result


pan_adapter = PANAdapter()
