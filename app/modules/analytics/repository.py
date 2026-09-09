from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.analytics.models import (
    CarbonEmissionFactor,
    MaverickSpendCluster,
    SupplierESGMetric,
)


class AnalyticsRepository:
    """Repository handling persistence and queries for Maverick Spend Clusters and Carbon ESG."""

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
            affected_spend=Decimal(str(affected_spend)),
            potential_savings=Decimal(str(potential_savings)),
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

    # -----------------------------------------------------------------------
    # Carbon Emission Factors
    # -----------------------------------------------------------------------

    async def list_emission_factors(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> list[CarbonEmissionFactor]:
        stmt = select(CarbonEmissionFactor).where(
            and_(
                CarbonEmissionFactor.org_id == org_id,
                CarbonEmissionFactor.deleted_at.is_(None),
            )
        ).order_by(CarbonEmissionFactor.category_name)
        result = await db.execute(stmt)
        factors = list(result.scalars().all())
        if not factors:
            factors = await self.seed_default_emission_factors(db, org_id)
        return factors

    async def seed_default_emission_factors(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> list[CarbonEmissionFactor]:
        defaults = [
            ("IT & Electronics", 0.0400, 0.1000, 0.5800),
            ("Raw Materials & Metals", 0.1500, 0.2500, 1.2000),
            ("Logistics & Freight", 0.2800, 0.0800, 0.8500),
            ("Facilities & Real Estate", 0.0800, 0.2200, 0.4500),
            ("Professional & Legal Services", 0.0100, 0.0300, 0.1200),
            ("MRO & Industrial Supplies", 0.0900, 0.1600, 0.7200),
            ("Packaging & Paper", 0.1200, 0.1800, 0.8000),
            ("Chemicals & Polymers", 0.2000, 0.3000, 1.4500),
        ]
        created = []
        for name, s1, s2, s3 in defaults:
            factor = CarbonEmissionFactor(
                id=uuid4(),
                org_id=org_id,
                category_name=name,
                scope1_factor=Decimal(str(s1)),
                scope2_factor=Decimal(str(s2)),
                scope3_factor=Decimal(str(s3)),
                currency="INR",
                data_source="GHG_PROTOCOL_DEFRA_2026",
                effective_year=2026,
            )
            db.add(factor)
            created.append(factor)
        await db.flush()
        return created

    async def create_or_update_emission_factor(
        self,
        db: AsyncSession,
        org_id: UUID,
        category_name: str,
        scope1_factor: float,
        scope2_factor: float,
        scope3_factor: float,
        category_id: UUID | None = None,
        currency: str = "INR",
        data_source: str = "GHG_PROTOCOL_DEFRA_2026",
        effective_year: int = 2026,
    ) -> CarbonEmissionFactor:
        stmt = select(CarbonEmissionFactor).where(
            and_(
                CarbonEmissionFactor.org_id == org_id,
                CarbonEmissionFactor.category_name == category_name,
                CarbonEmissionFactor.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            existing.scope1_factor = Decimal(str(scope1_factor))
            existing.scope2_factor = Decimal(str(scope2_factor))
            existing.scope3_factor = Decimal(str(scope3_factor))
            existing.currency = currency
            existing.data_source = data_source
            existing.effective_year = effective_year
            if category_id:
                existing.category_id = category_id
            await db.flush()
            return existing

        factor = CarbonEmissionFactor(
            id=uuid4(),
            org_id=org_id,
            category_id=category_id,
            category_name=category_name,
            scope1_factor=Decimal(str(scope1_factor)),
            scope2_factor=Decimal(str(scope2_factor)),
            scope3_factor=Decimal(str(scope3_factor)),
            currency=currency,
            data_source=data_source,
            effective_year=effective_year,
        )
        db.add(factor)
        await db.flush()
        return factor

    # -----------------------------------------------------------------------
    # Supplier ESG Metrics
    # -----------------------------------------------------------------------

    async def list_supplier_esg_metrics(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> list[SupplierESGMetric]:
        stmt = select(SupplierESGMetric).where(
            and_(
                SupplierESGMetric.org_id == org_id,
                SupplierESGMetric.deleted_at.is_(None),
            )
        ).order_by(desc(SupplierESGMetric.composite_esg_score))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_supplier_esg_metric(
        self,
        db: AsyncSession,
        vendor_id: UUID,
        org_id: UUID,
    ) -> SupplierESGMetric | None:
        stmt = select(SupplierESGMetric).where(
            and_(
                SupplierESGMetric.vendor_id == vendor_id,
                SupplierESGMetric.org_id == org_id,
                SupplierESGMetric.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def upsert_supplier_esg_metric(
        self,
        db: AsyncSession,
        org_id: UUID,
        vendor_id: UUID,
        environmental_score: float = 70.0,
        social_score: float = 75.0,
        governance_score: float = 80.0,
        esg_rating: str | None = None,
        carbon_intensity_kg_per_spend: float = 0.4500,
        sbti_committed: bool = False,
        net_zero_target_year: int | None = None,
        iso_14001_certified: bool = False,
        renewable_energy_pct: float = 0.0,
        audit_notes: str | None = None,
    ) -> SupplierESGMetric:
        metric = await self.get_supplier_esg_metric(db, vendor_id, org_id)
        composite = round((environmental_score * 0.4) + (social_score * 0.3) + (governance_score * 0.3), 2)
        
        if not esg_rating:
            if composite >= 90:
                calc_rating = "AAA"
            elif composite >= 80:
                calc_rating = "AA"
            elif composite >= 70:
                calc_rating = "A"
            elif composite >= 60:
                calc_rating = "BBB"
            elif composite >= 50:
                calc_rating = "BB"
            elif composite >= 40:
                calc_rating = "B"
            else:
                calc_rating = "CCC"
        else:
            calc_rating = esg_rating

        if metric:
            metric.environmental_score = Decimal(str(environmental_score))
            metric.social_score = Decimal(str(social_score))
            metric.governance_score = Decimal(str(governance_score))
            metric.composite_esg_score = Decimal(str(composite))
            metric.esg_rating = calc_rating
            metric.carbon_intensity_kg_per_spend = Decimal(str(carbon_intensity_kg_per_spend))
            metric.sbti_committed = sbti_committed
            metric.net_zero_target_year = net_zero_target_year
            metric.iso_14001_certified = iso_14001_certified
            metric.renewable_energy_pct = Decimal(str(renewable_energy_pct))
            metric.last_audit_date = datetime.now(timezone.utc)
            if audit_notes:
                metric.audit_notes = audit_notes
            await db.flush()
            return metric

        metric = SupplierESGMetric(
            id=uuid4(),
            org_id=org_id,
            vendor_id=vendor_id,
            environmental_score=Decimal(str(environmental_score)),
            social_score=Decimal(str(social_score)),
            governance_score=Decimal(str(governance_score)),
            composite_esg_score=Decimal(str(composite)),
            esg_rating=calc_rating,
            carbon_intensity_kg_per_spend=Decimal(str(carbon_intensity_kg_per_spend)),
            sbti_committed=sbti_committed,
            net_zero_target_year=net_zero_target_year,
            iso_14001_certified=iso_14001_certified,
            renewable_energy_pct=Decimal(str(renewable_energy_pct)),
            last_audit_date=datetime.now(timezone.utc),
            audit_notes=audit_notes,
        )
        db.add(metric)
        await db.flush()
        return metric

    async def get_po_spend_by_category(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> list[dict[str, Any]]:
        stmt = text("""
            SELECT 
                c.name as category_name,
                COALESCE(SUM(po.total_value), 0) as total_spend,
                COUNT(po.id) as po_count
            FROM purchase_orders po
            LEFT JOIN categories c ON c.id = po.category_id
            WHERE po.org_id = :org_id
              AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
              AND po.deleted_at IS NULL
            GROUP BY c.name
            ORDER BY total_spend DESC
        """)
        res = await db.execute(stmt, {"org_id": org_id})
        rows = res.mappings().all()
        return [dict(r) for r in rows]

    async def get_po_spend_by_vendor(
        self,
        db: AsyncSession,
        org_id: UUID,
    ) -> list[dict[str, Any]]:
        stmt = text("""
            SELECT 
                v.id as vendor_id,
                v.company_name as vendor_name,
                COALESCE(SUM(po.total_value), 0) as total_spend,
                COUNT(po.id) as po_count
            FROM purchase_orders po
            JOIN vendors v ON v.id = po.vendor_id
            WHERE po.org_id = :org_id
              AND po.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED', 'VENDOR_REJECTED', 'REJECTED_BY_SUPPLIER')
              AND po.deleted_at IS NULL
            GROUP BY v.id, v.company_name
            ORDER BY total_spend DESC
        """)
        res = await db.execute(stmt, {"org_id": org_id})
        rows = res.mappings().all()
        return [dict(r) for r in rows]


analytics_repository = AnalyticsRepository()

