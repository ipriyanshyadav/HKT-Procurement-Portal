"""
PaymentTermsService — CRUD and lifecycle for PaymentTerm master data.

Validation rules (enforced here, not at schema level, so cross-field checks are
applied uniformly regardless of the call-site):
  - net_days: 0 – 365
  - discount_percentage: 0 – 100
  - discount_days < net_days when discount_percentage > 0
  - code is unique per org (ConflictError on duplicate)

All writes are un-committed; the caller's AsyncSession transaction owns the commit.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.service import audit_service
from app.modules.master_data.models import PaymentTerm
from app.modules.master_data.payment_terms.repository import (
    PaymentTermsRepository,
    payment_terms_repository,
)
from app.modules.master_data.payment_terms.schemas import (
    PaymentTermCreateRequest,
    PaymentTermUpdateRequest,
)

_ENTITY_TYPE = "MASTER_DATA"
_MAX_NET_DAYS = 365


class PaymentTermsService:
    """
    Application-layer service for PaymentTerm master data.

    Responsibilities:
      - Input validation (cross-field rules beyond Pydantic field constraints)
      - Code uniqueness enforcement per org
      - Persistence delegation to PaymentTermsRepository
      - Structured audit trail via AuditService
    """

    def __init__(self, repo: PaymentTermsRepository) -> None:
        self._repo = repo

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _validate_days_and_discount(
        self,
        net_days: int,
        discount_percentage: Decimal,
        discount_days: int,
    ) -> None:
        """
        Enforce cross-field business rules for payment term day/discount values.

        Raises ValidationError if any rule is violated.
        """
        if not (0 <= net_days <= _MAX_NET_DAYS):
            raise ValidationError(
                f"net_days must be between 0 and {_MAX_NET_DAYS}",
                {"net_days": net_days, "max_allowed": _MAX_NET_DAYS},
            )

        if not (Decimal("0") <= discount_percentage <= Decimal("100")):
            raise ValidationError(
                "discount_percentage must be between 0 and 100",
                {"discount_percentage": str(discount_percentage)},
            )

        if discount_percentage > Decimal("0") and discount_days >= net_days:
            raise ValidationError(
                "discount_days must be strictly less than net_days when a discount is offered",
                {
                    "discount_days": discount_days,
                    "net_days": net_days,
                    "discount_percentage": str(discount_percentage),
                },
            )

    async def _assert_code_unique(
        self,
        db: AsyncSession,
        code: str,
        org_id: UUID,
        exclude_id: Optional[UUID] = None,
    ) -> None:
        """Raise ConflictError if the given code already exists for the org."""
        existing = await self._repo.get_by_code(db, code, org_id, exclude_id=exclude_id)
        if existing is not None:
            raise ConflictError(
                f"Payment term with code '{code}' already exists for this organisation",
                {"code": code, "org_id": str(org_id)},
            )

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    async def list_all(
        self,
        db: AsyncSession,
        org_id: UUID,
        active_only: bool = True,
    ) -> list[PaymentTerm]:
        """
        Return all payment terms for the given org.

        Args:
            db: Active async DB session.
            org_id: Organisation scoping key.
            active_only: When True (default), only is_active=True records are returned.

        Returns:
            List of PaymentTerm ORM instances ordered by code ascending.
        """
        terms = await self._repo.get_all(db, org_id, active_only=active_only)
        logger.debug(
            "PaymentTerms listed",
            org_id=str(org_id),
            active_only=active_only,
            count=len(terms),
        )
        return terms

    async def get_by_id(
        self,
        db: AsyncSession,
        id: UUID,
        org_id: UUID,
    ) -> PaymentTerm:
        """
        Fetch a single payment term by primary key, scoped to the org.

        Raises:
            NotFoundError: if no live record exists for the given id + org_id.
        """
        term = await self._repo.get(db, id, org_id)
        logger.debug(
            "PaymentTerm fetched",
            payment_term_id=str(id),
            org_id=str(org_id),
        )
        return term

    async def create(
        self,
        db: AsyncSession,
        data: PaymentTermCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> PaymentTerm:
        """
        Create a new payment term for the org.

        Validates cross-field rules, enforces code uniqueness, persists the record,
        and writes an MD_CREATED audit log entry.

        Raises:
            ValidationError: if net_days / discount rules are violated.
            ConflictError: if the code already exists for the org.
        """
        self._validate_days_and_discount(
            net_days=data.net_days,
            discount_percentage=data.discount_percentage,
            discount_days=data.discount_days,
        )
        await self._assert_code_unique(db, data.code.upper(), org_id)

        term = PaymentTerm(
            org_id=org_id,
            code=data.code.upper(),
            name=data.name,
            net_days=data.net_days,
            discount_percentage=data.discount_percentage,
            discount_days=data.discount_days,
            description=data.description,
            is_active=True,
        )
        db.add(term)
        await db.flush()

        await audit_service.log(
            db,
            entity_type=_ENTITY_TYPE,
            entity_id=term.id,
            action=AuditAction.MD_CREATED,
            actor_id=actor_id,
            org_id=org_id,
            new_values={
                "code": term.code,
                "name": term.name,
                "net_days": term.net_days,
                "discount_percentage": str(term.discount_percentage),
                "discount_days": term.discount_days,
                "description": term.description,
            },
        )

        logger.info(
            "PaymentTerm created",
            payment_term_id=str(term.id),
            code=term.code,
            org_id=str(org_id),
            actor_id=str(actor_id),
        )
        return term

    async def update(
        self,
        db: AsyncSession,
        id: UUID,
        data: PaymentTermUpdateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> PaymentTerm:
        """
        Partially update an existing payment term.

        Only supplied (non-None) fields are applied. Cross-field validation is
        executed against the merged (old + new) values so partial updates never
        silently produce an invalid state.

        Raises:
            NotFoundError: if the term does not exist for this org.
            ValidationError: if merged values violate business rules.
            ConflictError: if the new code collides with another term in the org.
        """
        term = await self._repo.get(db, id, org_id)

        old_values = {
            "code": term.code,
            "name": term.name,
            "net_days": term.net_days,
            "discount_percentage": str(term.discount_percentage),
            "discount_days": term.discount_days,
            "description": term.description,
        }

        # Resolve effective values (patch semantics: None means keep current)
        effective_net_days = data.net_days if data.net_days is not None else term.net_days
        effective_discount_pct = (
            data.discount_percentage
            if data.discount_percentage is not None
            else term.discount_percentage
        )
        effective_discount_days = (
            data.discount_days if data.discount_days is not None else term.discount_days
        )

        self._validate_days_and_discount(
            net_days=effective_net_days,
            discount_percentage=effective_discount_pct,
            discount_days=effective_discount_days,
        )

        if data.name is not None:
            term.name = data.name
        if data.net_days is not None:
            term.net_days = data.net_days
        if data.discount_percentage is not None:
            term.discount_percentage = data.discount_percentage
        if data.discount_days is not None:
            term.discount_days = data.discount_days
        if data.description is not None:
            term.description = data.description

        term.version += 1

        new_values = {
            "code": term.code,
            "name": term.name,
            "net_days": term.net_days,
            "discount_percentage": str(term.discount_percentage),
            "discount_days": term.discount_days,
            "description": term.description,
        }

        await audit_service.log(
            db,
            entity_type=_ENTITY_TYPE,
            entity_id=term.id,
            action=AuditAction.MD_UPDATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values=old_values,
            new_values=new_values,
        )

        logger.info(
            "PaymentTerm updated",
            payment_term_id=str(id),
            org_id=str(org_id),
            actor_id=str(actor_id),
        )
        return term

    async def deactivate(
        self,
        db: AsyncSession,
        id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        """
        Soft-deactivate a payment term (sets is_active=False).

        The record is NOT deleted; it remains visible to queries that pass
        active_only=False. Idempotent: deactivating an already-inactive term
        writes an audit log but performs no error.

        Raises:
            NotFoundError: if the term does not exist for this org.
        """
        term = await self._repo.get(db, id, org_id)

        term.is_active = False
        term.version += 1

        await audit_service.log(
            db,
            entity_type=_ENTITY_TYPE,
            entity_id=term.id,
            action=AuditAction.DEACTIVATED,
            actor_id=actor_id,
            org_id=org_id,
            old_values={"is_active": True},
            new_values={"is_active": False},
            metadata={"code": term.code, "name": term.name},
        )

        logger.info(
            "PaymentTerm deactivated",
            payment_term_id=str(id),
            code=term.code,
            org_id=str(org_id),
            actor_id=str(actor_id),
        )


payment_terms_service = PaymentTermsService(repo=payment_terms_repository)
