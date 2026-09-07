from __future__ import annotations
import json
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from loguru import logger
import httpx
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.core.exceptions import AppException, ForbiddenError
from app.db.enums import UserStatusEnum
from app.modules.user.models import User, Role, UserRoleAssignment
from app.modules.audit.service import audit_service
from app.auth.service import auth_service, LoginResult

try:
    from onelogin.saml2.auth import OneLogin_Saml2_Auth
    from onelogin.saml2.settings import OneLogin_Saml2_Settings
    SAML_AVAILABLE = True
except ImportError:
    SAML_AVAILABLE = False
    logger.info("python3-saml not installed — SAML SSO unavailable")


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
        self.email = email.lower().strip()
        self.first_name = first_name or "SSO"
        self.last_name = last_name or "User"
        self.sso_provider = sso_provider
        self.sso_subject_id = sso_subject_id
        self.extra = extra or {}


_OIDC_CACHE: Dict[str, Dict[str, Any]] = {}


async def get_oidc_endpoints(discovery_url: Optional[str] = None) -> Dict[str, str]:
    url = (discovery_url or settings.OIDC_DISCOVERY_URL).rstrip("/")
    if not url:
        return {
            "authorization_endpoint": settings.OIDC_AUTHORIZATION_URL,
            "token_endpoint": settings.OIDC_TOKEN_URL,
            "userinfo_endpoint": settings.OIDC_USERINFO_URL,
        }

    if url in _OIDC_CACHE:
        return _OIDC_CACHE[url]

    well_known = f"{url}/.well-known/openid-configuration"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(well_known)
            resp.raise_for_status()
            data = resp.json()
            endpoints = {
                "authorization_endpoint": data.get("authorization_endpoint", settings.OIDC_AUTHORIZATION_URL),
                "token_endpoint": data.get("token_endpoint", settings.OIDC_TOKEN_URL),
                "userinfo_endpoint": data.get("userinfo_endpoint", settings.OIDC_USERINFO_URL),
            }
            _OIDC_CACHE[url] = endpoints
            return endpoints
    except Exception as exc:
        logger.warning(f"OIDC discovery failed for {well_known}: {exc}. Using configured settings.")
        return {
            "authorization_endpoint": settings.OIDC_AUTHORIZATION_URL,
            "token_endpoint": settings.OIDC_TOKEN_URL,
            "userinfo_endpoint": settings.OIDC_USERINFO_URL,
        }


async def build_oidc_auth_url(state: str, redirect_uri: Optional[str] = None) -> str:
    endpoints = await get_oidc_endpoints()
    auth_ep = endpoints.get("authorization_endpoint")
    if not auth_ep:
        raise AppException("OIDC authorization endpoint is not configured", "SSO_NOT_CONFIGURED")

    client_id = settings.OIDC_CLIENT_ID or "procurement-portal"
    redir = redirect_uri or settings.OIDC_REDIRECT_URI
    scope = "openid profile email"

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redir,
        "scope": scope,
        "state": state,
    }
    encoded = httpx.QueryParams(params)
    return f"{auth_ep}?{encoded}"


async def handle_oidc_callback(
    code: str,
    state: str,
    redirect_uri: Optional[str] = None,
) -> SSOResult:
    endpoints = await get_oidc_endpoints()
    token_ep = endpoints.get("token_endpoint")
    userinfo_ep = endpoints.get("userinfo_endpoint")

    if not token_ep or not userinfo_ep:
        raise AppException("OIDC token/userinfo endpoints not configured", "SSO_NOT_CONFIGURED")

    redir = redirect_uri or settings.OIDC_REDIRECT_URI
    client_id = settings.OIDC_CLIENT_ID or "procurement-portal"
    client_secret = settings.OIDC_CLIENT_SECRET or ""

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Code exchange
        token_resp = await client.post(
            token_ep,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redir,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={"Accept": "application/json"},
        )
        token_resp.raise_for_status()
        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        if not access_token:
            raise AppException("Failed to acquire OIDC access token", "SSO_TOKEN_EXCHANGE_FAILED")

        # Fetch userinfo
        userinfo_resp = await client.get(
            userinfo_ep,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        userinfo_resp.raise_for_status()
        data = userinfo_resp.json()

    email = data.get("email") or data.get("preferred_username") or ""
    sub = data.get("sub") or data.get("oid") or str(uuid4())
    given_name = data.get("given_name") or data.get("name", "").split(" ")[0] or "SSO"
    family_name = data.get("family_name") or " ".join(data.get("name", "").split(" ")[1:]) or "User"

    return SSOResult(
        email=email,
        first_name=given_name,
        last_name=family_name,
        sso_provider="oidc",
        sso_subject_id=sub,
        extra=data,
    )


def build_saml_settings(org_id: UUID) -> Dict[str, Any]:
    return {
        "strict": True,
        "debug": settings.DEBUG,
        "sp": {
            "entityId": settings.SAML_SP_ENTITY_ID,
            "assertionConsumerService": {
                "url": settings.SAML_SP_ACS_URL,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
            },
        },
        "idp": {
            "entityId": settings.SAML_IDP_ENTITY_ID or f"https://idp.example.com/{org_id}",
            "singleSignOnService": {
                "url": settings.SAML_IDP_SSO_URL or f"https://idp.example.com/{org_id}/sso",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            },
            "x509cert": settings.SAML_IDP_CERTIFICATE or "",
        },
    }


async def get_saml_auth(request: Request, org_id: UUID) -> Optional[object]:
    if not SAML_AVAILABLE:
        return None
    saml_settings = build_saml_settings(org_id)
    form_data = await request.form()
    prepared = {
        "https": "on" if request.url.scheme == "https" else "off",
        "http_host": request.headers.get("host", "localhost:8000"),
        "script_name": request.url.path,
        "get_data": dict(request.query_params),
        "post_data": dict(form_data),
    }
    return OneLogin_Saml2_Auth(prepared, saml_settings)


async def provision_or_login_sso_user(
    db: AsyncSession,
    sso: SSOResult,
    org_id: UUID,
) -> LoginResult:
    """
    Just-In-Time (JIT) provisioning and authentication for SSO federated users.
    If user does not exist in the org, provisions with default REQUESTOR role.
    """
    stmt = (
        select(User)
        .where(User.email == sso.email)
        .where(User.org_id == org_id)
        .where(User.deleted_at.is_(None))
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        # JIT Provisioning
        user = User(
            org_id=org_id,
            email=sso.email,
            first_name=sso.first_name,
            last_name=sso.last_name,
            status=UserStatusEnum.ACTIVE,
            is_supplier_user=False,
            mfa_enabled=False,
        )
        db.add(user)
        await db.flush()

        # Assign default SSO role (e.g. REQUESTOR)
        role_stmt = select(Role).where(Role.code == settings.DEFAULT_SSO_ROLE_CODE).where(Role.deleted_at.is_(None))
        role_res = await db.execute(role_stmt)
        requestor_role = role_res.scalar_one_or_none()
        if requestor_role:
            assignment = UserRoleAssignment(
                org_id=org_id,
                user_id=user.id,
                role_id=requestor_role.id,
                is_active=True,
            )
            db.add(assignment)
            await db.flush()

        logger.info(f"JIT provisioned SSO user {sso.email} in org {org_id}")
        await audit_service.log(
            db,
            entity_type="USER",
            entity_id=user.id,
            action="USER_JIT_PROVISIONED",
            actor_id=user.id,
            org_id=org_id,
            new_values={"provider": sso.sso_provider, "email": sso.email},
        )
    elif user.status != UserStatusEnum.ACTIVE:
        raise ForbiddenError("USER_INACTIVE", "User account is inactive or suspended")

    login_result = await auth_service._issue_tokens(db, user, org_id)
    await audit_service.log(
        db,
        entity_type="AUTH",
        entity_id=user.id,
        action="AUTH_SSO_LOGIN",
        actor_id=user.id,
        org_id=org_id,
        new_values={"provider": sso.sso_provider, "subject_id": sso.sso_subject_id},
    )
    return login_result
