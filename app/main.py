from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
import aio_pika
from datetime import datetime
from loguru import logger

from app.config import settings
from app.core.telemetry import setup_telemetry
from app.core.exceptions import register_exception_handlers
from app.core.middleware import (
    SecurityHeadersMiddleware,
    TimingMiddleware,
    LoggingContextMiddleware,
    RequestIDMiddleware
)

# Import all module models so SQLAlchemy Base.metadata is fully populated
import app.modules.organization.models  # noqa: F401
import app.modules.user.models  # noqa: F401
import app.modules.master_data.models  # noqa: F401
import app.modules.vendor.models  # noqa: F401
import app.modules.requisition.models  # noqa: F401
import app.modules.sourcing.models  # noqa: F401
import app.modules.bid.models  # noqa: F401
import app.modules.evaluation.models  # noqa: F401
import app.modules.contract.models  # noqa: F401
import app.modules.purchase_order.models  # noqa: F401
import app.modules.grn.models  # noqa: F401
import app.modules.invoice.models  # noqa: F401
import app.modules.payment.models  # noqa: F401
import app.modules.workflow.models  # noqa: F401
import app.modules.approval_rules.models  # noqa: F401
import app.modules.document.models  # noqa: F401
import app.modules.notification.models  # noqa: F401
import app.modules.audit.models  # noqa: F401
import app.modules.integration.models  # noqa: F401

# Placeholder routers for dynamic import or manual definition
from app.modules.organization.router import router as organization_router
from app.modules.user.router import router as user_router
from app.modules.master_data.router import router as master_data_router
from app.modules.vendor.router import router as vendor_router
from app.modules.requisition.router import router as requisition_router
from app.modules.unmapped_pr.router import router as unmapped_pr_router
from app.modules.sourcing.router import router as sourcing_router
from app.modules.bid.router import router as bid_router
from app.modules.evaluation.router import router as evaluation_router
from app.modules.award.router import router as award_router
from app.modules.contract.router import router as contract_router
from app.modules.purchase_order.router import router as purchase_order_router
from app.modules.grn.router import router as grn_router
from app.modules.invoice.router import router as invoice_router
from app.modules.payment.router import router as payment_router
from app.modules.notification.router import router as notification_router
from app.modules.document.router import router as document_router
from app.modules.workflow.router import router as workflow_router
from app.modules.approval_rules.router import router as approval_rules_router
from app.modules.integration.router import router as integration_router
from app.modules.analytics.router import router as analytics_router
from app.modules.admin.router import router as admin_router
from app.auth.router import router as auth_router
# Note: audit has no router — it is a service-layer-only module

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up Procurement Portal...")
    # Setup RabbitMQ connection pool or other resources here
    connection = None
    try:
        connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
        app.state.rabbitmq = connection
        logger.info("Connected to RabbitMQ")
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ: {e}")
        
    yield
    # Shutdown
    logger.info("Shutting down Procurement Portal...")
    if connection:
        await connection.close()
        logger.info("Closed RabbitMQ connection")

def create_app() -> FastAPI:
    app = FastAPI(
        title="Procurement Portal",
        version=settings.APP_VERSION,
        lifespan=lifespan,
        openapi_url="/api/v1/openapi.json",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None
    )

    @app.get("/openapi.json", include_in_schema=False)
    async def openapi_alias():
        from fastapi.responses import JSONResponse
        return JSONResponse(app.openapi())

    # Middleware order: Outermost first -> SecurityHeaders -> Timing -> LoggingContext -> RequestID
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(TimingMiddleware)
    app.add_middleware(LoggingContextMiddleware)
    app.add_middleware(RequestIDMiddleware)

    if settings.ENVIRONMENT == "local":
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    register_exception_handlers(app)
    setup_telemetry(app)
    Instrumentator().instrument(app).expose(app)

    # Health endpoints
    @app.get("/health")
    async def health_check():
        return {"status": "ok", "version": settings.APP_VERSION, "timestamp": datetime.utcnow().isoformat()}

    @app.get("/health/ready")
    async def health_ready():
        checks: dict[str, str] = {}
        overall = "ok"
        try:
            from app.db.session import engine
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            checks["db"] = "ok"
        except Exception:
            checks["db"] = "failed"
            overall = "degraded"

        try:
            import redis.asyncio as aioredis
            r = aioredis.from_url(settings.REDIS_URL)
            await r.ping()
            await r.aclose()
            checks["redis"] = "ok"
        except Exception:
            checks["redis"] = "failed"
            overall = "degraded"

        try:
            if hasattr(app.state, "rabbitmq") and app.state.rabbitmq and not app.state.rabbitmq.is_closed:
                checks["rabbitmq"] = "ok"
            else:
                checks["rabbitmq"] = "unavailable"
                overall = "degraded"
        except Exception:
            checks["rabbitmq"] = "failed"
            overall = "degraded"

        try:
            from minio import Minio
            client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_USE_SSL,
            )
            client.list_buckets()
            checks["minio"] = "ok"
        except Exception:
            checks["minio"] = "failed"
            overall = "degraded"

        status_code = 200 if overall == "ok" else 503
        from starlette.responses import JSONResponse as StarletteJSONResponse
        return StarletteJSONResponse(
            status_code=status_code,
            content={
                "status": overall,
                "checks": checks,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @app.get("/health/live")
    async def health_live():
        return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

    # Routers
    api_router = APIRouter(prefix="/api/v1")
    api_router.include_router(organization_router, prefix="/organizations", tags=["Organization"])
    api_router.include_router(user_router, prefix="/users", tags=["User"])
    api_router.include_router(master_data_router, prefix="/master-data", tags=["Master Data"])
    api_router.include_router(vendor_router, prefix="/vendors", tags=["Vendor"])
    api_router.include_router(requisition_router, prefix="/requisitions", tags=["Requisition"])
    api_router.include_router(unmapped_pr_router, prefix="/unmapped-prs", tags=["Unmapped PR"])
    api_router.include_router(sourcing_router, prefix="/sourcing", tags=["Sourcing"])
    api_router.include_router(bid_router, prefix="/bids", tags=["Bid"])
    api_router.include_router(evaluation_router, prefix="/evaluations", tags=["Evaluation"])
    api_router.include_router(award_router, prefix="/awards", tags=["Award"])
    api_router.include_router(contract_router, prefix="/contracts", tags=["Contract"])
    api_router.include_router(purchase_order_router, prefix="/purchase-orders", tags=["Purchase Order"])
    api_router.include_router(grn_router, prefix="/grn", tags=["GRN"])
    api_router.include_router(invoice_router, prefix="/invoices", tags=["Invoice"])
    api_router.include_router(payment_router, prefix="/payments", tags=["Payment"])
    api_router.include_router(notification_router, prefix="/notifications", tags=["Notification"])
    api_router.include_router(document_router, prefix="/documents", tags=["Document"])
    api_router.include_router(workflow_router, prefix="/workflows", tags=["Workflow"])
    api_router.include_router(approval_rules_router, prefix="/approval-rules", tags=["Approval Rules"])
    api_router.include_router(integration_router, prefix="/integrations", tags=["Integration"])
    api_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
    api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])
    api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])

    app.include_router(api_router)

    return app

app = create_app()
