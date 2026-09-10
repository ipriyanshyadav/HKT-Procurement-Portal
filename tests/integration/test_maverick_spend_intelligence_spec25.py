from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.modules.analytics.service import analytics_service
from app.modules.organization.models import Organization


@pytest.fixture
async def db_session():
    test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_maverick_spend_cluster_detection_and_triage(db_session: AsyncSession):
    # 1. Setup isolated organization
    org_id = uuid4()
    org = Organization(
        id=org_id,
        name=f"Maverick Test Org {uuid4().hex[:6]}",
        legal_name=f"Maverick Test Org Legal {uuid4().hex[:6]}",
    )
    db_session.add(org)
    await db_session.commit()

    # 2. Run real-time anomaly detection scan
    detection_result = await analytics_service.detect_maverick_clusters(db_session, org_id)

    assert detection_result["total_clusters"] > 0
    assert detection_result["total_leaked_spend"] > 0
    assert detection_result["projected_savings_recovery"] > 0
    assert len(detection_result["clusters"]) >= 4

    cluster_types = {c["cluster_type"] for c in detection_result["clusters"]}
    assert "RETROACTIVE_PO" in cluster_types
    assert "SPLIT_PURCHASE_ORDER" in cluster_types
    assert "OFF_CONTRACT_LEAKAGE" in cluster_types
    assert "PRICE_VARIANCE_DISPERSION" in cluster_types

    # 3. Query clusters via service filter
    clusters_data = await analytics_service.get_maverick_clusters(db_session, org_id, status="DETECTED")
    assert clusters_data["total_clusters"] >= 4

    target_cluster = clusters_data["clusters"][0]
    cluster_id = target_cluster["id"]

    # 4. Triage status update: DETECTED -> INVESTIGATING
    update_res = await analytics_service.update_maverick_cluster_status(
        db_session, cluster_id=cluster_id, org_id=org_id, status="INVESTIGATING"
    )
    assert update_res["status"] == "INVESTIGATING"

    # 5. Verify query filtering by status
    investigating_clusters = await analytics_service.get_maverick_clusters(
        db_session, org_id=org_id, status="INVESTIGATING"
    )
    assert investigating_clusters["total_clusters"] == 1
    assert investigating_clusters["clusters"][0]["id"] == cluster_id

    # 6. Resolve cluster: INVESTIGATING -> RESOLVED
    resolved_res = await analytics_service.update_maverick_cluster_status(
        db_session, cluster_id=cluster_id, org_id=org_id, status="RESOLVED"
    )
    assert resolved_res["status"] == "RESOLVED"
