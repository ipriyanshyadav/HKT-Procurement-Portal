from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.repository_base import BaseRepository
from app.modules.compliance.models import ComplianceFinding, CompliancePolicy, ComplianceScan


class CompliancePolicyRepository(BaseRepository[CompliancePolicy]):
    def __init__(self) -> None:
        super().__init__(CompliancePolicy)

    async def get_by_id(self, db: AsyncSession, policy_id: UUID, org_id: UUID) -> CompliancePolicy | None:
        stmt = select(CompliancePolicy).where(
            CompliancePolicy.id == policy_id, CompliancePolicy.org_id == org_id
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_code(self, db: AsyncSession, org_id: UUID, code: str) -> CompliancePolicy | None:
        stmt = select(CompliancePolicy).where(
            CompliancePolicy.org_id == org_id, CompliancePolicy.code == code
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_by_org(self, db: AsyncSession, org_id: UUID) -> list[CompliancePolicy]:
        stmt = (
            select(CompliancePolicy)
            .where(CompliancePolicy.org_id == org_id)
            .order_by(CompliancePolicy.framework.asc(), CompliancePolicy.code.asc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


class ComplianceScanRepository(BaseRepository[ComplianceScan]):
    def __init__(self) -> None:
        super().__init__(ComplianceScan)

    async def get_latest(self, db: AsyncSession, org_id: UUID) -> ComplianceScan | None:
        stmt = (
            select(ComplianceScan)
            .options(selectinload(ComplianceScan.findings))
            .where(ComplianceScan.org_id == org_id)
            .order_by(desc(ComplianceScan.created_at))
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_id(self, db: AsyncSession, scan_id: UUID, org_id: UUID) -> ComplianceScan | None:
        stmt = (
            select(ComplianceScan)
            .options(selectinload(ComplianceScan.findings))
            .where(ComplianceScan.id == scan_id, ComplianceScan.org_id == org_id)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_by_org(self, db: AsyncSession, org_id: UUID, limit: int = 20) -> list[ComplianceScan]:
        stmt = (
            select(ComplianceScan)
            .where(ComplianceScan.org_id == org_id)
            .order_by(desc(ComplianceScan.created_at))
            .limit(limit)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


class ComplianceFindingRepository(BaseRepository[ComplianceFinding]):
    def __init__(self) -> None:
        super().__init__(ComplianceFinding)

    async def list_by_scan(self, db: AsyncSession, scan_id: UUID) -> list[ComplianceFinding]:
        stmt = (
            select(ComplianceFinding)
            .where(ComplianceFinding.scan_id == scan_id)
            .order_by(desc(ComplianceFinding.score.desc()), ComplianceFinding.created_at.asc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


compliance_policy_repository = CompliancePolicyRepository()
compliance_scan_repository = ComplianceScanRepository()
compliance_finding_repository = ComplianceFindingRepository()
