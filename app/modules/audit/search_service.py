from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID
from loguru import logger
from pydantic import BaseModel, Field

from app.config import settings
from app.modules.audit.models import AuditLog

try:
    from elasticsearch import AsyncElasticsearch
except ImportError:
    AsyncElasticsearch = None  # type: ignore


class AuditSearchQuery(BaseModel):
    entity_type: Optional[str] = None
    action: Optional[str] = None
    actor_id: Optional[UUID] = None
    actor_email: Optional[str] = None
    entity_id: Optional[UUID] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class AuditSearchService:
    """Elasticsearch-backed audit log indexing and search service with SQL fallback."""

    def __init__(self, es_url: Optional[str] = None, enabled: Optional[bool] = None) -> None:
        self.url = es_url or getattr(settings, "ELASTICSEARCH_URL", "http://localhost:9200")
        self.index_prefix = getattr(settings, "ELASTICSEARCH_INDEX_PREFIX", "audit-logs")
        self._enabled: Optional[bool] = enabled
        self._es: Optional[Any] = None
        self._last_failure_time: float = 0.0
        self._failure_cooldown: float = 60.0

    @property
    def is_enabled(self) -> bool:
        if self._enabled is not None:
            return self._enabled
        return bool(getattr(settings, "ELASTICSEARCH_ENABLED", True))

    @is_enabled.setter
    def is_enabled(self, value: bool) -> None:
        self._enabled = value

    @property
    def is_available(self) -> bool:
        if not self.is_enabled:
            return False
        import time
        if time.time() - self._last_failure_time < self._failure_cooldown:
            return False
        return True

    def _mark_failure(self, exc: Exception, context: str) -> None:
        import time
        self._last_failure_time = time.time()
        logger.warning(
            f"Elasticsearch {context} failed (entering {self._failure_cooldown:.0f}s cooldown, falling back to SQL): {exc}"
        )

    def _mark_success(self) -> None:
        self._last_failure_time = 0.0

    @property
    def es(self) -> Optional[Any]:
        if not self.is_available:
            return None
        if self._es is None and AsyncElasticsearch is not None:
            try:
                self._es = AsyncElasticsearch(hosts=[self.url])
            except Exception as e:
                self._mark_failure(e, "client initialization")
                self._es = None
        return self._es

    async def close(self) -> None:
        if self._es is not None:
            try:
                await self._es.close()
            except Exception:
                pass
            self._es = None

    async def index_audit_log(self, log: AuditLog) -> None:
        """Index an audit log into the monthly rotated Elasticsearch index."""
        client = self.es
        if client is None:
            logger.debug("Elasticsearch client unavailable; skipping index_audit_log")
            return

        created_dt = log.created_at or datetime.now(timezone.utc)
        index_name = f"{self.index_prefix}-{created_dt.strftime('%Y.%m')}"

        entity_type_str = (
            log.entity_type.value if hasattr(log.entity_type, "value") else str(log.entity_type)
        )

        doc = {
            "id": str(log.id),
            "org_id": str(log.org_id),
            "entity_type": entity_type_str,
            "entity_id": str(log.entity_id),
            "action": str(log.action),
            "actor_id": str(log.actor_id) if log.actor_id else None,
            "actor_email": log.actor_email,
            "actor_ip": str(log.actor_ip) if log.actor_ip else None,
            "created_at": created_dt.isoformat(),
            "field_changes": log.field_changes or {},
            "old_values": log.old_values or {},
            "new_values": log.new_values or {},
            "metadata": log.metadata_ or {},
            "trace_id": log.trace_id,
        }

        try:
            await client.index(index=index_name, id=str(log.id), document=doc)
            self._mark_success()
            logger.debug(f"Audit log {log.id} indexed into {index_name}")
        except Exception as exc:
            self._mark_failure(exc, "indexing")

    @staticmethod
    def _exact_term(field: str, value: str) -> Dict[str, Any]:
        """Match either direct keyword or .keyword subfield for robust ES querying."""
        return {
            "bool": {
                "should": [
                    {"term": {field: value}},
                    {"term": {f"{field}.keyword": value}},
                ],
                "minimum_should_match": 1,
            }
        }

    async def search(
        self,
        org_id: UUID,
        query: AuditSearchQuery,
        db_fallback: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Search audit logs using Elasticsearch with SQL database fallback."""
        client = self.es
        if client is not None:
            try:
                must: List[Dict[str, Any]] = [self._exact_term("org_id", str(org_id))]

                if query.entity_type:
                    must.append(self._exact_term("entity_type", query.entity_type.upper()))
                if query.action:
                    must.append(self._exact_term("action", query.action.upper()))
                if query.actor_id:
                    must.append(self._exact_term("actor_id", str(query.actor_id)))
                if query.entity_id:
                    must.append(self._exact_term("entity_id", str(query.entity_id)))
                if query.actor_email:
                    must.append(self._exact_term("actor_email", query.actor_email.lower()))

                if query.date_from or query.date_to:
                    range_filter: Dict[str, str] = {}
                    if query.date_from:
                        range_filter["gte"] = query.date_from.isoformat()
                    if query.date_to:
                        range_filter["lte"] = query.date_to.isoformat()
                    must.append({"range": {"created_at": range_filter}})

                if query.search:
                    must.append({
                        "multi_match": {
                            "query": query.search,
                            "fields": ["action", "actor_email", "entity_type", "entity_id", "trace_id"],
                        }
                    })

                body = {
                    "query": {"bool": {"must": must}},
                    "sort": [{"created_at": {"order": "desc"}}],
                    "from": query.offset,
                    "size": query.limit,
                }

                result = await client.search(index=f"{self.index_prefix}-*", body=body)
                self._mark_success()
                total = result["hits"]["total"]["value"] if isinstance(result["hits"]["total"], dict) else result["hits"]["total"]
                items = [hit["_source"] for hit in result["hits"]["hits"]]

                return {
                    "items": items,
                    "total": total,
                    "page": query.page,
                    "page_size": query.page_size,
                    "source": "elasticsearch",
                }
            except Exception as es_err:
                self._mark_failure(es_err, "query")

        # Fallback to PostgreSQL via db_fallback
        if db_fallback is not None:
            return await self._sql_fallback_search(org_id, query, db_fallback)

        return {
            "items": [],
            "total": 0,
            "page": query.page,
            "page_size": query.page_size,
            "source": "empty",
        }

    async def _sql_fallback_search(
        self,
        org_id: UUID,
        query: AuditSearchQuery,
        db: Any,
    ) -> Dict[str, Any]:
        """Fallback querying PostgreSQL audit_logs directly."""
        from sqlalchemy import func, select
        from app.db.enums import AuditEntityTypeEnum

        stmt = select(AuditLog).where(AuditLog.org_id == org_id)

        if query.entity_type:
            try:
                e_enum = AuditEntityTypeEnum(query.entity_type)
                stmt = stmt.where(AuditLog.entity_type == e_enum)
            except ValueError:
                pass

        if query.action:
            stmt = stmt.where(AuditLog.action.ilike(f"%{query.action}%"))
        if query.actor_id:
            stmt = stmt.where(AuditLog.actor_id == query.actor_id)
        if query.actor_email:
            stmt = stmt.where(AuditLog.actor_email.ilike(f"%{query.actor_email}%"))
        if query.entity_id:
            stmt = stmt.where(AuditLog.entity_id == query.entity_id)
        if query.date_from:
            stmt = stmt.where(AuditLog.created_at >= query.date_from)
        if query.date_to:
            stmt = stmt.where(AuditLog.created_at <= query.date_to)
        if query.search:
            s = f"%{query.search}%"
            stmt = stmt.where(
                AuditLog.action.ilike(s) | AuditLog.actor_email.ilike(s) | AuditLog.trace_id.ilike(s)
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.execute(count_stmt)).scalar() or 0

        paginated_stmt = stmt.order_by(AuditLog.created_at.desc()).offset(query.offset).limit(query.limit)
        res = await db.execute(paginated_stmt)
        logs = res.scalars().all()

        items = [
            {
                "id": str(log.id),
                "org_id": str(log.org_id),
                "entity_type": log.entity_type.value if hasattr(log.entity_type, "value") else str(log.entity_type),
                "entity_id": str(log.entity_id),
                "action": log.action,
                "actor_id": str(log.actor_id) if log.actor_id else None,
                "actor_email": log.actor_email,
                "actor_ip": str(log.actor_ip) if log.actor_ip else None,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "field_changes": log.field_changes or {},
                "old_values": log.old_values or {},
                "new_values": log.new_values or {},
                "metadata": log.metadata_ or {},
                "trace_id": log.trace_id,
            }
            for log in logs
        ]

        return {
            "items": items,
            "total": total,
            "page": query.page,
            "page_size": query.page_size,
            "source": "database_fallback",
        }


audit_search_service = AuditSearchService()
