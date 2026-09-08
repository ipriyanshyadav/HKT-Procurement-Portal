from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import async_session_factory
from app.modules.ticket.models import Ticket, TicketComment

try:
    from elasticsearch import AsyncElasticsearch
except ImportError:
    AsyncElasticsearch = None  # type: ignore


class TicketSearchService:
    def __init__(self, es_url: str | None = None, enabled: bool | None = None) -> None:
        self.url = es_url or getattr(settings, "ELASTICSEARCH_URL", "http://localhost:9200")
        self._enabled: bool | None = enabled
        self._es: Any | None = None
        self._last_failure_time: float = 0.0
        self._failure_cooldown: float = 60.0

    @property
    def is_enabled(self) -> bool:
        if self._enabled is not None:
            return self._enabled
        return bool(getattr(settings, "ELASTICSEARCH_ENABLED", True))

    @property
    def es(self) -> Any | None:
        if not self.is_enabled or AsyncElasticsearch is None:
            return None
        if time.time() - self._last_failure_time < self._failure_cooldown:
            return None
        if self._es is None:
            try:
                self._es = AsyncElasticsearch(
                    self.url,
                    request_timeout=5,
                    max_retries=1,
                    retry_on_timeout=False,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize Elasticsearch client: {e}")
                self._last_failure_time = time.time()
                return None
        return self._es

    async def close(self) -> None:
        if self._es is not None:
            try:
                await self._es.close()
            except Exception as e:
                logger.debug("Error closing Elasticsearch client: {}", e)
            self._es = None

    def _get_index_name(self, dt: datetime | None = None) -> str:
        d = dt or datetime.now(UTC)
        return f"tickets-{d.strftime('%Y.%m')}"

    async def index_ticket(self, ticket: Ticket) -> None:
        client = self.es
        if not client:
            return
        index_name = self._get_index_name(ticket.created_at)
        doc = {
            "ticket_id": str(ticket.id),
            "org_id": str(ticket.org_id),
            "ticket_number": ticket.ticket_number,
            "title": ticket.title,
            "description": ticket.description,
            "ticket_type": str(ticket.ticket_type),
            "priority": str(ticket.priority),
            "status": str(ticket.status),
            "category": ticket.category,
            "entity_type": ticket.entity_type,
            "entity_id": str(ticket.entity_id) if ticket.entity_id else None,
            "entity_number": ticket.entity_number,
            "tags": list(ticket.tags or []),
            "is_private": bool(ticket.is_private),
            "raised_by": str(ticket.raised_by),
            "assigned_to": str(ticket.assigned_to) if ticket.assigned_to else None,
            "comments_text": "",
            "created_at": ticket.created_at.isoformat() if ticket.created_at else datetime.utcnow().isoformat(),
        }
        try:
            await client.index(index=index_name, id=str(ticket.id), document=doc)
        except Exception as e:
            logger.warning(f"Failed to index ticket {ticket.id} into ES: {e}")
            self._last_failure_time = time.time()

    async def index_comment(self, comment: TicketComment, ticket: Ticket) -> None:
        client = self.es
        if not client:
            return
        index_name = self._get_index_name(ticket.created_at)
        try:
            # Append comment content to existing document comments_text
            await client.update(
                index=index_name,
                id=str(ticket.id),
                script={
                    "source": (
                        "ctx._source.comments_text = (ctx._source.comments_text == null ? '' : "
                        "ctx._source.comments_text + ' ') + params.new_comment"
                    ),
                    "params": {"new_comment": comment.content},
                },
                upsert={
                    "ticket_id": str(ticket.id),
                    "org_id": str(ticket.org_id),
                    "ticket_number": ticket.ticket_number,
                    "title": ticket.title,
                    "description": ticket.description,
                    "comments_text": comment.content,
                    "is_private": bool(ticket.is_private),
                    "raised_by": str(ticket.raised_by),
                    "assigned_to": str(ticket.assigned_to) if ticket.assigned_to else None,
                },
            )
        except Exception as e:
            logger.warning(f"Failed to update comment in ES for ticket {ticket.id}: {e}")
            self._last_failure_time = time.time()

    async def search(
        self,
        org_id: UUID,
        query: str,
        filters: dict | None = None,
        actor_id: UUID | None = None,
        is_admin: bool = False,
        db: AsyncSession | None = None,
    ) -> list[dict[str, Any]]:
        client = self.es
        filters = filters or {}

        if client:
            must_clauses: list[dict[str, Any]] = [
                {"term": {"org_id": str(org_id)}},
                {
                    "multi_match": {
                        "query": query,
                        "fields": [
                            "ticket_number^5",
                            "entity_number^4",
                            "title^3",
                            "description^2",
                            "comments_text",
                            "tags",
                        ],
                        "operator": "or",
                    }
                },
            ]

            if not is_admin and actor_id:
                # Suppress private tickets not owned/assigned to actor
                must_clauses.append(
                    {
                        "bool": {
                            "should": [
                                {"term": {"is_private": False}},
                                {"term": {"raised_by": str(actor_id)}},
                                {"term": {"assigned_to": str(actor_id)}},
                            ],
                            "minimum_should_match": 1,
                        }
                    }
                )

            if filters.get("status"):
                must_clauses.append({"term": {"status": filters["status"]}})
            if filters.get("priority"):
                must_clauses.append({"term": {"priority": filters["priority"]}})
            if filters.get("ticket_type"):
                must_clauses.append({"term": {"ticket_type": filters["ticket_type"]}})

            body = {
                "query": {"bool": {"must": must_clauses}},
                "highlight": {
                    "fields": {
                        "title": {},
                        "description": {},
                        "comments_text": {},
                    }
                },
                "size": 50,
            }
            try:
                res = await client.search(index="tickets-*", body=body)
                hits = res.get("hits", {}).get("hits", [])
                results = []
                for h in hits:
                    source = h["_source"]
                    source["highlights"] = h.get("highlight", {})
                    results.append(source)
                return results
            except Exception as e:
                logger.warning(f"ES search failed, falling back to SQL: {e}")
                self._last_failure_time = time.time()

        # Database fallback search
        return await self._sql_fallback_search(org_id, query, filters, actor_id, is_admin, db=db)

    async def _execute_sql_search(
        self,
        session: AsyncSession,
        org_id: UUID,
        query: str,
        filters: dict,
        actor_id: UUID | None = None,
        is_admin: bool = False,
    ) -> list[dict[str, Any]]:
        term = f"%{query}%"
        stmt = (
            select(Ticket)
            .where(Ticket.org_id == org_id)
            .where(Ticket.deleted_at.is_(None))
            .where(
                or_(
                    Ticket.ticket_number.ilike(term),
                    Ticket.title.ilike(term),
                    Ticket.description.ilike(term),
                    Ticket.entity_number.ilike(term),
                )
            )
        )
        if not is_admin and actor_id:
            stmt = stmt.where(
                or_(
                    Ticket.is_private.is_(False),
                    Ticket.raised_by == actor_id,
                    Ticket.assigned_to == actor_id,
                )
            )
        if filters.get("status"):
            stmt = stmt.where(Ticket.status == filters["status"])
        if filters.get("priority"):
            stmt = stmt.where(Ticket.priority == filters["priority"])
        if filters.get("ticket_type"):
            stmt = stmt.where(Ticket.ticket_type == filters["ticket_type"])

        stmt = stmt.order_by(Ticket.created_at.desc()).limit(50)
        rows = (await session.execute(stmt)).scalars().all()

        results = []
        for t in rows:
            results.append(
                {
                    "ticket_id": str(t.id),
                    "org_id": str(t.org_id),
                    "ticket_number": t.ticket_number,
                    "title": t.title,
                    "description": t.description,
                    "ticket_type": str(t.ticket_type),
                    "priority": str(t.priority),
                    "status": str(t.status),
                    "category": t.category,
                    "entity_type": t.entity_type,
                    "entity_id": str(t.entity_id) if t.entity_id else None,
                    "entity_number": t.entity_number,
                    "tags": list(t.tags or []),
                    "is_private": bool(t.is_private),
                    "raised_by": str(t.raised_by),
                    "assigned_to": str(t.assigned_to) if t.assigned_to else None,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "highlights": {
                        "title": [t.title] if query.lower() in t.title.lower() else [],
                        "description": [t.description] if query.lower() in t.description.lower() else [],
                    },
                }
            )
        return results

    async def _sql_fallback_search(
        self,
        org_id: UUID,
        query: str,
        filters: dict,
        actor_id: UUID | None = None,
        is_admin: bool = False,
        db: AsyncSession | None = None,
    ) -> list[dict[str, Any]]:
        if db is not None:
            return await self._execute_sql_search(db, org_id, query, filters, actor_id, is_admin)
        async with async_session_factory() as session:
            return await self._execute_sql_search(session, org_id, query, filters, actor_id, is_admin)
