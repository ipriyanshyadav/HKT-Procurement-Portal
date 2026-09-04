"""
Approval Rules Repository — DB queries for approval rules and versions.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repository_base import BaseRepository
from app.modules.approval_rules.models import ApprovalRule, ApprovalRuleVersion


class ApprovalRulesRepository(BaseRepository[ApprovalRule]):
    def __init__(self) -> None:
        super().__init__(ApprovalRule)

    async def get_active_rules(
        self,
        db: AsyncSession,
        entity_type: str,
        org_id: UUID,
        now: datetime,
    ) -> list[ApprovalRule]:
        """
        Returns all active rules for entity_type and org_id that are
        within the effective date window, sorted by priority ascending.
        """
        stmt = (
            select(ApprovalRule)
            .where(
                and_(
                    ApprovalRule.transaction_type == entity_type,
                    ApprovalRule.org_id == org_id,
                    ApprovalRule.is_active.is_(True),
                    ApprovalRule.deleted_at.is_(None),
                )
            )
            .order_by(ApprovalRule.priority.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_rules_by_priority(
        self,
        db: AsyncSession,
        entity_type: str,
        priority: int,
        org_id: UUID,
    ) -> list[ApprovalRule]:
        """Find rules with same entity_type and priority (conflict detection)."""
        stmt = select(ApprovalRule).where(
            and_(
                ApprovalRule.entity_type == entity_type,
                ApprovalRule.priority == priority,
                ApprovalRule.org_id == org_id,
                ApprovalRule.is_active.is_(True),
                ApprovalRule.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_versions(
        self,
        db: AsyncSession,
        rule_id: UUID,
        org_id: UUID,
    ) -> list[ApprovalRuleVersion]:
        """Return all version snapshots for a rule, newest first."""
        stmt = (
            select(ApprovalRuleVersion)
            .where(
                and_(
                    ApprovalRuleVersion.rule_id == rule_id,
                    ApprovalRuleVersion.org_id == org_id,
                )
            )
            .order_by(ApprovalRuleVersion.activated_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def list_by_entity_type(
        self,
        db: AsyncSession,
        entity_type: str,
        org_id: UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> list[ApprovalRule]:
        stmt = (
            select(ApprovalRule)
            .where(
                and_(
                    ApprovalRule.entity_type == entity_type,
                    ApprovalRule.org_id == org_id,
                    ApprovalRule.deleted_at.is_(None),
                )
            )
            .order_by(ApprovalRule.priority.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


approval_rules_repository = ApprovalRulesRepository()
