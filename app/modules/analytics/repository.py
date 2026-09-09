from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.analytics.models import MaverickSpendCluster


class AnalyticsRepository:
    """Repository handling persistence and queries for Maverick Spend Clusters."""

    async def list_maverick_clusters(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: str | None = None,
        cluster_type: str | None = None,
        limit: int = 100,
    ) -> list[MaverickSpendCluster]:
        filters = [
            MaverickSpendCluster.org_id == org_id,
            MaverickSpendCluster.deleted_at.is_(None),
        ]
        if status:
            filters.append(MaverickSpendCluster.status == status)
        if cluster_type:
            filters.append(MaverickSpendCluster.cluster_type == cluster_type)

        stmt = (
            select(MaverickSpendCluster)
            .where(and_(*filters))
            .order_by(desc(MaverickSpendCluster.affected_spend), desc(MaverickSpendCluster.created_at))
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_maverick_cluster_by_id(
        self,
        db: AsyncSession,
        cluster_id: UUID,
        org_id: UUID,
    ) -> MaverickSpendCluster | None:
        stmt = select(MaverickSpendCluster).where(
            and_(
                MaverickSpendCluster.id == cluster_id,
                MaverickSpendCluster.org_id == org_id,
                MaverickSpendCluster.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_maverick_cluster(
        self,
        db: AsyncSession,
        org_id: UUID,
        cluster_type: str,
        cluster_title: str,
        severity: str,
        affected_spend: float,
        potential_savings: float,
        affected_entity_ids: list[Any],
        root_cause_analysis: str,
        ai_recommendation: str,
        status: str = "DETECTED",
    ) -> MaverickSpendCluster:
        cluster = MaverickSpendCluster(
            org_id=org_id,
            cluster_type=cluster_type,
            cluster_title=cluster_title,
            severity=severity,
            affected_spend=affected_spend,
            potential_savings=potential_savings,
            affected_entity_ids=affected_entity_ids,
            root_cause_analysis=root_cause_analysis,
            ai_recommendation=ai_recommendation,
            status=status,
        )
        db.add(cluster)
        await db.flush()
        return cluster

    async def update_cluster_status(
        self,
        db: AsyncSession,
        cluster_id: UUID,
        org_id: UUID,
        status: str,
    ) -> MaverickSpendCluster | None:
        cluster = await self.get_maverick_cluster_by_id(db, cluster_id, org_id)
        if not cluster:
            return None
        cluster.status = status
        await db.flush()
        return cluster


analytics_repository = AnalyticsRepository()
