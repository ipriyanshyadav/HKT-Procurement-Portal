from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import AuditAction
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.redis_client import RedisKeys, get_redis_client
from app.db.repository_base import BaseRepository
from app.modules.audit.service import audit_service
from app.modules.master_data.models import CurrencyMaster

_ENTITY_TYPE = "MASTER_DATA"


class CurrencyCreateRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=3, description="ISO 4217 3-letter currency code")
    name: str = Field(..., min_length=1, max_length=100)
    symbol: str = Field(default="", max_length=10)
    exchange_rate_to_base: Decimal = Field(default=Decimal("1.0"), gt=Decimal("0"))
    is_base_currency: bool = Field(default=False)


class CurrencyUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    symbol: Optional[str] = Field(default=None, max_length=10)
    exchange_rate_to_base: Optional[Decimal] = Field(default=None, gt=Decimal("0"))
    is_active: Optional[bool] = None


class CurrencyResponse(BaseModel):
    id: UUID
    org_id: UUID
    code: str
    name: str
    symbol: str
    exchange_rate_to_base: Decimal
    is_base_currency: bool
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CurrencyRepository(BaseRepository[CurrencyMaster]):
    def __init__(self) -> None:
        super().__init__(CurrencyMaster)

    async def get_by_code(
        self,
        db: AsyncSession,
        code: str,
        org_id: UUID,
    ) -> Optional[CurrencyMaster]:
        stmt = select(CurrencyMaster).where(
            CurrencyMaster.code == code.upper(),
            CurrencyMaster.org_id == org_id,
            CurrencyMaster.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_base_currency(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> Optional[CurrencyMaster]:
        stmt = select(CurrencyMaster).where(
            CurrencyMaster.org_id == org_id,
            CurrencyMaster.is_base_currency.is_(True),
            CurrencyMaster.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


class CurrencyService:
    def __init__(self, repo: CurrencyRepository) -> None:
        self._repo = repo

    async def list_all(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = True,
        include_rates: bool = False,
    ) -> list[CurrencyMaster]:
        stmt = select(CurrencyMaster).where(
            CurrencyMaster.org_id == org_id,
            CurrencyMaster.deleted_at.is_(None),
        )
        if active_only:
            stmt = stmt.where(CurrencyMaster.is_active.is_(True))
        stmt = stmt.order_by(CurrencyMaster.code.asc())
        result = await db.execute(stmt)
        currencies = list(result.scalars().all())

        if include_rates:
            base_currency = await self._repo.get_base_currency(db, org_id)
            base_code = base_currency.code if base_currency else "INR"
            redis_client = get_redis_client(settings.REDIS_CACHE_DB)
            try:
                for curr in currencies:
                    if curr.code != base_code:
                        cached_rate = await redis_client.get(RedisKeys.exchange_rate(base_code, curr.code))
                        if cached_rate:
                            curr.exchange_rate_to_base = Decimal(cached_rate.decode("utf-8") if isinstance(cached_rate, bytes) else str(cached_rate))
            except Exception as e:
                logger.warning(f"Error fetching cached exchange rates: {e}")
            finally:
                await redis_client.aclose()

        return currencies

    async def get_by_id(self, db: AsyncSession, id: UUID, org_id: UUID) -> CurrencyMaster:
        return await self._repo.get(db, id, org_id)

    async def get_by_code(self, db: AsyncSession, code: str, org_id: UUID) -> Optional[CurrencyMaster]:
        return await self._repo.get_by_code(db, code, org_id)

    async def create(
        self,
        db: AsyncSession,
        data: CurrencyCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> CurrencyMaster:
        code_upper = data.code.strip().upper()
        existing = await self._repo.get_by_code(db, code_upper, org_id)
        if existing:
            raise ConflictError(
                f"Currency with code '{code_upper}' already exists",
                {"code": code_upper},
            )

        if data.is_base_currency:
            current_base = await self._repo.get_base_currency(db, org_id)
            if current_base:
                current_base.is_base_currency = False
                current_base.version += 1

        currency = CurrencyMaster(
            id=uuid4(),
            org_id=org_id,
            code=code_upper,
            name=data.name,
            symbol=data.symbol,
            exchange_rate_to_base=Decimal("1.0") if data.is_base_currency else data.exchange_rate_to_base,
            is_base_currency=data.is_base_currency,
            is_active=True,
        )
        db.add(currency)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=currency.id,
            action=AuditAction.MD_CREATED,
            actor_id=actor_id,
            org_id=org_id,
            new_values={
                "code": currency.code,
                "name": currency.name,
                "symbol": currency.symbol,
                "exchange_rate_to_base": str(currency.exchange_rate_to_base),
                "is_base_currency": currency.is_base_currency,
            },
        )
        logger.info("Currency created", id=str(currency.id), code=currency.code, org_id=str(org_id))
        return currency

    async def update(
        self,
        db: AsyncSession,
        id: UUID,
        data: CurrencyUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> CurrencyMaster:
        currency = await self._repo.get(db, id, org_id)
        old_values = {
            "name": currency.name,
            "symbol": currency.symbol,
            "exchange_rate_to_base": str(currency.exchange_rate_to_base),
            "is_active": currency.is_active,
        }

        if data.name is not None:
            currency.name = data.name
        if data.symbol is not None:
            currency.symbol = data.symbol
        if data.exchange_rate_to_base is not None:
            currency.exchange_rate_to_base = data.exchange_rate_to_base
        if data.is_active is not None:
            currency.is_active = data.is_active

        currency.version += 1
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=currency.id,
            action=AuditAction.MD_UPDATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values=old_values,
            new_values={
                "name": currency.name,
                "symbol": currency.symbol,
                "exchange_rate_to_base": str(currency.exchange_rate_to_base),
                "is_active": currency.is_active,
            },
        )
        logger.info("Currency updated", id=str(currency.id), org_id=str(org_id))
        return currency

    async def deactivate(
        self,
        db: AsyncSession,
        id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        currency = await self._repo.get(db, id, org_id)
        if currency.is_base_currency:
            raise ValidationError(
                "CANNOT_DEACTIVATE_BASE_CURRENCY",
                {"error": "Cannot deactivate the organisation base currency"},
            )

        currency.is_active = False
        currency.version += 1
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=currency.id,
            action=AuditAction.DEACTIVATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values={"is_active": True},
            new_values={"is_active": False},
        )
        logger.info("Currency deactivated", id=str(currency.id), org_id=str(org_id))

    async def get_exchange_rate(self, base: str, target: str) -> Optional[Decimal]:
        """Fetch cached exchange rate from Redis."""
        if base == target:
            return Decimal("1.0")

        redis_client = get_redis_client(settings.REDIS_CACHE_DB)
        try:
            cache_key = RedisKeys.exchange_rate(base.upper(), target.upper())
            val = await redis_client.get(cache_key)
            if val:
                return Decimal(val.decode("utf-8") if isinstance(val, bytes) else str(val))
            return None
        finally:
            await redis_client.aclose()

    async def upsert_rate(
        self,
        db: AsyncSession,
        base: str,
        target: str,
        rate: Decimal,
        org_id: UUID,
    ) -> None:
        """Persist rate to database and cache in Redis."""
        redis_client = get_redis_client(settings.REDIS_CACHE_DB)
        try:
            cache_key = RedisKeys.exchange_rate(base.upper(), target.upper())
            ttl = getattr(settings, "EXCHANGE_RATE_CACHE_TTL_SECONDS", 86400)
            await redis_client.setex(cache_key, ttl, str(rate))
        finally:
            await redis_client.aclose()

        target_curr = await self._repo.get_by_code(db, target.upper(), org_id)
        if target_curr:
            target_curr.exchange_rate_to_base = rate
            target_curr.version += 1
            await db.flush()


currency_repository = CurrencyRepository()
currency_service = CurrencyService(repo=currency_repository)
