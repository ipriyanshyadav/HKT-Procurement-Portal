"""
HolidayService — manages organisational and plant-level holiday calendars.

Invariants:
  - holiday_date must not be in the past at creation time.
  - (org_id, holiday_date, plant_id) must be unique among non-deleted records.
  - Deletion is always soft (sets deleted_at).
  - All mutating operations emit an audit log entry within the caller's transaction.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from loguru import logger
from sqlalchemy import and_, between, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.service import audit_service
from app.modules.master_data.holiday.repository import (
    HolidayRepository,
    holiday_repository,
)
from app.modules.master_data.holiday.schemas import HolidayCreateRequest
from app.modules.master_data.models import HolidayMaster


class HolidayService:
    """
    Application-layer service for HolidayMaster records.

    Responsibilities:
      - Enforce business invariants (past-date guard, uniqueness).
      - Delegate persistence to HolidayRepository.
      - Emit structured audit log entries; never commits the transaction itself.
    """

    def __init__(self, repo: HolidayRepository) -> None:
        self._repo = repo

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    async def list_by_year(
        self,
        db: AsyncSession,
        org_id: UUID,
        year: int,
    ) -> list[HolidayMaster]:
        """
        Return all non-deleted holidays for *org_id* whose holiday_date falls
        within the calendar year [Jan 1 ... Dec 31].
        """
        year_start = date(year, 1, 1)
        year_end = date(year, 12, 31)
        logger.debug(
            "Listing holidays by year",
            org_id=str(org_id),
            year=year,
        )
        return await self._repo.list_by_date_range(db, org_id, year_start, year_end)

    async def list_for_date_range(
        self,
        db: AsyncSession,
        org_id: UUID,
        start_date: date,
        end_date: date,
    ) -> list[HolidayMaster]:
        """
        Return all non-deleted holidays for *org_id* whose holiday_date is
        within [start_date ... end_date] inclusive.
        """
        logger.debug(
            "Listing holidays for date range",
            org_id=str(org_id),
            start_date=str(start_date),
            end_date=str(end_date),
        )
        return await self._repo.list_by_date_range(db, org_id, start_date, end_date)

    async def is_holiday(
        self,
        db: AsyncSession,
        org_id: UUID,
        check_date: date,
    ) -> bool:
        """
        Return True when *check_date* is a configured holiday for *org_id*
        (either org-wide or tied to any plant), False otherwise.
        """
        result = await self._repo.exists_for_date(db, org_id, check_date)
        logger.debug(
            "Holiday check",
            org_id=str(org_id),
            check_date=str(check_date),
            is_holiday=result,
        )
        return result

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------

    async def create(
        self,
        db: AsyncSession,
        data: HolidayCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> HolidayMaster:
        """
        Persist a new HolidayMaster record after validating business rules:

        1. holiday_date must not be in the past.
        2. No non-deleted record may share the same (org_id, holiday_date, plant_id).

        The caller's transaction is responsible for committing.
        """
        today = datetime.now(timezone.utc).date()
        if data.holiday_date < today:
            raise ValidationError(
                "PAST_DATE_NOT_ALLOWED",
                {"holiday_date": str(data.holiday_date), "today": str(today)},
            )

        duplicate = await self._repo.find_duplicate(
            db, org_id, data.holiday_date, data.plant_id
        )
        if duplicate:
            raise ConflictError(
                "A holiday already exists for this date and plant combination",
                {
                    "org_id": str(org_id),
                    "holiday_date": str(data.holiday_date),
                    "plant_id": str(data.plant_id) if data.plant_id else None,
                    "existing_id": str(duplicate.id),
                },
            )

        holiday = HolidayMaster(
            id=uuid4(),
            org_id=org_id,
            name=data.name,
            holiday_date=data.holiday_date,
            plant_id=data.plant_id,
            is_active=True,
        )
        db.add(holiday)
        # Flush so that holiday.id is available for the audit log before commit.
        await db.flush()

        await audit_service.log(
            db,
            entity_type="MASTER_DATA",
            entity_id=holiday.id,
            action="HOLIDAY_CREATED",
            actor_id=actor_id,
            org_id=org_id,
            new_values={
                "name": holiday.name,
                "holiday_date": str(holiday.holiday_date),
                "plant_id": str(holiday.plant_id) if holiday.plant_id else None,
            },
        )

        logger.info(
            "Holiday created",
            holiday_id=str(holiday.id),
            org_id=str(org_id),
            holiday_date=str(holiday.holiday_date),
            actor_id=str(actor_id),
        )
        return holiday

    async def delete(
        self,
        db: AsyncSession,
        id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> None:
        """
        Soft-delete the HolidayMaster identified by *id*.

        Raises NotFoundError when the record does not exist or is already deleted.
        The caller's transaction is responsible for committing.
        """
        holiday = await self._repo.get(db, id, org_id)

        old_values = {
            "name": holiday.name,
            "holiday_date": str(holiday.holiday_date),
            "plant_id": str(holiday.plant_id) if holiday.plant_id else None,
            "is_active": holiday.is_active,
        }

        await self._repo.soft_delete(db, id, org_id)

        await audit_service.log(
            db,
            entity_type="MASTER_DATA",
            entity_id=id,
            action="HOLIDAY_DELETED",
            actor_id=actor_id,
            org_id=org_id,
            old_values=old_values,
        )

        logger.info(
            "Holiday soft-deleted",
            holiday_id=str(id),
            org_id=str(org_id),
            actor_id=str(actor_id),
        )


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly in routers / other services
# ---------------------------------------------------------------------------

holiday_service = HolidayService(repo=holiday_repository)
