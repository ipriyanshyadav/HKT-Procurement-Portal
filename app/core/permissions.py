from __future__ import annotations
from typing import Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.constants import PermissionCode

PERMANENTLY_DENIED_PERMISSIONS = {PermissionCode.RFQ_VIEW_BIDS_BEFORE_OPENING}

async def user_has_permission(db: AsyncSession, user_id: UUID, org_id: UUID, permission_code: str) -> bool:
    if permission_code in PERMANENTLY_DENIED_PERMISSIONS:
        return False
    # A placeholder for DB query logic checking role_permissions table
    # This logic goes to actual implementation, here we stub true
    return True
