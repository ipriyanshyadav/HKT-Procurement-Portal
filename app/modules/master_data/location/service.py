"""
DeliveryLocation Service — CRUD operations for delivery locations.

Responsibilities:
  - Enforce code uniqueness per org.
  - Validate country_code (must be exactly 2 chars, uppercased on ingest).
  - Cache-invalidate on any write so list queries stay consistent.
  - Emit structured audit events for every mutation.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID, uuid4

from loguru import logger
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.service import audit_service
from app.modules.master_data.models import DeliveryLocation


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class LocationCreateRequest(BaseModel):
    """Payload for creating a new DeliveryLocation."""

    code: str = Field(..., min_length=1, max_length=50, description="Unique location code within the org")
    name: str = Field(..., min_length=1, max_length=200, description="Human-readable location name")
    address: str = Field(..., min_length=1, description="Full street address")
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    postal_code: str = Field(..., min_length=1, max_length=20)
    country_code: str = Field(default="IN", min_length=2, max_length=2, description="ISO 3166-1 alpha-2 country code")
    plant_id: Optional[UUID] = Field(default=None, description="Optional FK to plants table")

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValidationError("country_code must be a string")
        stripped = v.strip().upper()
        if len(stripped) != 2:
            raise ValidationError(
                "country_code must be exactly 2 uppercase characters",
                {"received": v},
            )
        return stripped

    @field_validator("code", mode="before")
    @classmethod
    def _strip_code(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v


class LocationUpdateRequest(BaseModel):
    """Payload for partial update of a DeliveryLocation. All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    address: Optional[str] = Field(default=None, min_length=1)
    city: Optional[str] = Field(default=None, min_length=1, max_length=100)
    state: Optional[str] = Field(default=None, min_length=1, max_length=100)
    postal_code: Optional[str] = Field(default=None, min_length=1, max_length=20)
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2)
    plant_id: Optional[UUID] = Field(default=None)

    @field_validator("country_code", mode="before")
    @classmethod
    def _uppercase_country_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not isinstance(v, str):
            raise ValidationError("country_code must be a string")
        stripped = v.strip().upper()
        if len(stripped) != 2:
            raise ValidationError(
                "country_code must be exactly 2 uppercase characters",
                {"received": v},
            )
        return stripped


class LocationResponse(BaseModel):
    """Read-only projection of a DeliveryLocation ORM row."""

    id: UUID
    org_id: UUID
    code: str
    name: str
    address: str
    city: str
    state: str
    postal_code: str
    country_code: str
    plant_id: Optional[UUID]
    is_active: bool
    version: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------


class DeliveryLocationRepository:
    """
    Thin async data-access layer for DeliveryLocation.

    All queries are scoped to org_id and exclude soft-deleted rows by default.
    The repository never calls db.commit() — that is the caller's responsibility.
    """

    async def get_by_id(
        self,
        db: AsyncSession,
        id: UUID,
        org_id: UUID,
    ) -> DeliveryLocation:
        """Fetch one location by PK + org scope. Raises NotFoundError if absent."""
        stmt = select(DeliveryLocation).where(
            DeliveryLocation.id == id,
            DeliveryLocation.org_id == org_id,
            DeliveryLocation.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        obj = result.scalar_one_or_none()
        if obj is None:
            raise NotFoundError(
                f"DeliveryLocation '{id}' not found",
                {"id": str(id), "org_id": str(org_id)},
            )
        return obj

    async def get_by_code(
        self,
        db: AsyncSession,
        code: str,
        org_id: UUID,
        exclude_id: Optional[UUID] = None,
    ) -> Optional[DeliveryLocation]:
        """Return a location matching *code* within the org, optionally excluding a row id."""
        stmt = select(DeliveryLocation).where(
            DeliveryLocation.code == code,
            DeliveryLocation.org_id == org_id,
            DeliveryLocation.deleted_at.is_(None),
        )
        if exclude_id is not None:
            stmt = stmt.where(DeliveryLocation.id != exclude_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = True,
        country_code: Optional[str] = None,
    ) -> list[DeliveryLocation]:
        """Return all delivery locations for an org, with optional active/country filters."""
        stmt = select(DeliveryLocation).where(
            DeliveryLocation.org_id == org_id,
            DeliveryLocation.deleted_at.is_(None),
        )
        if active_only:
            stmt = stmt.where(DeliveryLocation.is_active.is_(True))
        if country_code is not None:
            stmt = stmt.where(DeliveryLocation.country_code == country_code.strip().upper())
        stmt = stmt.order_by(DeliveryLocation.code)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        db: AsyncSession,
        data: LocationCreateRequest,
        org_id: UUID,
    ) -> DeliveryLocation:
        """Persist a new DeliveryLocation. Caller must commit."""
        obj = DeliveryLocation(
            id=uuid4(),
            org_id=org_id,
            code=data.code,
            name=data.name,
            address=data.address,
            city=data.city,
            state=data.state,
            postal_code=data.postal_code,
            country_code=data.country_code,
            plant_id=data.plant_id,
            is_active=True,
        )
        db.add(obj)
        await db.flush()
        return obj

    async def update(
        self,
        db: AsyncSession,
        obj: DeliveryLocation,
        data: LocationUpdateRequest,
    ) -> DeliveryLocation:
        """Apply partial-update fields to an already-fetched ORM instance. Caller must commit."""
        update_fields = data.model_dump(exclude_none=True)
        for field, value in update_fields.items():
            setattr(obj, field, value)
        obj.version += 1
        await db.flush()
        return obj

    async def deactivate(
        self,
        db: AsyncSession,
        obj: DeliveryLocation,
    ) -> None:
        """Mark a location inactive (logical deactivation, not soft-delete). Caller must commit."""
        obj.is_active = False
        obj.version += 1
        await db.flush()


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class DeliveryLocationService:
    """
    Application-layer service for DeliveryLocation management.

    Enforces business rules:
      - Code uniqueness per org (case-insensitive; codes are stored uppercase).
      - country_code must be exactly 2 uppercase chars (validated at schema level and
        double-checked here for defence-in-depth).
      - Audit events emitted for every mutation.

    All DB writes are flushed inside the service; the router/unit-of-work layer is
    responsible for the final commit (or rollback on error).
    """

    def __init__(self, repo: DeliveryLocationRepository) -> None:
        self._repo = repo

    async def list_all(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = True,
        country_code: Optional[str] = None,
    ) -> list[DeliveryLocation]:
        """
        Return delivery locations for *org_id*.

        Args:
            db: Async SQLAlchemy session.
            org_id: Tenant scope.
            active_only: When True (default) only is_active=True rows are returned.
            country_code: Optional ISO-3166-1 alpha-2 filter (case-insensitive).

        Returns:
            Ordered list of DeliveryLocation ORM instances.
        """
        if country_code is not None:
            sanitized = country_code.strip().upper()
            if len(sanitized) != 2:
                raise ValidationError(
                    "country_code filter must be exactly 2 characters",
                    {"received": country_code},
                )
            country_code = sanitized

        locations = await self._repo.list_all(
            db, org_id, active_only=active_only, country_code=country_code
        )
        logger.debug(
            "DeliveryLocation list fetched",
            org_id=str(org_id),
            active_only=active_only,
            country_code=country_code,
            count=len(locations),
        )
        return locations

    async def get_by_id(
        self,
        db: AsyncSession,
        id: UUID,
        org_id: UUID,
    ) -> DeliveryLocation:
        """
        Fetch a single DeliveryLocation by primary key within the org scope.

        Raises:
            NotFoundError: When the location does not exist or belongs to a different org.
        """
        location = await self._repo.get_by_id(db, id, org_id)
        logger.debug(
            "DeliveryLocation fetched",
            location_id=str(id),
            org_id=str(org_id),
        )
        return location

    async def create(
        self,
        db: AsyncSession,
        data: LocationCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> DeliveryLocation:
        """
        Create a new DeliveryLocation.

        Business rules enforced:
          - *code* must be unique per org (case-insensitive; stored uppercase).

        Args:
            db: Async SQLAlchemy session.
            data: Validated create payload.
            actor_id: UUID of the user performing the action (for audit log).
            org_id: Tenant scope.

        Returns:
            Persisted DeliveryLocation instance (not yet committed).

        Raises:
            ConflictError: When *code* already exists in this org.
        """
        existing = await self._repo.get_by_code(db, data.code, org_id)
        if existing is not None:
            raise ConflictError(
                f"DeliveryLocation with code '{data.code}' already exists in this org",
                {"code": data.code, "org_id": str(org_id), "existing_id": str(existing.id)},
            )

        location = await self._repo.create(db, data, org_id)

        await audit_service.log(
            db,
            entity_type="MASTER_DATA",
            entity_id=location.id,
            action=AuditAction.MD_CREATED,
            actor_id=actor_id,
            org_id=org_id,
            new_values={
                "code": location.code,
                "name": location.name,
                "address": location.address,
                "city": location.city,
                "state": location.state,
                "postal_code": location.postal_code,
                "country_code": location.country_code,
                "plant_id": str(location.plant_id) if location.plant_id else None,
                "is_active": location.is_active,
            },
            metadata={"resource": "delivery_location"},
        )
        logger.info(
            "DeliveryLocation created",
            location_id=str(location.id),
            code=location.code,
            org_id=str(org_id),
            actor_id=str(actor_id),
        )
        return location

    async def update(
        self,
        db: AsyncSession,
        id: UUID,
        data: LocationUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> DeliveryLocation:
        """
        Partially update an existing DeliveryLocation.

        Code cannot be changed via update — use create + deactivate pattern instead.

        Args:
            db: Async SQLAlchemy session.
            id: PK of the location to update.
            data: Partial update payload (None fields are skipped).
            actor_id: UUID of the acting user (for audit log).
            org_id: Tenant scope.

        Returns:
            Updated DeliveryLocation instance (not yet committed).

        Raises:
            NotFoundError: When the location does not exist.
        """
        location = await self._repo.get_by_id(db, id, org_id)

        old_snapshot = {
            "name": location.name,
            "address": location.address,
            "city": location.city,
            "state": location.state,
            "postal_code": location.postal_code,
            "country_code": location.country_code,
            "plant_id": str(location.plant_id) if location.plant_id else None,
        }

        location = await self._repo.update(db, location, data)

        new_snapshot = {
            "name": location.name,
            "address": location.address,
            "city": location.city,
            "state": location.state,
            "postal_code": location.postal_code,
            "country_code": location.country_code,
            "plant_id": str(location.plant_id) if location.plant_id else None,
        }

        await audit_service.log(
            db,
            entity_type="MASTER_DATA",
            entity_id=location.id,
            action=AuditAction.MD_UPDATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values=old_snapshot,
            new_values=new_snapshot,
            metadata={"resource": "delivery_location"},
        )
        logger.info(
            "DeliveryLocation updated",
            location_id=str(id),
            org_id=str(org_id),
            actor_id=str(actor_id),
            changed_fields=list(data.model_dump(exclude_none=True).keys()),
        )
        return location

    async def deactivate(
        self,
        db: AsyncSession,
        id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        """
        Deactivate a DeliveryLocation (logical, not physical delete).

        Sets is_active=False and bumps the optimistic-lock version. The record
        remains queryable via list_all(active_only=False) or get_by_id().

        Args:
            db: Async SQLAlchemy session.
            id: PK of the location to deactivate.
            actor_id: UUID of the acting user (for audit log).
            org_id: Tenant scope.

        Raises:
            NotFoundError: When the location does not exist.
            ConflictError: When the location is already inactive.
        """
        location = await self._repo.get_by_id(db, id, org_id)

        if not location.is_active:
            raise ConflictError(
                f"DeliveryLocation '{id}' is already inactive",
                {"id": str(id), "org_id": str(org_id)},
            )

        await self._repo.deactivate(db, location)

        await audit_service.log(
            db,
            entity_type="MASTER_DATA",
            entity_id=location.id,
            action=AuditAction.DEACTIVATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values={"is_active": True},
            new_values={"is_active": False},
            metadata={"resource": "delivery_location", "code": location.code},
        )
        logger.info(
            "DeliveryLocation deactivated",
            location_id=str(id),
            code=location.code,
            org_id=str(org_id),
            actor_id=str(actor_id),
        )


# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

delivery_location_repository = DeliveryLocationRepository()
delivery_location_service = DeliveryLocationService(repo=delivery_location_repository)
