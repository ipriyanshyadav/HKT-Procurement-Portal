import pytest
from app.config import Settings
from app.core.constants import PermissionCode
from app.core.permissions import PERMANENTLY_DENIED_PERMISSIONS


@pytest.fixture(autouse=True)
def env_setup(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/test")
    monkeypatch.setenv("MINIO_ENDPOINT", "localhost:9000")
    monkeypatch.setenv("MINIO_ACCESS_KEY", "testkey")
    monkeypatch.setenv("MINIO_SECRET_KEY", "testsecret")
    monkeypatch.setenv("JWT_PRIVATE_KEY_PATH", "keys/private.pem")
    monkeypatch.setenv("JWT_PUBLIC_KEY_PATH", "keys/public.pem")
    monkeypatch.setenv("FIELD_ENCRYPTION_KEY", "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw==")


def test_settings_instantiation():
    s = Settings()
    assert s.DATABASE_URL == "postgresql+asyncpg://test:test@localhost:5432/test"
    assert s.REDIS_URL == "redis://localhost:6379/0"
    assert s.RABBITMQ_URL == "amqp://guest:guest@localhost:5672/test"
    assert s.MINIO_ENDPOINT == "localhost:9000"


def test_key_settings_defaults():
    s = Settings()
    assert s.OUTBOX_RETRY_MAX == 10
    assert s.OUTBOX_BATCH_SIZE == 100
    assert s.JWT_ALGORITHM == "RS256"
    assert s.DATABASE_POOL_SIZE == 20
    assert s.DATABASE_POOL_CLASS == ""
    assert s.CELERY_OUTBOX_INTERVAL_SECONDS == 5.0


def test_permanently_denied_permissions():
    assert PermissionCode.RFQ_VIEW_BIDS_BEFORE_OPENING in PERMANENTLY_DENIED_PERMISSIONS


def test_cors_origins():
    s = Settings()
    for origin in [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ]:
        assert origin in s.CORS_ORIGINS


def test_environment_is_literal():
    s = Settings()
    assert s.ENVIRONMENT in ("local", "dev", "staging", "production")


def test_all_celery_intervals_accessible():
    s = Settings()
    assert s.CELERY_SLA_CHECK_MINUTES == 15
    assert s.CELERY_BID_WINDOW_CHECK_MINUTES == 5
    assert s.CELERY_COMPLIANCE_CHECK_HOURS == 24
    assert s.CELERY_DIGEST_INTERVAL_MINUTES == 60
    assert s.CELERY_ANALYTICS_SNAPSHOT_HOURS == 6
    assert s.CELERY_SESSION_CLEANUP_MINUTES == 30
    assert s.CELERY_DORMANT_USER_CHECK_DAYS == 1
    assert s.CELERY_EXCHANGE_RATE_HOURS == 12
    assert s.CELERY_REMINDER_CHECK_MINUTES == 30
    assert s.CELERY_PR_AGING_HOURS == 4
    assert s.CELERY_ESCALATION_CHECK_MINUTES == 15
    assert s.CELERY_REPORT_CACHE_HOURS == 1
    assert s.CELERY_BACKUP_VERIFICATION_HOURS == 24
    assert s.CELERY_METRICS_COLLECTION_MINUTES == 5
    assert s.CELERY_WORKFLOW_TIMEOUT_CHECK_MINUTES == 10
