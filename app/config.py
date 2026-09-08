from __future__ import annotations
from functools import lru_cache
from typing import Literal
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Application
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["local", "dev", "staging", "production"] = "local"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str
    ANALYTICS_DATABASE_URL: str = ""
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_RECYCLE: int = 3600
    DATABASE_POOL_CLASS: str = ""
    SQL_ECHO: bool = False

    # Redis
    REDIS_URL: str
    REDIS_SESSION_DB: int = 0
    REDIS_RATE_LIMIT_DB: int = 1
    REDIS_CACHE_DB: int = 2
    REDIS_CELERY_BACKEND_DB: int = 3

    # RabbitMQ
    RABBITMQ_URL: str

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_USE_SSL: bool = False
    MINIO_MAX_FILE_SIZE_MB: int = 50

    # JWT/Auth
    JWT_PRIVATE_KEY_PATH: str = "keys/private.pem"
    JWT_PUBLIC_KEY_PATH: str = "keys/public.pem"

    @field_validator("JWT_PRIVATE_KEY_PATH", "JWT_PUBLIC_KEY_PATH", mode="before")
    @classmethod
    def normalize_key_paths(cls, v: str) -> str:
        if isinstance(v, str):
            return v.replace("\\", "/")
        return v

    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_HOURS: int = 8
    JWT_KEY_ID: str = "key-2026-06"
    JWT_ALGORITHM: str = "RS256"
    MFA_INACTIVITY_TIMEOUT_MINUTES: int = 30
    MAX_CONCURRENT_SESSIONS: int = 5
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 30

    # Cookies
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"

    # Field Encryption
    FIELD_ENCRYPTION_KEY: str = "default_key_needs_replacement"

    # ClamAV Antivirus Scanner
    CLAMAV_ENABLED: bool = False
    CLAMAV_HOST: str = "clamav"
    CLAMAV_PORT: int = 3310
    CLAMAV_TIMEOUT_SECONDS: int = 10

    # Enterprise SSO (SAML 2.0 & OIDC)
    SAML_ENABLED: bool = False
    SAML_IDP_METADATA_URL: str = ""
    SAML_IDP_ENTITY_ID: str = ""
    SAML_IDP_SSO_URL: str = ""
    SAML_IDP_CERTIFICATE: str = ""
    SAML_SP_ENTITY_ID: str = "https://procurement.portal/api/v1/auth/sso/saml"
    SAML_SP_ACS_URL: str = "http://localhost:8000/api/v1/auth/sso/callback"

    OIDC_ENABLED: bool = False
    OIDC_DISCOVERY_URL: str = ""
    OIDC_CLIENT_ID: str = ""
    OIDC_CLIENT_SECRET: str = ""
    OIDC_AUTHORIZATION_URL: str = ""
    OIDC_TOKEN_URL: str = ""
    OIDC_USERINFO_URL: str = ""
    OIDC_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/sso/oidc/callback"

    # External Services
    GST_API_BASE_URL: str = ""
    GST_API_KEY: str = ""
    NSDL_API_BASE_URL: str = ""
    NSDL_API_KEY: str = ""
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = ""
    SENDGRID_FROM_NAME: str = "Procurement Portal"
    SENDGRID_API_URL: str = "https://api.sendgrid.com/v3/mail/send"
    MSG91_AUTH_KEY: str = ""
    MSG91_SENDER_ID: str = ""
    MSG91_API_URL: str = "https://control.msg91.com/api/v5/flow"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    WHATSAPP_ENABLED: bool = False
    WHATSAPP_PROVIDER: Literal["meta", "twilio", "mock"] = "mock"
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_API_URL: str = "https://graph.facebook.com/v19.0"
    WHATSAPP_FROM_PHONE: str = ""
    TURNSTILE_ENABLED: bool = False
    TURNSTILE_SECRET_KEY: str = ""
    TURNSTILE_VERIFY_URL: str = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    DIGIO_CLIENT_ID: str = ""
    DIGIO_CLIENT_SECRET: str = ""
    DOCUSIGN_ACCOUNT_ID: str = ""
    DOCUSIGN_INTEGRATION_KEY: str = ""
    EXCHANGE_RATE_API_URL: str = "https://api.exchangerate-api.com/v4"
    EXCHANGE_RATE_API_KEY: str = ""

    # Observability
    OTEL_ENABLED: bool = True
    JAEGER_HOST: str = "localhost"
    JAEGER_PORT: int = 4317
    OTEL_SAMPLING_RATE: float = 1.0
    LOG_LEVEL: str = "INFO"
    ELASTICSEARCH_ENABLED: bool = True
    ELASTICSEARCH_URL: str = "http://localhost:9200"
    ELASTICSEARCH_INDEX_PREFIX: str = "audit-logs"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:3001",
        "http://0.0.0.0:3002",
        "http://[::1]:3000",
        "http://[::1]:3001",
        "http://[::1]:3002",
    ]

    # Celery
    CELERY_OUTBOX_INTERVAL_SECONDS: float = 5.0
    CELERY_SLA_CHECK_MINUTES: int = 15
    CELERY_BID_WINDOW_CHECK_MINUTES: int = 5
    CELERY_COMPLIANCE_CHECK_HOURS: int = 24
    CELERY_DIGEST_INTERVAL_MINUTES: int = 60
    CELERY_ANALYTICS_SNAPSHOT_HOURS: int = 6
    CELERY_SESSION_CLEANUP_MINUTES: int = 30
    CELERY_DORMANT_USER_CHECK_DAYS: int = 1
    CELERY_EXCHANGE_RATE_HOURS: int = 12
    CELERY_REMINDER_CHECK_MINUTES: int = 30
    CELERY_PR_AGING_HOURS: int = 4
    CELERY_ESCALATION_CHECK_MINUTES: int = 15
    CELERY_REPORT_CACHE_HOURS: int = 1
    CELERY_BACKUP_VERIFICATION_HOURS: int = 24
    CELERY_METRICS_COLLECTION_MINUTES: int = 5
    CELERY_WORKFLOW_TIMEOUT_CHECK_MINUTES: int = 10

    # Business Rules
    CSV_IMPORT_MAX_ROWS: int = 5000
    INVITATION_TOKEN_TTL_DAYS: int = 7
    VENDOR_GST_CACHE_TTL_DAYS: int = 90
    PAN_CACHE_TTL_DAYS: int = 90
    COMPLIANCE_EXPIRY_WARNING_DAYS: list[int] = [90, 30, 0]
    PASSWORD_MIN_LENGTH: int = 12
    PASSWORD_HISTORY_COUNT: int = 5
    PASSWORD_EXPIRY_DAYS: int = 90
    COMMON_PASSWORDS_FILE: str = "scripts/common_passwords.txt"
    PRICE_TOLERANCE_DEFAULT: float = 0.005
    BID_VALIDITY_MIN_DAYS: int = 30
    BID_VALIDITY_MAX_DAYS: int = 180
    STANDARD_BID_WINDOW_MIN_HOURS: int = 72
    EMERGENCY_BID_WINDOW_MIN_HOURS: int = 24
    MIN_CLOSED_RFQ_PARTICIPANTS: int = 3
    PR_AGING_ALERT_DAYS: list[int] = [7, 14, 30]
    INVOICE_AGING_ALERT_DAYS: list[int] = [15, 30, 45, 60]
    INVOICE_TAX_TOLERANCE_PCT: float = 0.01
    UNMAPPED_PR_SLA_HOURS: list[int] = [4, 8, 24, 48]
    OUTBOX_RETRY_MAX: int = 10
    INTEGRATION_JOB_MAX_RETRIES: int = 7
    INTEGRATION_RETRY_DELAYS_SECONDS: list[int] = [60, 300, 900, 1800, 3600, 14400, 86400]
    DORMANT_USER_DAYS: int = 90
    VENDOR_COMPLIANCE_HOLD_EXPIRY_DAYS: int = 0
    OUTBOX_BATCH_SIZE: int = 100
    IDEMPOTENCY_KEY_TTL_SECONDS: int = 86400
    EXCHANGE_RATE_CACHE_TTL_SECONDS: int = 86400
    DLQ_TTL_MS: int = 604800000
    PRESIGNED_URL_EXPIRY_SECONDS: int = 900
    CONTRACT_DOCUMENTS_BUCKET: str = "contract-documents"
    CONTRACT_EXPIRY_ALERT_DAYS: list[int] = [90, 60, 30, 0]
    DEFAULT_ESIGN_PROVIDER: str = "digio"
    DIGIO_API_URL: str = "https://api.digio.in"
    DIGIO_CLIENT_ID: str = ""
    DIGIO_CLIENT_SECRET: str = ""
    DOCUSIGN_API_URL: str = "https://demo.docusign.net/restapi"
    DOCUSIGN_ACCOUNT_ID: str = ""
    DOCUSIGN_INTEGRATION_KEY: str = ""
    CONTRACT_NUMBER_PREFIX: str = "CNT"
    CELERY_CONTRACT_EXPIRY_CHECK_HOURS: int = 24

    # ML & Matching Thresholds
    ML_AUTO_MAP_CONFIDENCE_THRESHOLD: float = 0.85
    VENDOR_DUPLICATE_NAME_SIMILARITY: float = 0.85
    DEFAULT_COST_OF_CAPITAL_RATE: float = 0.12
    INVOICE_QUANTITY_TOLERANCE_PCT: float = 0.02
    HSTS_MAX_AGE_SECONDS: int = 31536000
    # Roles & Permissions
    DEFAULT_SSO_ROLE_CODE: str = "REQUESTOR"
    UNSCOPED_ANALYTICS_ROLES: list[str] = [
        "PROCUREMENT_HEAD",
        "SUPERADMIN",
        "CFO",
        "PROCUREMENT_ADMIN",
        "ADMIN",
    ]
    MFA_REQUIRED_ROLES: list[str] = [
        "APPROVER",
        "PROCUREMENT_HEAD",
        "FINANCE_CONTROLLER",
        "COMPLIANCE_OFFICER",
        "VENDOR_ADMIN",
        "PROCUREMENT_ADMIN",
        "SOURCING_MANAGER",
        "CFO",
    ]

    # Purchase Order & Evaluation Rules
    PO_PRICE_DEVIATION_TOLERANCE: float = 0.001
    PO_AUTO_APPROVE_THRESHOLD: float = 200000.0
    PO_AMENDMENT_REAPPROVAL_THRESHOLD_PCT: float = 0.10
    DEFAULT_EVALUATION_TECHNICAL_WEIGHT: float = 0.70
    DEFAULT_EVALUATION_COMMERCIAL_WEIGHT: float = 0.30
    AUCTION_DEFAULT_CEILING_PRICE: float = 100000.0
    AUCTION_DEFAULT_MIN_DECREMENT: float = 1000.0
    AUCTION_DEFAULT_DURATION_MINUTES: int = 30
    DEFAULT_PAYMENT_TERMS_NET_DAYS: int = 30
    IDEMPOTENCY_MEMORY_CACHE_MAX_ENTRIES: int = 10000

    # Ticket System Rules
    TICKET_COMMENT_EDIT_WINDOW_SECONDS: int = 900
    TICKET_REOPEN_MAX_DAYS: int = 30
    TICKET_REOPEN_REASON_MIN_LENGTH: int = 5
    TICKET_AUTO_CLOSE_RESOLVED_DAYS: int = 3
    TICKET_AUTO_CLOSE_PENDING_RESPONSE_DAYS: int = 7
    TICKET_DEFAULT_ROUND_ROBIN_DUE_DAYS: int = 3

    # Celery schedule overrides (seconds)
    CELERY_UNMAPPED_SLA_CHECK_SECONDS: int = 900
    CELERY_INVOICE_AGING_CHECK_SECONDS: int = 14400
    CELERY_ANALYTICS_REFRESH_SECONDS: int = 900
    CELERY_DAILY_REPORT_SECONDS: int = 86400
    CELERY_AUCTION_OPEN_SECONDS: float = 30.0
    CELERY_AUCTION_CLOSE_SECONDS: float = 10.0
    CELERY_AUCTION_WARNING_SECONDS: float = 10.0
    CELERY_AUCTION_REMINDER_SECONDS: float = 60.0
    CELERY_INTEGRATION_JOB_SECONDS: float = 60.0
    CELERY_TICKET_DUE_DATE_CHECK_SECONDS: int = 3600
@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
