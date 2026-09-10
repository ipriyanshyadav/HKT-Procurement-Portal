"""Integration tests for SPEC_21/SPEC_22 Disaster Recovery Orchestrator & PITR Backup Drills.

Tests:
1. Posture metrics baseline, checkpoint creation, and on-demand PITR WAL snapshots.
2. Cryptographic checksum verification and WORM object-lock auditing.
3. Automated failover drill simulation with RPO/RTO compliance benchmarking.
"""
from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.modules.disaster_recovery.schemas import (
    DRCheckpointCreateRequest,
    RunFailoverDrillRequest,
    TriggerPITRSnapshotRequest,
)
from app.modules.disaster_recovery.service import dr_service

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def setup_dr_fixtures(db: AsyncSession, org_id):
    admin_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, :name, :legal_name, 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'DR', 'Admin', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": admin_id, "org_id": org_id, "email": f"dr-admin-{admin_id.hex[:6]}@enterprise.com"},
    )
    await db.commit()
    return {"admin_id": admin_id}


@pytest.mark.asyncio
async def test_dr_posture_and_checkpoint_creation():
    async with TestSession() as db:
        org_id = uuid4()
        await setup_dr_fixtures(db, org_id)

        # 1. Check initial posture
        initial_posture = await dr_service.get_dr_posture(db, org_id)
        assert initial_posture.target_rpo_minutes == 60
        assert initial_posture.target_rto_minutes == 240
        assert initial_posture.secondary_cluster_status == "WARM_STANDBY_READY"
        assert initial_posture.dr_readiness_status in ["HEALTHY", "WARNING", "CRITICAL"]

        # 2. Create manual backup checkpoint
        cp_request = DRCheckpointCreateRequest(
            checkpoint_type="POSTGRES_PITR_WAL",
            storage_tier="HOT_STANDBY",
            storage_location="s3://procurement-dr-pitr/wal-archive/00000001000000000000005F.lz4",
            wal_start_lsn="0/5F000000",
            wal_end_lsn="0/5F000020",
            size_bytes=16_777_216,
            worm_locked=True,
        )
        cp = await dr_service.create_checkpoint(db, org_id, cp_request)
        await db.commit()

        assert cp.id is not None
        assert cp.org_id == org_id
        assert cp.checkpoint_type == "POSTGRES_PITR_WAL"
        assert cp.worm_locked is True
        assert cp.size_bytes == 16_777_216
        assert len(cp.checksum_sha256) == 64

        # 3. Trigger on-demand PITR snapshot
        snap_request = TriggerPITRSnapshotRequest(
            checkpoint_type="MINIO_WORM_SNAPSHOT",
            storage_tier="COLD_S3_GLACIER",
            worm_locked=True,
            retention_days=90,
            custom_tag="Q3-PRE-DEPLOY-SNAPSHOT",
        )
        snapshot = await dr_service.trigger_pitr_snapshot(db, org_id, snap_request)
        await db.commit()

        assert snapshot.id is not None
        assert snapshot.checkpoint_type == "MINIO_WORM_SNAPSHOT"
        assert snapshot.worm_locked is True
        assert snapshot.worm_retention_until is not None
        assert snapshot.metadata_json.get("custom_tag") == "Q3-PRE-DEPLOY-SNAPSHOT"

        # 4. Verify checkpoint integrity
        verification = await dr_service.verify_checkpoint(db, snapshot.id, org_id)
        assert verification.is_valid is True
        assert verification.worm_locked is True
        assert verification.status == "VERIFIED"
        assert verification.checksum_sha256 == snapshot.checksum_sha256

        # 5. List checkpoints
        checkpoints = await dr_service.list_checkpoints(db, org_id)
        assert len(checkpoints) >= 2


@pytest.mark.asyncio
async def test_failover_drill_simulation_and_compliance():
    async with TestSession() as db:
        org_id = uuid4()
        fixtures = await setup_dr_fixtures(db, org_id)

        # 1. Run simulated failover drill
        drill_req = RunFailoverDrillRequest(
            drill_name="Quarterly Multi-Region Datacenter Blackout Drill",
            simulated_disaster_scenario="PRIMARY_REGION_OUTAGE",
            target_environment="SECONDARY_K3S_COLD_STANDBY",
            target_rpo_minutes=60,
            target_rto_minutes=240,
        )
        drill = await dr_service.run_failover_drill(
            db,
            org_id,
            fixtures["admin_id"],
            drill_req,
        )
        await db.commit()

        # 2. Validate drill execution & SLA benchmarks
        assert drill.id is not None
        assert drill.drill_code.startswith("DR-DRILL-")
        assert drill.status == "PASSED"
        assert drill.actual_rpo_minutes is not None
        assert drill.actual_rto_minutes is not None
        assert drill.actual_rpo_minutes <= Decimal("60.00")
        assert drill.actual_rto_minutes <= Decimal("240.00")
        assert drill.rpo_compliant is True
        assert drill.rto_compliant is True

        # 3. Validate drill step phases
        phases = drill.drill_phases
        assert len(phases) == 5
        phase_names = [p["phase_name"] for p in phases]
        assert "PITR_WAL_REPLAY" in phase_names
        assert "MINIO_WORM_VERIFY" in phase_names
        assert "SECONDARY_K3S_FAILOVER" in phase_names
        assert "DNS_HEALTH_TTL_SWITCH" in phase_names
        assert "INTEGRITY_SMOKE_TEST" in phase_names

        for p in phases:
            assert p["status"] == "PASSED"
            assert p["duration_seconds"] > 0

        # 4. Validate executive sign-off audit report
        report = drill.audit_report
        assert "ISO_27001_A12_3" in report["compliance_standards"]
        assert "SOC_2_AVAILABILITY_CC9" in report["compliance_standards"]
        assert "sha256_audit_seal" in report
        assert len(report["sha256_audit_seal"]) == 64

        # 5. Retrieve drill by ID and list drills
        retrieved = await dr_service.get_drill(db, drill.id, org_id)
        assert retrieved.drill_code == drill.drill_code

        drills_list = await dr_service.list_drills(db, org_id)
        assert len(drills_list) >= 1
        assert drills_list[0].id == drill.id

        # 6. Check updated posture metrics reflect drill
        updated_posture = await dr_service.get_dr_posture(db, org_id)
        assert updated_posture.recent_drills_total >= 1
        assert updated_posture.recent_drills_passed >= 1
        assert updated_posture.dr_readiness_status == "HEALTHY"
