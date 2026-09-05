from __future__ import annotations
from typing import Optional, Any
from uuid import UUID
from loguru import logger

class WhatsAppChannel:
    """WhatsApp dispatch channel stub (Phase 3)."""

    async def send(
        self,
        to_phone: str,
        message: str = "",
        template_code: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
        org_id: Optional[UUID] = None,
    ) -> int:
        logger.warning(
            f"WhatsApp channel is Phase 3 — not implemented (recipient: {to_phone}, template: {template_code})"
        )
        return 202

whatsapp_channel = WhatsAppChannel()
