from __future__ import annotations
from datetime import date
from typing import Optional
from uuid import UUID
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.repository_base import BaseRepository
from app.modules.master_data.models import HolidayMaster


class HolidayRepository(BaseRepository[HolidayMaster]):
    def __init__(self) -> None:
        super().__init__(HolidayMaster)

    async def list_by_date_range(
        self,
        db: AsyncSession,
        org_id: UUID,
        start_date: date,
        end_date: date,
    ) -> list[HolidayMaster]:
        stmt = (
            select(HolidayMaster)
            .where(
                HolidayMaster.org_id == org_id,
                HolidayMaster.deleted_at.is_(None),
                HolidayMaster.holiday_date >= start_date,
                HolidayMaster.holiday_date <= end_date,
            )
            .order_by(HolidayMaster.holiday_date.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def exists_for_date(
        self,
        db: AsyncSession,
        org_id: UUID,
        check_date: date,
    ) -> bool:
        stmt = select(HolidayMaster).where(
            HolidayMaster.org_id == org_id,
            HolidayMaster.deleted_at.is_(None),
            HolidayMaster.holiday_date == check_date,
            HolidayMaster.is_active.is_(True),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def find_duplicate(
        self,
        db: AsyncSession,
        org_id: UUID,
        holiday_date: date,
        plant_id: Optional[UUID] = None,
    ) -> Optional[HolidayMaster]:
        conditions = [
            HolidayMaster.org_id == org_id,
            HolidayMaster.deleted_at.is_(None),
            HolidayMaster.holiday_date == holiday_date,
        ]
        if plant_id is not None:
            conditions.append(HolidayMaster.plant_id == plant_id)
        else:
            conditions.append(HolidayMaster.plant_id.is_(None))

        stmt = select(HolidayMaster).where(and_(*conditions))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


holiday_repository = HolidayRepository()
