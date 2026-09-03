from __future__ import annotations
import json
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

class OutboxPublisher:
    @staticmethod
    async def publish(session: AsyncSession, event_type: str, routing_key: str, payload: dict, org_id: UUID) -> None:
        """
        CRITICAL: always called WITHIN caller's transaction (never standalone commit)
        """
        stmt = text("""
            INSERT INTO outbox_messages (org_id, event_type, routing_key, payload, status)
            VALUES (:org_id, :event_type, :routing_key, :payload, 'PENDING')
        """)
        await session.execute(stmt, {
            "org_id": org_id,
            "event_type": event_type,
            "routing_key": routing_key,
            "payload": json.dumps(payload)
        })
