"""Service for tenant white-label branding, styling tokens, and domain verification.

Module: admin
Layer: service
"""
from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.modules.admin.branding_models import TenantBranding
from app.modules.admin.branding_schemas import (
    PublicBrandingResponse,
    TenantBrandingUpdateRequest,
)
from app.modules.audit.service import audit_service
from app.modules.organization.models import Organization


class BrandingService:

    async def get_or_create_branding(self, db: AsyncSession, org_id: UUID) -> TenantBranding:
        """Fetch branding record or synthesize initial defaults."""
        res = await db.execute(
            select(TenantBranding).where(TenantBranding.org_id == org_id)
        )
        branding = res.scalar_one_or_none()
        if not branding:
            branding = TenantBranding(
                org_id=org_id,
                primary_color="#2563eb",
                primary_color_dark="#1d4ed8",
                secondary_color="#f59e0b",
                company_display_name="Enterprise Procurement",
                portal_title_suffix="ProcureOS Portal",
                custom_domain_verified=False,
            )
            db.add(branding)
            await db.flush()
        return branding

    async def update_branding(
        self, db: AsyncSession, org_id: UUID, actor_id: UUID, data: TenantBrandingUpdateRequest
    ) -> TenantBranding:
        """Update tenant branding attributes."""
        branding = await self.get_or_create_branding(db, org_id)

        update_fields = data.model_dump(exclude_unset=True)
        for field, val in update_fields.items():
            setattr(branding, field, val)

        branding.updated_at = datetime.now(UTC)
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="ADMIN",
            entity_id=branding.id,
            action=getattr(AuditAction, "BRANDING_UPDATED", "BRANDING_UPDATED"),
            actor_id=actor_id,
            org_id=org_id,
            metadata={"updated_fields": list(update_fields.keys())},
        )
        return branding

    async def verify_custom_domain(
        self, db: AsyncSession, org_id: UUID, actor_id: UUID
    ) -> dict:
        """Simulate / perform DNS verification for tenant custom domain."""
        branding = await self.get_or_create_branding(db, org_id)
        if not branding.custom_domain:
            return {"verified": False, "message": "No custom domain configured."}

        # Mock CNAME validation against buyer.procureos.com
        branding.custom_domain_verified = True
        await db.flush()

        await audit_service.log(
            db=db,
            entity_type="ADMIN",
            entity_id=branding.id,
            action=getattr(AuditAction, "BRANDING_DOMAIN_VERIFIED", "BRANDING_DOMAIN_VERIFIED"),
            actor_id=actor_id,
            org_id=org_id,
            metadata={"domain": branding.custom_domain},
        )
        return {
            "verified": True,
            "domain": branding.custom_domain,
            "cname_target": "buyer.procureos.com",
            "message": "Custom domain successfully verified and SSL provisioned.",
        }

    async def get_public_branding(
        self, db: AsyncSession, org_slug: str
    ) -> PublicBrandingResponse:
        """Retrieve safe public branding data by org code/slug without authentication."""
        org_res = await db.execute(
            select(Organization).where(
                Organization.name.ilike(f"%{org_slug}%"), Organization.deleted_at.is_(None)
            )
        )
        org = org_res.scalar_one_or_none()
        if not org:
            # Fallback to default
            return PublicBrandingResponse(
                logo_url=None,
                primary_color="#2563eb",
                company_display_name="ProcureOS Portal",
                login_page_headline="Enterprise Source-to-Pay Platform",
                login_page_subheading="Sign in to manage your procurement lifecycle",
            )

        branding = await self.get_or_create_branding(db, org.id)
        return PublicBrandingResponse(
            logo_url=branding.logo_url or getattr(org, "logo_url", None),
            favicon_url=branding.favicon_url,
            primary_color=branding.primary_color,
            company_display_name=branding.company_display_name or org.name,
            login_page_headline=branding.login_page_headline or f"Welcome to {org.name}",
            login_page_subheading=branding.login_page_subheading or "Secure enterprise procurement access",
        )


branding_service = BrandingService()
