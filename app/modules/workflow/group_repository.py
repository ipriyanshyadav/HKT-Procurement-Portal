"""
Approval Group Repository — get group by code, get members.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.repository_base import BaseRepository
from app.modules.user.models import User
from app.modules.workflow.models import ApprovalGroup, ApprovalGroupMember


class ApprovalGroupRepository(BaseRepository[ApprovalGroup]):
    def __init__(self) -> None:
        super().__init__(ApprovalGroup)

    async def get_by_code(
        self, db: AsyncSession, code: str, org_id: UUID
    ) -> ApprovalGroup:
        stmt = select(ApprovalGroup).where(
            and_(
                ApprovalGroup.code == code,
                ApprovalGroup.org_id == org_id,
                ApprovalGroup.is_active.is_(True),
                ApprovalGroup.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        group = result.scalar_one_or_none()
        if not group:
            raise NotFoundError(f"Approval group '{code}' not found")
        return group

    async def get_members(
        self, db: AsyncSession, group_id: UUID, org_id: UUID
    ) -> list[User]:
        stmt = (
            select(User)
            .join(
                ApprovalGroupMember,
                and_(
                    ApprovalGroupMember.user_id == User.id,
                    ApprovalGroupMember.approval_group_id == group_id,
                    ApprovalGroupMember.is_active.is_(True),
                ),
            )
            .where(
                and_(
                    User.org_id == org_id,
                    User.deleted_at.is_(None),
                )
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


approval_group_repository = ApprovalGroupRepository()
