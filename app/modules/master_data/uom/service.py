from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from loguru import logger
from pydantic import BaseModel as PydanticBaseModel, Field, model_validator
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import ConflictError, NotFoundError
from app.db.repository_base import BaseRepository
from app.modules.audit.service import audit_service
from app.modules.master_data.models import UomMaster

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

_ENTITY_TYPE = "MASTER_DATA"


class UomCreateRequest(PydanticBaseModel):
    """Validated payload for creating a new Unit of Measure."""

    code: str = Field(..., min_length=1, max_length=20, description="Unique UoM code within the organisation.")
    name: str = Field(..., min_length=1, max_length=100, description="Human-readable name of the UoM.")
    iso_code: Optional[str] = Field(default=None, max_length=10, description="ISO 80000 or similar standard code.")


class UomUpdateRequest(PydanticBaseModel):
    """Validated payload for updating an existing Unit of Measure.

    All fields are optional; only supplied fields are applied.
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    iso_code: Optional[str] = Field(default=None, max_length=10)
    is_active: Optional[bool] = Field(default=None)

    @model_validator(mode="after")
    def at_least_one_field_set(self) -> UomUpdateRequest:
        if self.name is None and self.iso_code is None and self.is_active is None:
            raise ValueError("At least one of name, iso_code, or is_active must be provided.")
        return self


class UomResponse(PydanticBaseModel):
    """Serialised representation of a UomMaster record."""

    model_config = {"from_attributes": True}

    id: UUID
    org_id: UUID
    code: str
    name: str
    iso_code: Optional[str]
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------


class UomRepository(BaseRepository[UomMaster]):
    """Data-access layer for the uom_master table."""

    def __init__(self) -> None:
        super().__init__(UomMaster)

    async def find_by_code(
        self,
        db: AsyncSession,
        code: str,
        org_id: UUID,
    ) -> Optional[UomMaster]:
        """Return an active (non-deleted) UoM row matching *code* within *org_id*, or None."""
        stmt = select(UomMaster).where(
            and_(
                UomMaster.code == code,
                UomMaster.org_id == org_id,
                UomMaster.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_org(
        self,
        db: AsyncSession,
        org_id: UUID,
        include_inactive: bool = False,
    ) -> list[UomMaster]:
        """Return all non-deleted UoM records for *org_id*.

        When *include_inactive* is False (default) only rows with
        ``is_active=True`` are returned.
        """
        stmt = select(UomMaster).where(
            and_(
                UomMaster.org_id == org_id,
                UomMaster.deleted_at.is_(None),
            )
        )
        if not include_inactive:
            stmt = stmt.where(UomMaster.is_active.is_(True))
        stmt = stmt.order_by(UomMaster.code)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_active(self, db: AsyncSession, id: UUID, org_id: UUID) -> UomMaster:
        """Fetch a non-deleted UoM by primary key and org scope.

        Raises :class:`~app.core.exceptions.NotFoundError` when absent.
        """
        stmt = select(UomMaster).where(
            and_(
                UomMaster.id == id,
                UomMaster.org_id == org_id,
                UomMaster.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        obj = result.scalar_one_or_none()
        if obj is None:
            raise NotFoundError(
                f"UoM with id '{id}' not found.",
                details={"id": str(id), "org_id": str(org_id)},
            )
        return obj


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class UomService:
    """Business-logic layer for Unit of Measure master data.

    Follows the router -> service -> repository -> model layering discipline.
    All database mutations are committed by the caller (FastAPI route) so that
    the audit log entry participates in the same transaction.
    """

    def __init__(self, repository: UomRepository) -> None:
        self._repo = repository

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    async def list_all(
        self,
        db: AsyncSession,
        org_id: UUID,
        include_inactive: bool = False,
        active_only: Optional[bool] = None,
    ) -> list[UomMaster]:
        """Return all UoM records visible to *org_id*.

        Args:
            db: Active async database session.
            org_id: Tenant scope.
            include_inactive: When ``True`` inactive records are included.
            active_only: When supplied, overrides ``include_inactive`` (True => include_inactive=False, False => include_inactive=True).

        Returns:
            Ordered list of :class:`~app.modules.master_data.models.UomMaster` ORM instances.
        """
        if active_only is not None:
            include_inactive = not active_only
        records = await self._repo.list_by_org(db, org_id, include_inactive=include_inactive)
        logger.debug(
            "UomService.list_all | org_id={org_id} include_inactive={include_inactive} count={count}",
            org_id=org_id,
            include_inactive=include_inactive,
            count=len(records),
        )
        return records

    async def get_by_id(
        self,
        db: AsyncSession,
        id: UUID,
        org_id: UUID,
    ) -> UomMaster:
        """Fetch a single UoM by primary key within *org_id*.

        Args:
            db: Active async database session.
            id: Primary key of the UoM record.
            org_id: Tenant scope.

        Returns:
            The matching :class:`~app.modules.master_data.models.UomMaster` instance.

        Raises:
            :class:`~app.core.exceptions.NotFoundError`: When the record does not exist.
        """
        record = await self._repo.get_active(db, id, org_id)
        logger.debug(
            "UomService.get_by_id | org_id={org_id} id={id}",
            org_id=org_id,
            id=id,
        )
        return record

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------

    async def create(
        self,
        db: AsyncSession,
        data: UomCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> UomMaster:
        """Create a new UoM record.

        Enforces per-organisation ``code`` uniqueness among non-deleted rows.

        Args:
            db: Active async database session.
            data: Validated creation payload.
            actor_id: UUID of the authenticated user performing the action.
            org_id: Tenant scope.

        Returns:
            The newly persisted :class:`~app.modules.master_data.models.UomMaster` instance.

        Raises:
            :class:`~app.core.exceptions.ConflictError`: When *code* already exists for *org_id*.
        """
        existing = await self._repo.find_by_code(db, data.code, org_id)
        if existing is not None:
            raise ConflictError(
                f"UoM code '{data.code}' already exists for this organisation.",
                details={"code": data.code, "org_id": str(org_id)},
            )

        uom = UomMaster(
            org_id=org_id,
            code=data.code.strip().upper(),
            name=data.name.strip(),
            iso_code=data.iso_code.strip() if data.iso_code else None,
            is_active=True,
            version=1,
        )
        db.add(uom)
        await db.flush()  # Populate uom.id before audit log references it.

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=uom.id,
            action=AuditAction.MD_CREATED,
            actor_id=actor_id,
            org_id=org_id,
            new_values={
                "code": uom.code,
                "name": uom.name,
                "iso_code": uom.iso_code,
                "is_active": uom.is_active,
            },
        )

        logger.info(
            "UomService.create | org_id={org_id} actor_id={actor_id} code={code} uom_id={uom_id}",
            org_id=org_id,
            actor_id=actor_id,
            code=uom.code,
            uom_id=uom.id,
        )
        return uom

    async def update(
        self,
        db: AsyncSession,
        id: UUID,
        data: UomUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> UomMaster:
        """Apply a partial update to an existing UoM record.

        Only fields explicitly set in *data* are mutated. Version is incremented
        on every successful update to support optimistic-lock detection upstream.

        Args:
            db: Active async database session.
            id: Primary key of the UoM record.
            data: Validated update payload (at least one field required).
            actor_id: UUID of the authenticated user performing the action.
            org_id: Tenant scope.

        Returns:
            The updated :class:`~app.modules.master_data.models.UomMaster` instance.

        Raises:
            :class:`~app.core.exceptions.NotFoundError`: When the record does not exist.
        """
        uom = await self._repo.get_active(db, id, org_id)

        old_values: dict = {
            "name": uom.name,
            "iso_code": uom.iso_code,
            "is_active": uom.is_active,
        }

        if data.name is not None:
            uom.name = data.name.strip()
        if data.iso_code is not None:
            uom.iso_code = data.iso_code.strip()
        if data.is_active is not None:
            uom.is_active = data.is_active

        uom.version += 1

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=uom.id,
            action=AuditAction.MD_UPDATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values=old_values,
            new_values={
                "name": uom.name,
                "iso_code": uom.iso_code,
                "is_active": uom.is_active,
            },
        )

        logger.info(
            "UomService.update | org_id={org_id} actor_id={actor_id} uom_id={uom_id} version={version}",
            org_id=org_id,
            actor_id=actor_id,
            uom_id=uom.id,
            version=uom.version,
        )
        return uom

    async def deactivate(
        self,
        db: AsyncSession,
        id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        """Soft-deactivate a UoM record by setting ``is_active=False``.

        This is *not* a soft delete — the row remains queryable and its
        ``deleted_at`` field is left untouched.  Pass ``include_inactive=True``
        to :meth:`list_all` to retrieve deactivated records.

        Args:
            db: Active async database session.
            id: Primary key of the UoM record.
            actor_id: UUID of the authenticated user performing the action.
            org_id: Tenant scope.

        Raises:
            :class:`~app.core.exceptions.NotFoundError`: When the record does not exist.
        """
        uom = await self._repo.get_active(db, id, org_id)

        uom.is_active = False
        uom.version += 1

        await audit_service.log(
            db=db,
            entity_type=_ENTITY_TYPE,
            entity_id=uom.id,
            action=AuditAction.DEACTIVATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values={"is_active": True},
            new_values={"is_active": False},
        )

        logger.info(
            "UomService.deactivate | org_id={org_id} actor_id={actor_id} uom_id={uom_id}",
            org_id=org_id,
            actor_id=actor_id,
            uom_id=uom.id,
        )

    async def soft_delete(
        self,
        db: AsyncSession,
        id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        """Soft delete (deactivate) a UoM record."""
        await self.deactivate(db, id, actor_id, org_id)


# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

uom_repository = UomRepository()
uom_service = UomService(repository=uom_repository)
