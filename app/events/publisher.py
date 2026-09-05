from __future__ import annotations
import json
from typing import Optional, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


class OutboxPublisher:
    @staticmethod
    async def publish(
        session: AsyncSession,
        exchange_or_event: str = "procurement.events",
        routing_key: str = "",
        payload: Optional[dict[str, Any]] = None,
        org_id: Optional[UUID] = None,
        event_type: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        """
        CRITICAL: always called WITHIN caller's transaction (never standalone commit).
        Aligns with outbox_messages schema (exchange, routing_key, payload, headers, status).
        """
        payload_data = payload or {}
        actual_event = event_type or kwargs.get("event_type")

        # Determine exchange and routing_key depending on invocation pattern
        if actual_event:
            actual_exchange = kwargs.get("exchange", "procurement.events")
            actual_routing_key = routing_key or kwargs.get("routing_key", actual_event)
        else:
            actual_exchange = exchange_or_event
            actual_routing_key = routing_key
            actual_event = routing_key

        actual_org_id = org_id or kwargs.get("org_id")
        headers = kwargs.get("headers") or {}
        if actual_event:
            headers["event_type"] = actual_event

        stmt = text("""
            INSERT INTO outbox_messages (org_id, exchange, routing_key, payload, headers, status)
            VALUES (:org_id, :exchange, :routing_key, CAST(:payload AS jsonb), CAST(:headers AS jsonb), 'PENDING')
        """)
        await session.execute(stmt, {
            "org_id": actual_org_id,
            "exchange": actual_exchange,
            "routing_key": actual_routing_key,
            "payload": json.dumps(payload_data),
            "headers": json.dumps(headers),
        })


publisher = OutboxPublisher


