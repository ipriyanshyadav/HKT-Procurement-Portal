from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy import select, func, and_, or_, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import PRStatus
from app.modules.requisition.models import Requisition, RequisitionLine


class RequisitionRepository:

    async def get(self, db: AsyncSession, pr_id: UUID, org_id: UUID) -> Optional[Requisition]:
        stmt = (
            select(Requisition)
            .where(
                and_(
                    Requisition.id == pr_id,
                    Requisition.org_id == org_id,
                    Requisition.deleted_at.is_(None),
                )
            )
            .options(selectinload(Requisition.lines))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_lines(self, db: AsyncSession, pr_id: UUID, org_id: UUID) -> Optional[Requisition]:
        return await self.get(db, pr_id, org_id)

    async def find_by_number(self, db: AsyncSession, pr_number: str, org_id: UUID) -> Optional[Requisition]:
        stmt = (
            select(Requisition)
            .where(
                and_(
                    Requisition.pr_number == pr_number,
                    Requisition.org_id == org_id,
                    Requisition.deleted_at.is_(None),
                )
            )
            .options(selectinload(Requisition.lines))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, pr: Requisition) -> Requisition:
        db.add(pr)
        await db.flush()
        return pr

    async def update(self, db: AsyncSession, pr: Requisition) -> Requisition:
        pr.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return pr

    async def list(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: Optional[str] = None,
        business_unit_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        requestor_id: Optional[UUID] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Requisition], int]:
        filters = [Requisition.org_id == org_id, Requisition.deleted_at.is_(None)]

        if status:
            filters.append(Requisition.status == status)
        if business_unit_id:
            filters.append(Requisition.business_unit_id == business_unit_id)
        if category_id:
            filters.append(Requisition.category_id == category_id)
        if requestor_id:
            filters.append(Requisition.requestor_id == requestor_id)
        if search:
            search_pattern = f"%{search}%"
            filters.append(
                or_(
                    Requisition.pr_number.ilike(search_pattern),
                    Requisition.title.ilike(search_pattern),
                    Requisition.description.ilike(search_pattern),
                )
            )

        count_stmt = select(func.count(Requisition.id)).where(and_(*filters))
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one() or 0

        stmt = (
            select(Requisition)
            .where(and_(*filters))
            .order_by(desc(Requisition.created_at))
            .offset(skip)
            .limit(limit)
            .options(selectinload(Requisition.lines))
        )
        result = await db.execute(stmt)
        items = list(result.scalars().all())

        return items, total

    async def count_by_status(self, db: AsyncSession, org_id: UUID, status: str) -> int:
        stmt = select(func.count(Requisition.id)).where(
            and_(
                Requisition.org_id == org_id,
                Requisition.status == status,
                Requisition.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one() or 0

    async def get_lines(self, db: AsyncSession, pr_id: UUID, org_id: UUID) -> List[RequisitionLine]:
        stmt = (
            select(RequisitionLine)
            .where(
                and_(
                    RequisitionLine.requisition_id == pr_id,
                    RequisitionLine.org_id == org_id,
                    RequisitionLine.deleted_at.is_(None),
                )
            )
            .order_by(RequisitionLine.line_number)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def add_line(self, db: AsyncSession, line: RequisitionLine) -> RequisitionLine:
        db.add(line)
        await db.flush()
        return line

    async def delete_lines(self, db: AsyncSession, pr_id: UUID, org_id: UUID) -> None:
        stmt = (
            delete(RequisitionLine)
            .where(
                and_(
                    RequisitionLine.requisition_id == pr_id,
                    RequisitionLine.org_id == org_id,
                )
            )
        )
        await db.execute(stmt)
        await db.flush()

    async def get_pending_prs_older_than(
        self, db: AsyncSession, check_date: datetime, org_id: Optional[UUID] = None
    ) -> List[Requisition]:
        filters = [
            Requisition.status.in_([PRStatus.SUBMITTED.value, PRStatus.PENDING_APPROVAL.value]),
            Requisition.created_at <= check_date,
            Requisition.deleted_at.is_(None),
        ]
        if org_id:
            filters.append(Requisition.org_id == org_id)
        stmt = select(Requisition).where(and_(*filters)).order_by(Requisition.created_at)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_approved_not_in_sourcing(
        self, db: AsyncSession, org_id: Optional[UUID] = None
    ) -> List[Requisition]:
        filters = [
            Requisition.status == PRStatus.APPROVED.value,
            Requisition.approved_at.is_not(None),
            Requisition.deleted_at.is_(None),
        ]
        if org_id:
            filters.append(Requisition.org_id == org_id)
        stmt = select(Requisition).where(and_(*filters)).order_by(Requisition.approved_at)
        res = await db.execute(stmt)
        return list(res.scalars().all())


requisition_repository = RequisitionRepository()
