"""
TaxService — GST HSN/SAC codes and TDS management.

Allowed tax types: GST, IGST, CGST, SGST, CESS, TDS, TCS.
Code must be unique per org. Rate must be in [0, 100].
All mutations are audit-logged via AuditService (INSERT-ONLY, no commit).
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from loguru import logger
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.db.repository_base import BaseRepository
from app.modules.audit.service import audit_service
from app.modules.master_data.models import TaxCode


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALLOWED_TAX_TYPES: frozenset[str] = frozenset(
    {"GST", "IGST", "CGST", "SGST", "CESS", "TDS", "TCS"}
)

_ENTITY_TYPE = "MASTER_DATA"
_RESOURCE_LABEL = "TaxCode"


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class TaxCreateRequest(BaseModel):
    """Validated payload for creating a new TaxCode."""

    code: str
    name: str
    rate: Decimal
    tax_type: str
    hsn_chapter: Optional[str] = None

    @field_validator("rate")
    @classmethod
    def _validate_rate(cls, v: Decimal) -> Decimal:
        if v < Decimal("0") or v > Decimal("100"):
            raise ValueError("rate must be between 0 and 100 inclusive")
        return v

    @field_validator("tax_type")
    @classmethod
    def _validate_tax_type(cls, v: str) -> str:
        normalised = v.upper().strip()
        if normalised not in ALLOWED_TAX_TYPES:
            raise ValueError(
                f"tax_type must be one of {sorted(ALLOWED_TAX_TYPES)}, got '{v}'"
            )
        return normalised

    @field_validator("code")
    @classmethod
    def _validate_code(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("code must not be blank")
        return stripped

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class TaxUpdateRequest(BaseModel):
    """Validated payload for updating an existing TaxCode. All fields optional."""

    name: Optional[str] = None
    rate: Optional[Decimal] = None
    tax_type: Optional[str] = None
    hsn_chapter: Optional[str] = None

    @field_validator("rate")
    @classmethod
    def _validate_rate(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and (v < Decimal("0") or v > Decimal("100")):
            raise ValueError("rate must be between 0 and 100 inclusive")
        return v

    @field_validator("tax_type")
    @classmethod
    def _validate_tax_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        normalised = v.upper().strip()
        if normalised not in ALLOWED_TAX_TYPES:
            raise ValueError(
                f"tax_type must be one of {sorted(ALLOWED_TAX_TYPES)}, got '{v}'"
            )
        return normalised

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("name must not be blank")
        return v.strip() if v else v

    @model_validator(mode="after")
    def _at_least_one_field(self) -> TaxUpdateRequest:
        if all(
            getattr(self, f) is None
            for f in ("name", "rate", "tax_type", "hsn_chapter")
        ):
            raise ValueError("At least one field must be provided for update")
        return self


class TaxResponse(BaseModel):
    """Serialisable representation of a TaxCode record."""

    id: UUID
    org_id: UUID
    code: str
    name: str
    rate: Decimal
    tax_type: str
    hsn_chapter: Optional[str]
    is_active: bool
    version: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------


class TaxCodeRepository(BaseRepository[TaxCode]):
    """Data-access layer for TaxCode entities."""

    def __init__(self) -> None:
        super().__init__(TaxCode)

    async def get_by_code_and_org(
        self,
        db: AsyncSession,
        code: str,
        org_id: UUID,
        exclude_id: Optional[UUID] = None,
    ) -> Optional[TaxCode]:
        """Return a non-deleted TaxCode matching (code, org_id), optionally excluding one id."""
        stmt = select(TaxCode).where(
            and_(
                TaxCode.code == code,
                TaxCode.org_id == org_id,
                TaxCode.deleted_at.is_(None),
            )
        )
        if exclude_id is not None:
            stmt = stmt.where(TaxCode.id != exclude_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_org(
        self,
        db: AsyncSession,
        org_id: UUID,
        tax_type: Optional[str] = None,
        active_only: bool = True,
    ) -> list[TaxCode]:
        """Return all non-deleted TaxCodes for an org, with optional type/active filters."""
        filters = [
            TaxCode.org_id == org_id,
            TaxCode.deleted_at.is_(None),
        ]
        if active_only:
            filters.append(TaxCode.is_active.is_(True))
        if tax_type is not None:
            filters.append(TaxCode.tax_type == tax_type.upper().strip())
        stmt = (
            select(TaxCode)
            .where(and_(*filters))
            .order_by(TaxCode.code.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def search_by_hsn_prefix(
        self,
        db: AsyncSession,
        org_id: UUID,
        hsn_prefix: str,
    ) -> list[TaxCode]:
        """Return non-deleted TaxCodes whose hsn_chapter starts with hsn_prefix (LIKE query)."""
        like_pattern = f"{hsn_prefix}%"
        stmt = (
            select(TaxCode)
            .where(
                and_(
                    TaxCode.org_id == org_id,
                    TaxCode.hsn_chapter.like(like_pattern),
                    TaxCode.deleted_at.is_(None),
                )
            )
            .order_by(TaxCode.hsn_chapter.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class TaxService:
    """
    Application-layer service for TaxCode master data (GST HSN/SAC codes + TDS/TCS).

    Responsibilities
    ----------------
    - Enforce business rules: rate range, allowed tax_type enum, code uniqueness per org.
    - Persist changes via TaxCodeRepository.
    - Emit audit log entries via AuditService (INSERT-ONLY, no commit).
    - Never hold mutable state beyond the injected repository singleton.
    """

    def __init__(self, repo: TaxCodeRepository) -> None:
        self._repo = repo

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    async def list_all(
        self,
        db: AsyncSession,
        org_id: UUID,
        tax_type: Optional[str] = None,
        active_only: bool = True,
    ) -> list[TaxCode]:
        """
        Return TaxCodes for an org.

        Parameters
        ----------
        tax_type:
            Optional filter; must be one of ALLOWED_TAX_TYPES if supplied.
        active_only:
            When True (default) only is_active=True records are returned.
        """
        if tax_type is not None:
            normalised = tax_type.upper().strip()
            if normalised not in ALLOWED_TAX_TYPES:
                raise ValidationError(
                    f"Invalid tax_type filter '{tax_type}'. "
                    f"Allowed: {sorted(ALLOWED_TAX_TYPES)}"
                )
            tax_type = normalised

        records = await self._repo.list_by_org(
            db, org_id, tax_type=tax_type, active_only=active_only
        )
        logger.debug(
            "TaxCode list fetched",
            org_id=str(org_id),
            tax_type=tax_type,
            active_only=active_only,
            count=len(records),
        )
        return records

    async def get_by_id(
        self,
        db: AsyncSession,
        id: UUID,
        org_id: UUID,
    ) -> TaxCode:
        """
        Fetch a single TaxCode by primary key, scoped to org_id.

        Raises NotFoundError if absent or soft-deleted.
        """
        record = await self._repo.get(db, id, org_id)
        logger.debug("TaxCode fetched", id=str(id), org_id=str(org_id))
        return record

    async def search_by_hsn(
        self,
        db: AsyncSession,
        org_id: UUID,
        hsn_prefix: str,
    ) -> list[TaxCode]:
        """
        LIKE-search TaxCodes where hsn_chapter starts with hsn_prefix.

        Parameters
        ----------
        hsn_prefix:
            Leading digits/chars of the HSN chapter (e.g. "84" matches chapter 84xx).
        """
        prefix = hsn_prefix.strip()
        if not prefix:
            raise ValidationError("hsn_prefix must not be blank")

        records = await self._repo.search_by_hsn_prefix(db, org_id, prefix)
        logger.debug(
            "TaxCode HSN search",
            org_id=str(org_id),
            hsn_prefix=prefix,
            count=len(records),
        )
        return records

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------

    async def create(
        self,
        db: AsyncSession,
        data: TaxCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> TaxCode:
        """
        Create a new TaxCode.

        Business rules enforced
        -----------------------
        - code must be unique within the org (across non-deleted records).
        - rate in [0, 100].
        - tax_type in ALLOWED_TAX_TYPES.
        """
        await self._assert_code_unique(db, data.code, org_id)

        tax_code = TaxCode(
            id=uuid4(),
            org_id=org_id,
            code=data.code,
            name=data.name,
            rate=data.rate,
            tax_type=data.tax_type,
            hsn_chapter=data.hsn_chapter,
            is_active=True,
        )
        db.add(tax_code)

        await audit_service.log(
            db,
            _ENTITY_TYPE,
            tax_code.id,
            AuditAction.MD_CREATED,
            actor_id,
            org_id,
            new_values=self._to_audit_dict(tax_code),
        )

        logger.info(
            "TaxCode created",
            code=data.code,
            tax_type=data.tax_type,
            org_id=str(org_id),
            actor_id=str(actor_id),
        )
        return tax_code

    async def update(
        self,
        db: AsyncSession,
        id: UUID,
        data: TaxUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> TaxCode:
        """
        Partially update a TaxCode.

        Only non-None fields from TaxUpdateRequest are applied.
        Bumps the optimistic-lock version counter.
        """
        tax_code = await self._repo.get(db, id, org_id)
        old_snapshot = self._to_audit_dict(tax_code)

        if data.name is not None:
            tax_code.name = data.name
        if data.rate is not None:
            tax_code.rate = data.rate
        if data.tax_type is not None:
            tax_code.tax_type = data.tax_type
        if data.hsn_chapter is not None:
            tax_code.hsn_chapter = data.hsn_chapter

        await self._repo.increment_version(db, tax_code)

        await audit_service.log(
            db,
            _ENTITY_TYPE,
            tax_code.id,
            AuditAction.MD_UPDATED,
            actor_id,
            org_id,
            old_values=old_snapshot,
            new_values=self._to_audit_dict(tax_code),
        )

        logger.info(
            "TaxCode updated",
            id=str(id),
            org_id=str(org_id),
            actor_id=str(actor_id),
        )
        return tax_code

    async def deactivate(
        self,
        db: AsyncSession,
        id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        """
        Soft-deactivate a TaxCode (sets is_active=False).

        Does NOT hard-delete. Idempotent: deactivating an already-inactive
        record is accepted without error.
        """
        tax_code = await self._repo.get(db, id, org_id)
        old_snapshot = self._to_audit_dict(tax_code)

        tax_code.is_active = False
        await self._repo.increment_version(db, tax_code)

        await audit_service.log(
            db,
            _ENTITY_TYPE,
            tax_code.id,
            AuditAction.DEACTIVATED,
            actor_id,
            org_id,
            old_values=old_snapshot,
            new_values=self._to_audit_dict(tax_code),
        )

        logger.info(
            "TaxCode deactivated",
            id=str(id),
            org_id=str(org_id),
            actor_id=str(actor_id),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _assert_code_unique(
        self,
        db: AsyncSession,
        code: str,
        org_id: UUID,
        exclude_id: Optional[UUID] = None,
    ) -> None:
        """Raise ConflictError if code already exists for this org."""
        existing = await self._repo.get_by_code_and_org(
            db, code, org_id, exclude_id=exclude_id
        )
        if existing is not None:
            raise ConflictError(
                f"A TaxCode with code '{code}' already exists for this organisation",
                {"code": code, "existing_id": str(existing.id)},
            )

    @staticmethod
    def _to_audit_dict(tax_code: TaxCode) -> dict:
        """Produce a JSON-serialisable snapshot of a TaxCode for audit logging."""
        return {
            "id": str(tax_code.id),
            "org_id": str(tax_code.org_id),
            "code": tax_code.code,
            "name": tax_code.name,
            "rate": str(tax_code.rate),
            "tax_type": tax_code.tax_type,
            "hsn_chapter": tax_code.hsn_chapter,
            "is_active": tax_code.is_active,
            "version": tax_code.version,
        }


# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

tax_code_repository = TaxCodeRepository()
tax_service = TaxService(repo=tax_code_repository)
