"""Unit tests for BrandingService — SPEC_27-F."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.modules.admin.branding_service import BrandingService
from app.modules.admin.branding_schemas import TenantBrandingUpdateRequest


@pytest.mark.asyncio
async def test_get_or_create_branding_creates_default():
    service = BrandingService()
    db = AsyncMock()
    org_id = uuid4()

    res = MagicMock()
    res.scalar_one_or_none.return_value = None
    db.execute.return_value = res

    branding = await service.get_or_create_branding(db, org_id)
    assert branding.org_id == org_id
    assert branding.primary_color == "#2563eb"
    assert db.add.called


@pytest.mark.asyncio
@patch("app.modules.admin.branding_service.audit_service.log", new_callable=AsyncMock)
async def test_update_branding(mock_audit):
    service = BrandingService()
    db = AsyncMock()
    org_id = uuid4()

    existing = MagicMock()
    existing.id = uuid4()
    existing.org_id = org_id
    existing.primary_color = "#2563eb"

    res = MagicMock()
    res.scalar_one_or_none.return_value = existing
    db.execute.return_value = res

    req = TenantBrandingUpdateRequest(
        primary_color="#10b981",
        company_display_name="Acme Procurement",
    )
    updated = await service.update_branding(db, org_id, uuid4(), req)
    assert updated.primary_color == "#10b981"
    assert updated.company_display_name == "Acme Procurement"
    mock_audit.assert_called_once()


@pytest.mark.asyncio
@patch("app.modules.admin.branding_service.audit_service.log", new_callable=AsyncMock)
async def test_verify_custom_domain(mock_audit):
    service = BrandingService()
    db = AsyncMock()
    org_id = uuid4()

    existing = MagicMock()
    existing.id = uuid4()
    existing.custom_domain = "procure.acme.com"
    existing.custom_domain_verified = False

    res = MagicMock()
    res.scalar_one_or_none.return_value = existing
    db.execute.return_value = res

    result = await service.verify_custom_domain(db, org_id, uuid4())
    assert result["verified"] is True
    assert result["domain"] == "procure.acme.com"
    assert existing.custom_domain_verified is True
    mock_audit.assert_called_once()


@pytest.mark.asyncio
async def test_get_public_branding_org_found():
    service = BrandingService()
    db = AsyncMock()

    org = MagicMock()
    org.id = uuid4()
    org.name = "Global Retail Corp"
    org.code = "global-retail"
    org.logo_url = "https://example.com/logo.png"

    branding = MagicMock()
    branding.logo_url = "https://example.com/branding-logo.png"
    branding.favicon_url = None
    branding.primary_color = "#6366f1"
    branding.company_display_name = "Global Retail S2P"
    branding.login_page_headline = "Global Retail Procurement"
    branding.login_page_subheading = "Welcome"

    res1 = MagicMock()
    res1.scalar_one_or_none.return_value = org

    res2 = MagicMock()
    res2.scalar_one_or_none.return_value = branding

    db.execute.side_effect = [res1, res2]

    public_data = await service.get_public_branding(db, "global-retail")
    assert public_data.company_display_name == "Global Retail S2P"
    assert public_data.primary_color == "#6366f1"
