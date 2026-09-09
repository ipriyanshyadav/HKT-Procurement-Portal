"""
Integration tests for Option D: Enterprise Compliance & Security Posture Dashboard:
- Default multi-framework baseline policies auto-provisioning (ISO 27001, SOC 2, DPDP, CVC)
- Live posture scan evaluation across database metrics (access, audit chain, PII, emergency justifications)
- Posture score calculations, framework breakdowns, and itemized findings
- Policy toggling (enable/disable)
- Cryptographic SHA-256 compliance attestation certificate generation and digital signing
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.modules.compliance.schemas import ComplianceScanRunRequest
from app.modules.compliance.service import compliance_service
from app.modules.user.models import User

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def seed_compliance_test_user(db: AsyncSession, org_id):
    user_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, 'Compliance Org', 'Compliance Corp', 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version, mfa_enabled)
        VALUES (:id, :org_id, :email, 'hash', 'Auditor', 'Lead', 'ACTIVE', 1, TRUE)
        """),
        {"id": user_id, "org_id": org_id, "email": f"auditor-{user_id.hex[:6]}@enterprise.com"},
    )
    await db.commit()
    return user_id


@pytest.mark.asyncio
async def test_compliance_policies_provisioning_and_toggle():
    org_id = uuid4()
    async with TestSession() as db:
        await seed_compliance_test_user(db, org_id)

        # 1. Fetch policies — should auto-provision defaults
        policies = await compliance_service.list_policies(db, org_id=org_id)
        assert len(policies) >= 8

        frameworks = {p.framework for p in policies}
        assert "ISO_27001" in frameworks
        assert "SOC_2" in frameworks
        assert "DPDP" in frameworks
        assert "CVC" in frameworks

        # 2. Toggle policy
        target = policies[0]
        assert target.is_enabled is True

        updated = await compliance_service.toggle_policy(
            db, policy_id=target.id, org_id=org_id, is_enabled=False
        )
        assert updated.is_enabled is False

        # Restore
        restored = await compliance_service.toggle_policy(
            db, policy_id=target.id, org_id=org_id, is_enabled=True
        )
        assert restored.is_enabled is True


@pytest.mark.asyncio
async def test_run_live_compliance_scan_and_findings():
    org_id = uuid4()
    async with TestSession() as db:
        user_id = await seed_compliance_test_user(db, org_id)
        user = await db.get(User, user_id)
        assert user is not None

        # Run live scan
        scan = await compliance_service.run_live_compliance_scan(
            db,
            org_id=org_id,
            user_id=user.id,
            request=ComplianceScanRunRequest(notes="Quarterly Security & CVC Compliance Audit"),
        )

        assert scan is not None
        assert scan.org_id == org_id
        assert scan.status == "COMPLETED"
        assert float(scan.overall_score) > 0.0
        assert scan.total_checks >= 8
        assert scan.passed_checks + scan.warning_checks + scan.failed_checks == scan.total_checks

        assert "ISO_27001" in scan.framework_scores
        assert "SOC_2" in scan.framework_scores
        assert "DPDP" in scan.framework_scores
        assert "CVC" in scan.framework_scores

        assert scan.findings is not None
        assert len(scan.findings) >= 8

        # Verify finding fields
        for f in scan.findings:
            assert f.scan_id == scan.id
            assert f.status in ("PASS", "WARN", "FAIL")
            assert float(f.score) >= 0.0
            assert f.evidence_summary is not None
            assert f.remediation_guidance is not None

        # Verify get_latest_scan returns this scan
        latest = await compliance_service.get_latest_scan(db, org_id=org_id)
        assert latest is not None
        assert latest.id == scan.id


@pytest.mark.asyncio
async def test_cryptographic_compliance_attestation():
    org_id = uuid4()
    async with TestSession() as db:
        user_id = await seed_compliance_test_user(db, org_id)
        user = await db.get(User, user_id)
        assert user is not None

        # 1. Run scan
        scan = await compliance_service.run_live_compliance_scan(
            db,
            org_id=org_id,
            user_id=user.id,
        )

        # 2. Generate attestation
        attestation = await compliance_service.generate_attestation(
            db,
            scan_id=scan.id,
            org_id=org_id,
            issued_by_email=user.email,
        )

        assert attestation.attestation_id.startswith("ATTEST-HKT-")
        assert attestation.scan_id == scan.id
        assert attestation.org_id == org_id
        assert attestation.issued_by_email == user.email
        assert len(attestation.cryptographic_checksum_sha256) == 64
        assert attestation.digital_signature_manifest.startswith("SIG-SHA256:")
        assert attestation.overall_score == float(scan.overall_score)
        assert attestation.grade in ("A+", "A", "B", "C", "F")
        assert attestation.compliance_status in (
            "CERTIFIED_COMPLIANT",
            "CONDITIONAL_APPROVAL",
            "ACTION_REQUIRED",
        )
        assert attestation.findings_count["total"] == scan.total_checks


@pytest.mark.asyncio
async def test_historical_scans_listing():
    org_id = uuid4()
    async with TestSession() as db:
        user_id = await seed_compliance_test_user(db, org_id)

        # Run 2 scans
        s1 = await compliance_service.run_live_compliance_scan(db, org_id=org_id, user_id=user_id)
        s2 = await compliance_service.run_live_compliance_scan(db, org_id=org_id, user_id=user_id)

        scans = await compliance_service.list_scans(db, org_id=org_id, limit=10)
        assert len(scans) >= 2
        scan_ids = [s.id for s in scans]
        assert s1.id in scan_ids
        assert s2.id in scan_ids
