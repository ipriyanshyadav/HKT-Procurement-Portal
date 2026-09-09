from __future__ import annotations
import csv
import io
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import NotificationChannelEnum, NotificationStatusEnum, UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.audit.crypto_chain import (
    GENESIS_HASH,
    compute_payload_fingerprint,
    compute_record_hash,
    resolve_ip_geolocation,
    verify_audit_log_chain,
)
from app.modules.audit.service import audit_service
from app.modules.notification.models import Notification
from app.modules.notification.service import notification_service
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


class DummyAuditLog:
    def __init__(
        self,
        log_id,
        org_id,
        entity_type,
        entity_id,
        action,
        created_at,
        actor_id,
        prev_hash,
        record_hash,
        payload=None,
    ):
        self.id = log_id
        self.org_id = org_id
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.action = action
        self.created_at = created_at
        self.actor_id = actor_id
        self.metadata_ = {"prev_hash": prev_hash, "record_hash": record_hash}
        self.new_values = payload or {}
        self.old_values = {}


@pytest.fixture
def mock_admin_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "sec_admin@example.com"
    user.first_name = "Security"
    user.last_name = "Admin"
    user.full_name = "Security Admin"
    user.status = UserStatusEnum.ACTIVE
    user.is_supplier_user = False
    user.vendor_id = None
    return user


@pytest.fixture
def client(mock_admin_user):
    async def _fake_db():
        mock = AsyncMock()
        mock.execute = AsyncMock()
        mock.commit = AsyncMock()
        mock.flush = AsyncMock()
        mock.refresh = AsyncMock()
        mock.add = MagicMock()
        yield mock

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: mock_admin_user

    with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
        yield TestClient(app)

    app.dependency_overrides.clear()


@pytest.mark.integration
class TestCryptoAuditTrailChaining:
    """SPEC_22: Cryptographic SHA-256 Tamper-Evident Audit Trail Tests."""

    def test_compute_genesis_record_hash(self):
        rec_id = uuid4()
        org_id = uuid4()
        ent_id = uuid4()
        act_id = uuid4()
        now = datetime.now(timezone.utc).isoformat()
        h = compute_record_hash(
            prev_hash=GENESIS_HASH,
            log_id=rec_id,
            org_id=org_id,
            entity_type="CONTRACT",
            entity_id=ent_id,
            action="CONTRACT_ACTIVATED",
            created_at_iso=now,
            actor_id=act_id,
            payload_data={"old_status": "DRAFT", "new_status": "ACTIVE"},
        )
        assert len(h) == 64
        assert int(h, 16) > 0

    def test_verify_valid_audit_log_chain(self):
        logs = []
        prev = GENESIS_HASH
        org_id = uuid4()
        actor = uuid4()

        for i in range(5):
            rec_id = uuid4()
            ent_id = uuid4()
            now = datetime.now(timezone.utc)
            changes = {"step": i, "status": f"STEP_{i}"}
            curr_hash = compute_record_hash(
                prev_hash=prev,
                log_id=rec_id,
                org_id=org_id,
                entity_type="RFQ",
                entity_id=ent_id,
                action=f"ACTION_{i}",
                created_at_iso=now.isoformat(),
                actor_id=actor,
                payload_data=changes,
            )
            logs.append(
                DummyAuditLog(
                    log_id=rec_id,
                    org_id=org_id,
                    entity_type="RFQ",
                    entity_id=ent_id,
                    action=f"ACTION_{i}",
                    created_at=now,
                    actor_id=actor,
                    prev_hash=prev,
                    record_hash=curr_hash,
                    payload=changes,
                )
            )
            prev = curr_hash

        result = verify_audit_log_chain(logs)
        assert result["is_valid"] is True
        assert result["verified_count"] == 5
        assert result["tampered_record_id"] is None

    def test_tamper_detection_in_audit_chain(self):
        logs = []
        prev = GENESIS_HASH
        org_id = uuid4()
        actor = uuid4()

        for i in range(4):
            rec_id = uuid4()
            ent_id = uuid4()
            now = datetime.now(timezone.utc)
            changes = {"step": i}
            curr_hash = compute_record_hash(
                prev_hash=prev,
                log_id=rec_id,
                org_id=org_id,
                entity_type="INVOICE",
                entity_id=ent_id,
                action=f"ACTION_{i}",
                created_at_iso=now.isoformat(),
                actor_id=actor,
                payload_data=changes,
            )
            logs.append(
                DummyAuditLog(
                    log_id=rec_id,
                    org_id=org_id,
                    entity_type="INVOICE",
                    entity_id=ent_id,
                    action=f"ACTION_{i}",
                    created_at=now,
                    actor_id=actor,
                    prev_hash=prev,
                    record_hash=curr_hash,
                    payload=changes,
                )
            )
            prev = curr_hash

        # Maliciously alter payload of record index 2
        logs[2].new_values = {"step": 2, "tampered_payout": 9999999}

        result = verify_audit_log_chain(logs)
        assert result["is_valid"] is False
        assert result["tampered_record_id"] == str(logs[2].id)
        assert result["error"] == "CONTENT_TAMPERING_DETECTED"

    def test_ip_geolocation_resolution(self):
        # Private loopback
        local_geo = resolve_ip_geolocation("127.0.0.1")
        assert local_geo["is_internal"] is True
        assert local_geo["country"] == "Local"

        # Private RFC-1918 LAN
        lan_geo = resolve_ip_geolocation("192.168.1.100")
        assert lan_geo["is_internal"] is True
        assert lan_geo["country"] == "Local"

        # Public IP
        public_geo = resolve_ip_geolocation("103.21.244.2")
        assert public_geo["is_internal"] is False
        assert public_geo["country"] == "IN"

    def test_compliance_fingerprint_generation(self):
        sample_logs = {"id": "1", "action": "PO_APPROVED"}
        fp1 = compute_payload_fingerprint(sample_logs)
        fp2 = compute_payload_fingerprint(sample_logs)
        assert fp1 == fp2
        assert len(fp1) == 64


@pytest.mark.integration
class TestAuditTrailRouterEndpoints:
    """SPEC_22: Audit Trail API Endpoints."""

    def test_get_audit_logs_endpoint(self, client):
        with patch.object(audit_service, "get_audit_logs", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {
                "items": [],
                "total": 0,
                "page": 1,
                "page_size": 10,
                "total_pages": 1,
            }
            resp = client.get("/api/v1/audit/logs?page=1&page_size=10")
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert isinstance(data, list)

    def test_verify_chain_endpoint(self, client):
        with patch.object(audit_service, "verify_chain_integrity", new_callable=AsyncMock) as mock_verify:
            mock_verify.return_value = {
                "is_valid": True,
                "verified_count": 10,
                "total_records_analyzed": 10,
                "head_hash": "a" * 64,
                "tampered_record_id": None,
                "message": "Audit chain verified",
                "verified_at": "2026-09-09T00:00:00Z",
            }
            resp = client.get("/api/v1/audit/verify-chain")
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert data["is_valid"] is True
            assert "verified_at" in data

    def test_export_compliance_report_json(self, client):
        with patch.object(audit_service, "export_compliance_report", new_callable=AsyncMock) as mock_export:
            mock_export.return_value = {
                "format": "JSON",
                "exported_at": "2026-09-09T00:00:00Z",
                "total_records": 1,
                "sha256_checksum": "a" * 64,
                "records": [{"id": str(uuid4()), "action": "LOGIN"}],
            }
            resp = client.post(
                "/api/v1/audit/export",
                json={"format": "JSON", "action": "LOGIN"},
            )
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert data["format"] == "JSON"
            assert "sha256_checksum" in data
            assert "records" in data

    def test_export_compliance_report_csv(self, client):
        with patch.object(audit_service, "export_compliance_report", new_callable=AsyncMock) as mock_export:
            mock_export.return_value = {
                "format": "CSV",
                "exported_at": "2026-09-09T00:00:00Z",
                "total_records": 1,
                "sha256_checksum": "a" * 64,
                "csv_content": "id,action,created_at\n1,LOGIN,2026-09-09T00:00:00Z",
            }
            resp = client.post(
                "/api/v1/audit/export",
                json={"format": "CSV"},
            )
            assert resp.status_code == 200
            assert "text/csv" in resp.headers["content-type"]
            assert "id,action,created_at" in resp.text


@pytest.mark.integration
class TestNotificationsMultiChannel:
    """SPEC_16: Multi-Channel Real-Time Notifications & Preferences."""

    def test_critical_notification_classification(self):
        assert notification_service.is_critical("rfq_bid_deadline_4h") is True
        assert notification_service.is_critical("security_alert") is True
        assert notification_service.is_critical("vendor_compliance_hold") is True
        assert notification_service.is_critical("general_newsletter") is False

    def test_dispatch_test_notification_endpoint(self, client, mock_admin_user):
        with patch.object(notification_service, "dispatch", new_callable=AsyncMock) as mock_dispatch:
            now = datetime.now(timezone.utc)
            mock_notif = MagicMock(spec=Notification)
            mock_notif.id = uuid4()
            mock_notif.org_id = mock_admin_user.org_id
            mock_notif.user_id = mock_admin_user.id
            mock_notif.notification_type = "security_alert"
            mock_notif.channel = NotificationChannelEnum.IN_APP
            mock_notif.title = "Unrecognized Login Attempt"
            mock_notif.body = "A login from a new IP was detected on your account."
            mock_notif.entity_type = None
            mock_notif.entity_id = None
            mock_notif.status = NotificationStatusEnum.SENT
            mock_notif.sent_at = now
            mock_notif.delivered_at = now
            mock_notif.read_at = None
            mock_notif.error_message = None
            mock_notif.retry_count = 0
            mock_notif.created_at = now

            mock_dispatch.return_value = [mock_notif]

            resp = client.post(
                "/api/v1/notifications/dispatch-test",
                json={
                    "user_id": str(mock_admin_user.id),
                    "notification_type": "security_alert",
                    "title": "Unrecognized Login Attempt",
                    "body": "A login from a new IP was detected on your account.",
                },
            )
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert len(data) > 0
            assert data[0]["title"] == "Unrecognized Login Attempt"
            assert data[0]["notification_type"] == "security_alert"

    def test_get_notifications_endpoint(self, client):
        with patch.object(notification_service, "list_notifications", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = ([], 0, 0)
            resp = client.get("/api/v1/notifications?page=1&page_size=15")
            assert resp.status_code == 200
            body = resp.json()
            assert "data" in body
            assert "meta" in body

    def test_get_preferences_endpoint(self, client):
        with patch.object(notification_service, "get_preferences", new_callable=AsyncMock) as mock_prefs:
            mock_prefs.return_value = []
            resp = client.get("/api/v1/notifications/preferences")
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert isinstance(data, list)

    def test_mark_all_read_endpoint(self, client):
        with patch.object(notification_service, "mark_all_as_read", new_callable=AsyncMock) as mock_read:
            mock_read.return_value = 5
            resp = client.post("/api/v1/notifications/mark-all-read")
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert data["updated_count"] == 5
