from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db.enums import (
    ApprovalTaskStatusEnum,
    IntegrationJobStatusEnum,
    UserStatusEnum,
)
# Ensure related foreign key tables are loaded in metadata
from app.modules.organization.models import Plant, Department, BusinessUnit  # noqa: F401
from app.modules.integration.adapters.erp_base import ERPAdapterFactory
from app.modules.integration.adapters.erp_custom import CustomERPAdapter
from app.modules.integration.adapters.erp_oracle import OracleAdapter
from app.modules.integration.adapters.erp_sap import SAPAdapter
from app.modules.integration.adapters.gem import GEMAdapter
from app.modules.integration.adapters.gst import GSTAdapter
from app.modules.integration.adapters.hrms import HRMSConsumer
from app.modules.integration.job_processor import IntegrationJobProcessor
from app.modules.integration.models import IntegrationJob, TenantSetting
from app.modules.integration.service import integration_service
from app.modules.integration.webhook import WebhookDeliveryService
from app.modules.user.models import User, UserSession

pytestmark = pytest.mark.asyncio

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def _setup_org(db: AsyncSession, org_id):
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency)
        VALUES (:id, :name, :legal_name, 'IN', 'INR')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )


async def test_erp_adapter_factory_selects_correct():
    """ERPAdapterFactory selects SAP, Oracle, and Custom adapters correctly."""
    sap = ERPAdapterFactory.get_adapter("SAP", {"system_id": "PRD"})
    assert isinstance(sap, SAPAdapter)
    assert sap.system_id == "PRD"

    oracle = ERPAdapterFactory.get_adapter("ORACLE", {"ledger_id": "US_LEDGER"})
    assert isinstance(oracle, OracleAdapter)
    assert oracle.ledger_id == "US_LEDGER"

    custom = ERPAdapterFactory.get_adapter("CUSTOM", {"api_key": "secret123"})
    assert isinstance(custom, CustomERPAdapter)

    default_custom = ERPAdapterFactory.get_adapter(None)
    assert isinstance(default_custom, CustomERPAdapter)


async def test_webhook_signature_valid():
    """Verify HMAC-SHA256 signature in X-Procurement-Signature header."""
    secret = "my_shared_webhook_secret_key"
    payload = {"event": "po.approved", "po_number": "PO-2026-001", "amount": 50000}
    body_str = json.dumps(payload, default=str)

    sig = WebhookDeliveryService.generate_signature(secret, body_str)
    header = f"sha256={sig}"

    # Valid signature
    assert WebhookDeliveryService.verify_signature(secret, body_str, header) is True

    # Tampered body fails
    tampered_body = json.dumps({"event": "po.approved", "po_number": "PO-2026-001", "amount": 99999})
    assert WebhookDeliveryService.verify_signature(secret, tampered_body, header) is False

    # Wrong secret fails
    assert WebhookDeliveryService.verify_signature("wrong_secret", body_str, header) is False


async def test_retry_delay_sequence():
    """Job fails consecutively; next_retry_at follows settings.INTEGRATION_RETRY_DELAYS_SECONDS."""
    org_id = uuid4()
    processor = IntegrationJobProcessor()
    expected_delays = settings.INTEGRATION_RETRY_DELAYS_SECONDS

    async with TestSession() as session:
        await _setup_org(session, org_id)

        job = await processor.create_job(
            session,
            job_type="UNKNOWN_ACTION",
            entity_type="TEST_ENTITY",
            entity_id=uuid4(),
            payload={"action": "fail"},
            org_id=org_id,
            adapter_type="SAP",
        )
        await session.commit()

        # Simulate failures from 1 to 6 and assert exact delay mapping
        for failure_num in range(1, 7):
            now_before = datetime.now(timezone.utc)
            await processor._process_job(session, job)
            await session.commit()

            assert job.retry_count == failure_num
            assert job.status == IntegrationJobStatusEnum.PENDING
            assert job.next_retry_at is not None

            expected_delay = expected_delays[failure_num - 1]
            diff_seconds = (job.next_retry_at - now_before).total_seconds()
            # Verify calculated next_retry_at matches expected delay within 5s tolerance
            assert abs(diff_seconds - expected_delay) < 5


async def test_failed_job_sends_alert():
    """7 failures -> status=FAILED + alert published to procurement.alert."""
    org_id = uuid4()
    mock_publisher = AsyncMock()
    processor = IntegrationJobProcessor(publisher=mock_publisher)

    async with TestSession() as session:
        await _setup_org(session, org_id)

        job = await processor.create_job(
            session,
            job_type="UNKNOWN_ACTION",
            entity_type="CRITICAL_ORDER",
            entity_id=uuid4(),
            payload={"fail": True},
            org_id=org_id,
            adapter_type="SAP",
            max_retries=7,
        )
        # Advance job to 6 previous retries
        job.retry_count = 6
        await session.commit()

        # 7th failure
        await processor._process_job(session, job)
        await session.commit()

        assert job.retry_count == 7
        assert job.status == IntegrationJobStatusEnum.FAILED

        # Assert alert was published to procurement.alert
        mock_publisher.publish.assert_called_once()
        call_args = mock_publisher.publish.call_args[0]
        assert call_args[0] == "procurement.alert"
        assert call_args[1] == "alert.integration.job_failed"
        assert call_args[2]["job_id"] == str(job.id)


async def test_hrms_termination_revokes_sessions():
    """Employee terminated -> user.status=TERMINATED + active sessions revoked."""
    org_id = uuid4()
    user_id = uuid4()
    emp_code = f"EMP-{uuid4().hex[:6]}"

    async with TestSession() as session:
        await _setup_org(session, org_id)

        # Create user via raw SQL to ensure full compatibility with partial schema refs
        await session.execute(
            text("""
            INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, employee_id, status, version)
            VALUES (:id, :org_id, :email, 'hash', 'John', 'Doe', :emp_code, 'ACTIVE', 1)
            """),
            {
                "id": user_id,
                "org_id": org_id,
                "email": f"terminated-{user_id.hex[:6]}@test.com",
                "emp_code": emp_code,
            },
        )

        # Create active sessions
        sess1 = UserSession(
            id=uuid4(),
            user_id=user_id,
            org_id=org_id,
            token_jti=f"jti-{uuid4().hex}",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
            is_revoked=False,
        )
        sess2 = UserSession(
            id=uuid4(),
            user_id=user_id,
            org_id=org_id,
            token_jti=f"jti-{uuid4().hex}",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
            is_revoked=False,
        )
        session.add_all([sess1, sess2])
        await session.commit()

        # Trigger HRMS termination
        consumer = HRMSConsumer()
        res = await consumer.handle_termination(session, employee_id=emp_code, org_id=org_id)
        await session.commit()

        assert res["status"] == "TERMINATED"
        assert res["sessions_revoked"] is True

        # Verify in DB
        user_db = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
        assert user_db.status == UserStatusEnum.TERMINATED

        sessions_db = (await session.execute(select(UserSession).where(UserSession.user_id == user_id))).scalars().all()
        assert len(sessions_db) == 2
        for s in sessions_db:
            assert s.is_revoked is True
            assert s.revoked_reason == "HRMS_TERMINATION"


async def test_job_processor_successful_vendor_sync():
    """Successful job execution transitions status to COMPLETED and records response."""
    org_id = uuid4()
    vendor_id = uuid4()
    processor = IntegrationJobProcessor()

    async with TestSession() as session:
        await _setup_org(session, org_id)

        job = await processor.create_job(
            session,
            job_type="VENDOR_SYNC",
            entity_type="VENDOR",
            entity_id=vendor_id,
            payload={"vendor_code": "V-1001", "name": "ACME Supplies"},
            org_id=org_id,
            adapter_type="SAP",
        )
        await session.commit()

        await processor._process_job(session, job)
        await session.commit()

        assert job.status == IntegrationJobStatusEnum.COMPLETED
        assert job.response_payload is not None
        assert job.response_payload["status"] == "SYNCHRONIZED"
        assert job.response_payload["provider"] == "SAP"
        assert job.completed_at is not None
        assert job.error_message is None


async def test_manual_retry_job_service():
    """Manual retry resets a failed job to PENDING and clears errors."""
    org_id = uuid4()
    job_id = uuid4()
    actor_id = uuid4()

    async with TestSession() as session:
        await _setup_org(session, org_id)

        job = IntegrationJob(
            id=job_id,
            org_id=org_id,
            job_type="PO_CREATE",
            entity_type="PURCHASE_ORDER",
            entity_id=uuid4(),
            direction="OUTBOUND",
            adapter_type="SAP",
            status=IntegrationJobStatusEnum.FAILED,
            retry_count=7,
            error_message="Connection timeout",
        )
        session.add(job)
        await session.commit()

        retried = await integration_service.retry_job(
            session,
            job_id=job_id,
            actor_id=actor_id,
            org_id=org_id,
        )
        await session.commit()

        assert retried.status == IntegrationJobStatusEnum.PENDING
        assert retried.error_message is None
        assert retried.next_retry_at is not None


async def test_gem_and_gst_adapters():
    """GeM and GST portal adapters perform queries and formatting correctly."""
    gem = GEMAdapter()
    org_id = uuid4()

    bids_res = await gem.sync_bids(org_id)
    assert bids_res["status"] == "SUCCESS"
    assert len(bids_res["bids"]) > 0

    seller_res = await gem.verify_seller("SELLER-99", org_id)
    assert seller_res["status"] == "VERIFIED"
    assert seller_res["is_gem_verified"] is True

    gst = GSTAdapter()
    assert gst.validate_format("27AAPFU0939F1ZV") is True
    assert gst.validate_format("INVALID_GST") is False

    val_res = await gst.validate("27AAPFU0939F1ZV", "Test Enterprise Ltd")
    assert val_res["is_valid"] is True
    assert val_res["pan"] == "AAPFU0939F"
