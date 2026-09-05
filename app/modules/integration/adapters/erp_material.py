from __future__ import annotations

from typing import Any, Dict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.master_data.models import Category


class ERPMaterialAdapter:
    """Handles mapping and lookup for Material Master & Commodity items."""

    async def lookup_material(
        self, db: AsyncSession, material_code: str, org_id: UUID
    ) -> Dict[str, Any]:
        stmt = select(Category).where(
            Category.code == material_code,
            Category.org_id == org_id,
            Category.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        cat = result.scalar_one_or_none()

        if cat:
            return {
                "material_code": cat.code,
                "name": cat.name,
                "description": cat.description,
                "hsn_code": getattr(cat, "hsn_code", None),
                "is_active": cat.is_active,
                "found_in": "PORTAL_CACHE",
            }

        return {
            "material_code": material_code,
            "name": f"Material {material_code}",
            "description": f"Master material record for {material_code}",
            "hsn_code": "998311",
            "is_active": True,
            "found_in": "ERP_LOOKUP",
        }
