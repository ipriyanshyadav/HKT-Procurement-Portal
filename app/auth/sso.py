from __future__ import annotations
from typing import Optional
from uuid import UUID
from loguru import logger

# python3-saml is optional — graceful degradation if not installed
try:
    from onelogin.saml2.auth import OneLogin_Saml2_Auth
    from onelogin.saml2.settings import OneLogin_Saml2_Settings
    SAML_AVAILABLE = True
except ImportError:
    SAML_AVAILABLE = False
    logger.warning("python3-saml not installed — SAML SSO unavailable")

from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import Request


class SSOResult:
    def __init__(
        self,
        email: str,
        first_name: str,
        last_name: str,
        sso_provider: str,
        sso_subject_id: str,
        extra: Optional[dict] = None,
    ) -> None:
        self.email = email
        self.first_name = first_name
        self.last_name = last_name
        self.sso_provider = sso_provider
        self.sso_subject_id = sso_subject_id
        self.extra = extra or {}


async def get_saml_auth(request: Request, settings_dict: dict) -> Optional[object]:
    """Build OneLogin SAML auth object from request. Returns None if SAML unavailable."""
    if not SAML_AVAILABLE:
        return None
    prepared = {
        "https": "on" if request.url.scheme == "https" else "off",
        "http_host": request.headers.get("host", ""),
        "script_name": request.url.path,
        "get_data": dict(request.query_params),
        "post_data": await request.form(),
    }
    return OneLogin_Saml2_Auth(prepared, settings_dict)


async def handle_oidc_callback(
    code: str,
    state: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str,
    token_endpoint: str,
    userinfo_endpoint: str,
) -> SSOResult:
    """Exchange OIDC authorization code for tokens and fetch user info."""
    async with AsyncOAuth2Client(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
    ) as client:
        token = await client.fetch_token(
            token_endpoint,
            code=code,
            grant_type="authorization_code",
        )
        userinfo = await client.get(userinfo_endpoint)
        userinfo.raise_for_status()
        data = userinfo.json()

    email = data.get("email", "")
    sub = data.get("sub", "")
    given_name = data.get("given_name") or data.get("name", "").split(" ")[0]
    family_name = data.get("family_name") or " ".join(data.get("name", "").split(" ")[1:])

    return SSOResult(
        email=email,
        first_name=given_name,
        last_name=family_name,
        sso_provider="oidc",
        sso_subject_id=sub,
        extra=data,
    )
