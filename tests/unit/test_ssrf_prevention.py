from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.core.exceptions import ForbiddenError
from app.modules.integration.http_client import SafeHTTPClient
from app.modules.integration.models import TenantSetting


@pytest.mark.asyncio
async def test_ssrf_blocked_unknown_domain():
    """Unregistered domain raises ForbiddenError matching SSRF_BLOCKED."""
    client = SafeHTTPClient(allowed_domains=["erp.company.com"])
    with pytest.raises(ForbiddenError, match="SSRF_BLOCKED"):
        await client.get("https://evil.com/steal")


@pytest.mark.asyncio
async def test_ssrf_blocked_cloud_metadata_ip():
    """Cloud metadata IP (169.254.169.254) is blocked unconditionally."""
    client = SafeHTTPClient(allowed_domains=["169.254.169.254", "erp.company.com"])
    with pytest.raises(ForbiddenError, match="SSRF_BLOCKED"):
        await client.get("http://169.254.169.254/latest/meta-data")


def test_ssrf_blocked_localhost_and_loopback():
    """Localhost and IPv4/IPv6 loopback targets are rejected."""
    client = SafeHTTPClient(allowed_domains=["localhost", "127.0.0.1", "erp.company.com"])
    for blocked_target in [
        "http://localhost:8080/admin",
        "http://127.0.0.1:9000",
        "http://127.0.1.1:8000",
        "http://0.0.0.0:5000",
        "http://[::1]:8000/metrics",
    ]:
        with pytest.raises(ForbiddenError, match="SSRF_BLOCKED"):
            client.validate_url(blocked_target)


def test_ssrf_blocked_private_subnets():
    """RFC 1918 internal subnets (10.x, 172.16.x, 192.168.x) are blocked."""
    client = SafeHTTPClient(allowed_domains=["10.0.0.1", "192.168.1.1"])
    for private_url in [
        "http://10.0.0.5/internal/status",
        "http://172.16.1.50/vault",
        "http://192.168.1.100/admin",
    ]:
        with pytest.raises(ForbiddenError, match="SSRF_BLOCKED"):
            client.validate_url(private_url)


def test_ssrf_blocked_non_http_schemes():
    """Arbitrary non-HTTP protocols (file, ftp, gopher) are rejected."""
    client = SafeHTTPClient(allowed_domains=["erp.company.com"])
    for bad_scheme_url in [
        "file:///etc/passwd",
        "ftp://ftp.company.com/data",
        "gopher://gopher.floodgap.com",
    ]:
        with pytest.raises(ForbiddenError, match="SSRF_BLOCKED"):
            client.validate_url(bad_scheme_url)


def test_ssrf_allowed_domain_and_wildcards():
    """Allowlisted domains and wildcard subdomains pass validation."""
    client = SafeHTTPClient(allowed_domains=["erp.company.com", "*.internal.corp"])
    assert client.validate_url("https://erp.company.com/api/v1/orders") == "https://erp.company.com/api/v1/orders"
    assert client.validate_url("https://sap.internal.corp/odata") == "https://sap.internal.corp/odata"
    assert client.validate_url("https://sub.sap.internal.corp/feed") == "https://sub.sap.internal.corp/feed"

    with pytest.raises(ForbiddenError, match="SSRF_BLOCKED"):
        client.validate_url("https://notallowed.corp/data")


@pytest.mark.asyncio
async def test_ssrf_client_for_org_factory():
    """SafeHTTPClient.for_org populates allowlist from tenant_settings."""
    org_id = uuid4()
    mock_setting_domains = MagicMock(spec=TenantSetting)
    mock_setting_domains.setting_key = "allowed_domains"
    mock_setting_domains.setting_value = {"domains": ["erp.tenant.com", "gateway.sap.corp"]}

    mock_setting_erp = MagicMock(spec=TenantSetting)
    mock_setting_erp.setting_key = "erp_config"
    mock_setting_erp.setting_value = {"endpoint_url": "https://custom-erp.company.com/api"}

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_setting_domains, mock_setting_erp]
    mock_db.execute.return_value = mock_result

    client = await SafeHTTPClient.for_org(mock_db, org_id)
    assert "erp.tenant.com" in client.allowed_domains
    assert "gateway.sap.corp" in client.allowed_domains
    assert "custom-erp.company.com" in client.allowed_domains
