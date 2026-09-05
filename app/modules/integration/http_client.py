from __future__ import annotations

import ipaddress
from typing import Any, List, Optional, Set
from urllib.parse import urlparse
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError


# Reserved, loopback, private, and metadata IP networks
BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # IPv4 loopback
    ipaddress.ip_network("10.0.0.0/8"),       # RFC 1918 Private
    ipaddress.ip_network("172.16.0.0/12"),    # RFC 1918 Private
    ipaddress.ip_network("192.168.0.0/16"),   # RFC 1918 Private
    ipaddress.ip_network("169.254.0.0/16"),   # IPv4 Link-local / Cloud Metadata
    ipaddress.ip_network("0.0.0.0/8"),        # Current network
    ipaddress.ip_network("::1/128"),          # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),        # IPv6 link-local
]

BLOCKED_HOSTNAMES = {"localhost", "metadata.google.internal", "instance-data"}


class SafeHTTPClient:
    """HTTP client with strict SSRF prevention and tenant-scoped domain allowlisting."""

    def __init__(
        self,
        allowed_domains: Optional[List[str] | Set[str]] = None,
        timeout: float = 30.0,
    ) -> None:
        self.allowed_domains: Set[str] = {
            d.strip().lower() for d in (allowed_domains or []) if d and d.strip()
        }
        self.timeout: float = timeout

    def _is_ip_blocked(self, host: str) -> bool:
        """Check if hostname is an IP belonging to private or metadata subnets."""
        try:
            ip = ipaddress.ip_address(host)
            return any(ip in net for net in BLOCKED_IP_NETWORKS)
        except ValueError:
            return False

    def validate_url(self, url: str) -> str:
        """Validate URL against scheme, loopback/private IPs, and allowed domain list."""
        if not url or not isinstance(url, str):
            raise ForbiddenError("SSRF_BLOCKED: URL cannot be empty", code="SSRF_BLOCKED")

        parsed = urlparse(url.strip())
        scheme = (parsed.scheme or "").lower()
        if scheme not in ("http", "https"):
            raise ForbiddenError(
                f"SSRF_BLOCKED: Unsupported URL scheme '{scheme}'. Only HTTP and HTTPS are allowed.",
                code="SSRF_BLOCKED",
            )

        hostname = (parsed.hostname or "").lower().strip()
        if not hostname:
            raise ForbiddenError(
                "SSRF_BLOCKED: URL must contain a valid hostname.",
                code="SSRF_BLOCKED",
            )

        # Block loopback, link-local, private hostnames & IPs unconditionally
        if hostname in BLOCKED_HOSTNAMES or self._is_ip_blocked(hostname):
            raise ForbiddenError(
                f"SSRF_BLOCKED: Target host '{hostname}' is a restricted local or metadata address.",
                code="SSRF_BLOCKED",
            )

        # Match against allowlist
        if not self._is_domain_allowed(hostname):
            raise ForbiddenError(
                f"SSRF_BLOCKED: Domain '{hostname}' not in integration allowlist. Add via tenant settings.",
                code="SSRF_BLOCKED",
            )

        return url

    def _is_domain_allowed(self, hostname: str) -> bool:
        """Check if hostname matches exact domain or allowed wildcard (e.g. *.corp.com)."""
        if hostname in self.allowed_domains:
            return True

        for allowed in self.allowed_domains:
            if allowed.startswith("*."):
                suffix = allowed[1:]  # e.g. .corp.com
                if hostname.endswith(suffix) and len(hostname) > len(suffix):
                    return True
            elif allowed.startswith("."):
                if hostname.endswith(allowed):
                    return True
        return False

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        self.validate_url(url)
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=False) as client:
            return await client.get(url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        self.validate_url(url)
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=False) as client:
            return await client.post(url, **kwargs)

    async def put(self, url: str, **kwargs: Any) -> httpx.Response:
        self.validate_url(url)
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=False) as client:
            return await client.put(url, **kwargs)

    async def patch(self, url: str, **kwargs: Any) -> httpx.Response:
        self.validate_url(url)
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=False) as client:
            return await client.patch(url, **kwargs)

    async def delete(self, url: str, **kwargs: Any) -> httpx.Response:
        self.validate_url(url)
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=False) as client:
            return await client.delete(url, **kwargs)

    @classmethod
    async def for_org(cls, db: AsyncSession, org_id: UUID, timeout: float = 30.0) -> SafeHTTPClient:
        """Factory method to instantiate a SafeHTTPClient populated with tenant allowed domains."""
        from app.modules.integration.models import TenantSetting

        allowed: Set[str] = set()
        stmt = select(TenantSetting).where(
            TenantSetting.org_id == org_id,
            TenantSetting.setting_key.in_(["allowed_domains", "erp_config"]),
            TenantSetting.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()

        for r in rows:
            val = r.setting_value or {}
            if r.setting_key == "allowed_domains":
                domains = val.get("domains", []) if isinstance(val, dict) else val
                if isinstance(domains, list):
                    allowed.update(domains)
            elif r.setting_key == "erp_config":
                endpoint = val.get("endpoint_url")
                if endpoint and isinstance(endpoint, str):
                    try:
                        parsed = urlparse(endpoint)
                        if parsed.hostname:
                            allowed.add(parsed.hostname)
                    except Exception:
                        pass

        return cls(allowed_domains=list(allowed), timeout=timeout)
