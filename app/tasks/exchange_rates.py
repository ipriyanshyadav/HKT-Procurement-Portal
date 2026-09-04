from __future__ import annotations

import asyncio
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from loguru import logger
from sqlalchemy import select

from app.config import settings
from app.core.redis_client import RedisKeys, get_redis_client
from app.db.session import async_session
from app.modules.integration.models import TenantSetting
from app.modules.master_data.models import CurrencyMaster
from app.tasks.celery_app import celery_app


@celery_app.task(queue="integrations", name="app.tasks.integration.update_exchange_rates")
def refresh_exchange_rates() -> None:
    """Daily Celery task to fetch latest exchange rates and update cache + DB."""
    asyncio.run(_async_refresh())


async def _async_refresh() -> None:
    """Fetch daily exchange rates; cache in Redis and persist to DB."""
    async with async_session() as db:
        # Collect base currencies across tenant settings, default to INR and USD
        base_currencies = {"INR", "USD"}
        try:
            stmt = select(TenantSetting).where(
                TenantSetting.setting_key == "BASE_CURRENCY",
                TenantSetting.deleted_at.is_(None),
            )
            result = await db.execute(stmt)
            settings_rows = result.scalars().all()
            for row in settings_rows:
                val = row.setting_value
                if isinstance(val, dict) and "currency" in val:
                    base_currencies.add(val["currency"].upper())
                elif isinstance(val, str):
                    base_currencies.add(val.upper())
        except Exception as e:
            logger.warning(f"Failed to query tenant settings for base currencies: {e}")

        # Also find any currency configured as base in CurrencyMaster
        try:
            base_curr_stmt = select(CurrencyMaster.code).where(
                CurrencyMaster.is_base_currency.is_(True),
                CurrencyMaster.deleted_at.is_(None),
            )
            base_curr_res = await db.execute(base_curr_stmt)
            for code in base_curr_res.scalars().all():
                base_currencies.add(code.upper())
        except Exception as e:
            logger.warning(f"Failed to query currency_master for base currencies: {e}")

        redis_client = get_redis_client(settings.REDIS_CACHE_DB)
        async with httpx.AsyncClient(timeout=15.0) as client:
            for base in base_currencies:
                try:
                    url = f"{settings.EXCHANGE_RATE_API_URL}/{base}"
                    params: dict[str, str] = {}
                    if settings.EXCHANGE_RATE_API_KEY:
                        params["apikey"] = settings.EXCHANGE_RATE_API_KEY
                    resp = await client.get(url, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                        rates = data.get("rates", {})
                        ttl = getattr(settings, "EXCHANGE_RATE_CACHE_TTL_SECONDS", 86400)
                        for target, rate in rates.items():
                            rate_dec = Decimal(str(rate))
                            cache_key = RedisKeys.exchange_rate(base, target)
                            await redis_client.setex(cache_key, ttl, str(rate_dec))

                            # Persist to DB for all currencies matching target
                            upd_stmt = select(CurrencyMaster).where(
                                CurrencyMaster.code == target,
                                CurrencyMaster.deleted_at.is_(None),
                            )
                            upd_res = await db.execute(upd_stmt)
                            for curr in upd_res.scalars().all():
                                if not curr.is_base_currency:
                                    curr.exchange_rate_to_base = rate_dec
                                    curr.version += 1
                        logger.info(f"Refreshed exchange rates for base currency {base}")
                except Exception as e:
                    logger.error(f"Failed to fetch exchange rates for {base}: {e}")

        await db.commit()
        await redis_client.aclose()
