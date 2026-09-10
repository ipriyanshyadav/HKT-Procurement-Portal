"""
Contract Repository (SPEC_13 S13-01 to S13-17).

Provides data access for contracts, contract_lines, contract_milestones,
contract_amendments, and contract_templates.
Follows clean layer discipline: router -> service -> repository -> model.
"""
from __future__ import annotations

import builtins
from datetime import date
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.contract.models import (
    Contract,
    ContractAmendment,
    ContractLine,
    ContractMilestone,
    ContractTemplate,
)


class ContractRepository:
    """Repository for contract management domain models."""

    async def get(
        self,
        db: AsyncSession,
        contract_id: UUID,
        org_id: UUID,
    ) -> Contract | None:
        stmt = (
            select(Contract)
            .where(
                and_(
                    Contract.id == contract_id,
                    Contract.org_id == org_id,
                    Contract.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(Contract.lines),
                selectinload(Contract.milestones),
                selectinload(Contract.amendments),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_number(
        self,
        db: AsyncSession,
        contract_number: str,
        org_id: UUID,
    ) -> Contract | None:
        stmt = select(Contract).where(
            and_(
                Contract.contract_number == contract_number,
                Contract.org_id == org_id,
                Contract.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: str | None = None,
        vendor_id: UUID | None = None,
        category_id: UUID | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[builtins.list[Contract], int]:
        filters = [
            Contract.org_id == org_id,
            Contract.deleted_at.is_(None),
        ]

        if status:
            filters.append(Contract.status == status)
        if vendor_id:
            filters.append(Contract.vendor_id == vendor_id)
        if category_id:
            filters.append(Contract.category_id == category_id)
        if search:
            search_pattern = f"%{search.strip()}%"
            filters.append(
                or_(
                    Contract.contract_number.ilike(search_pattern),
                    Contract.title.ilike(search_pattern),
                )
            )

        count_stmt = select(func.count(Contract.id)).where(and_(*filters))
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one() or 0

        offset = max(0, (page - 1) * page_size)
        stmt = (
            select(Contract)
            .where(and_(*filters))
            .options(
                selectinload(Contract.lines),
                selectinload(Contract.milestones),
                selectinload(Contract.amendments),
            )
            .order_by(Contract.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        res = await db.execute(stmt)
        items = list(res.scalars().all())
        return items, total

    async def create(self, db: AsyncSession, contract: Contract) -> Contract:
        db.add(contract)
        await db.flush()
        return contract

    async def update(self, db: AsyncSession, contract: Contract) -> Contract:
        await db.flush()
        return contract

    async def get_expiring_on(
        self,
        db: AsyncSession,
        check_date: date,
        org_id: UUID | None = None,
    ) -> builtins.list[Contract]:
        filters = [
            Contract.end_date == check_date,
            Contract.status == "ACTIVE",
            Contract.deleted_at.is_(None),
        ]
        if org_id:
            filters.append(Contract.org_id == org_id)

        stmt = select(Contract).where(and_(*filters))
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_active_rate_contracts(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        org_id: UUID,
    ) -> builtins.list[Contract]:
        stmt = (
            select(Contract)
            .where(
                and_(
                    Contract.org_id == org_id,
                    Contract.vendor_id == vendor_id,
                    Contract.contract_type == "RATE_CONTRACT",
                    Contract.status == "ACTIVE",
                    Contract.deleted_at.is_(None),
                )
            )
            .options(selectinload(Contract.lines))
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    # --- Lines / Rate Card ---
    async def create_line(self, db: AsyncSession, line: ContractLine) -> ContractLine:
        db.add(line)
        await db.flush()
        return line

    async def get_line(
        self,
        db: AsyncSession,
        line_id: UUID,
        contract_id: UUID,
        org_id: UUID,
    ) -> ContractLine | None:
        stmt = select(ContractLine).where(
            and_(
                ContractLine.id == line_id,
                ContractLine.contract_id == contract_id,
                ContractLine.org_id == org_id,
                ContractLine.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def delete_line(self, db: AsyncSession, line: ContractLine) -> None:
        await db.delete(line)
        await db.flush()

    # --- Milestones ---
    async def create_milestone(
        self,
        db: AsyncSession,
        milestone: ContractMilestone,
    ) -> ContractMilestone:
        db.add(milestone)
        await db.flush()
        return milestone

    async def get_milestone(
        self,
        db: AsyncSession,
        milestone_id: UUID,
        contract_id: UUID,
        org_id: UUID,
    ) -> ContractMilestone | None:
        stmt = select(ContractMilestone).where(
            and_(
                ContractMilestone.id == milestone_id,
                ContractMilestone.contract_id == contract_id,
                ContractMilestone.org_id == org_id,
                ContractMilestone.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_milestone_by_id(
        self,
        db: AsyncSession,
        milestone_id: UUID,
        org_id: UUID | None = None,
    ) -> ContractMilestone | None:
        filters = [
            ContractMilestone.id == milestone_id,
            ContractMilestone.deleted_at.is_(None),
        ]
        if org_id:
            filters.append(ContractMilestone.org_id == org_id)
        stmt = select(ContractMilestone).where(and_(*filters))
        res = await db.execute(stmt)
        return res.scalar_one_or_none()


    async def get_milestones(
        self,
        db: AsyncSession,
        contract_id: UUID,
        org_id: UUID,
    ) -> builtins.list[ContractMilestone]:
        stmt = (
            select(ContractMilestone)
            .where(
                and_(
                    ContractMilestone.contract_id == contract_id,
                    ContractMilestone.org_id == org_id,
                    ContractMilestone.deleted_at.is_(None),
                )
            )
            .order_by(ContractMilestone.due_date.asc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_pending_milestones_due_on_or_before(
        self,
        db: AsyncSession,
        due_date: date,
    ) -> builtins.list[ContractMilestone]:
        stmt = select(ContractMilestone).where(
            and_(
                ContractMilestone.due_date <= due_date,
                ContractMilestone.status == "PENDING",
                ContractMilestone.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    # --- Amendments ---
    async def create_amendment(
        self,
        db: AsyncSession,
        amendment: ContractAmendment,
    ) -> ContractAmendment:
        db.add(amendment)
        await db.flush()
        return amendment

    async def get_amendments(
        self,
        db: AsyncSession,
        contract_id: UUID,
        org_id: UUID,
    ) -> builtins.list[ContractAmendment]:
        stmt = (
            select(ContractAmendment)
            .where(
                and_(
                    ContractAmendment.contract_id == contract_id,
                    ContractAmendment.org_id == org_id,
                )
            )
            .order_by(ContractAmendment.amendment_number.asc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    # --- Templates ---
    async def get_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        org_id: UUID,
    ) -> ContractTemplate | None:
        stmt = select(ContractTemplate).where(
            and_(
                ContractTemplate.id == template_id,
                ContractTemplate.org_id == org_id,
                ContractTemplate.is_active.is_(True),
                ContractTemplate.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_templates(
        self,
        db: AsyncSession,
        org_id: UUID,
        contract_type: str | None = None,
    ) -> builtins.list[ContractTemplate]:
        filters = [
            ContractTemplate.org_id == org_id,
            ContractTemplate.is_active.is_(True),
            ContractTemplate.deleted_at.is_(None),
        ]
        if contract_type:
            filters.append(ContractTemplate.contract_type == contract_type)
        stmt = select(ContractTemplate).where(and_(*filters)).order_by(ContractTemplate.name.asc())
        res = await db.execute(stmt)
        return list(res.scalars().all())

    # --- Sequences / Counters ---
    async def get_next_contract_sequence(
        self,
        db: AsyncSession,
        org_id: UUID,
        year: int,
    ) -> int:
        pattern = f"CNT-{year}-%"
        stmt = select(func.count(Contract.id)).where(
            and_(
                Contract.org_id == org_id,
                Contract.contract_number.like(pattern),
            )
        )
        res = await db.execute(stmt)
        cnt = res.scalar_one() or 0
        return cnt + 1


contract_repository = ContractRepository()
