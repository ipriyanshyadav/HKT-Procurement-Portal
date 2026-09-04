from __future__ import annotations
from typing import Optional, Dict, Any, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import (
    LoginRequest,
    MFAVerifyRequest,
    MFAConfirmRequest,
)
from app.auth.service import auth_service
from app.auth.dependencies import get_current_user
from app.auth.sso import handle_oidc_callback, SAML_AVAILABLE
from app.config import settings
from app.core.exceptions import AppException
from app.db.session import get_db
from app.modules.user.models import User

router = APIRouter()


def _get_portal(request: Request) -> Optional[str]:
    portal = request.headers.get("x-portal-id", "").strip().lower()
    if not portal:
        origin = request.headers.get("origin") or request.headers.get("referer") or ""
        if ":3001" in origin:
            portal = "supplier"
        elif ":3002" in origin:
            portal = "admin"
        elif ":3000" in origin:
            portal = "buyer"
    return portal if portal in ("buyer", "supplier", "admin") else None


def _get_cookie_key(portal: Optional[str]) -> str:
    return f"refresh_token_{portal}" if portal in ("buyer", "supplier", "admin") else "refresh_token"


def _get_refresh_token_and_key(request: Request) -> tuple[str, str, Optional[str]]:
    portal = _get_portal(request)
    cookie_key = _get_cookie_key(portal)
    token = request.cookies.get(cookie_key)
    if not token and cookie_key != "refresh_token":
        token = request.cookies.get("refresh_token")
        if token:
            cookie_key = "refresh_token"
    return token or "", cookie_key, portal


@router.post("/login")
async def login(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """POST /api/v1/auth/login — password login. Returns access_token; sets portal-scoped refresh_token cookie."""
    portal = _get_portal(request)
    cookie_key = _get_cookie_key(portal)
    result = await auth_service.login(db, data.email, data.password, data.org_id, portal_type=portal)
    await db.commit()
    response = JSONResponse(content=result.to_response())
    if result.refresh_token:
        response.set_cookie(
            key=cookie_key,
            value=result.refresh_token,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path="/",
            max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS * 3600,
        )
    return response


@router.post("/refresh")
async def refresh(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """POST /api/v1/auth/refresh — reads refresh_token from portal-scoped httpOnly cookie."""
    refresh_token, cookie_key, portal = _get_refresh_token_and_key(request)
    if not refresh_token:
        raise AppException("Refresh token not found in cookie", "MISSING_REFRESH_TOKEN")
    result = await auth_service.refresh_token(db, refresh_token, portal_type=portal)
    await db.commit()
    response = JSONResponse(content={"data": {"access_token": result.access_token}})
    response.set_cookie(
        key=cookie_key,
        value=result.refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS * 3600,
    )
    return response


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """POST /api/v1/auth/logout — revokes session and clears portal-scoped refresh_token cookie."""
    refresh_token, cookie_key, _ = _get_refresh_token_and_key(request)
    if refresh_token:
        await auth_service.logout(db, current_user, refresh_token)
        await db.commit()
    response = JSONResponse(content={"data": {"message": "Logged out successfully"}})
    response.delete_cookie(
        cookie_key,
        path="/",
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )
    if cookie_key != "refresh_token" and request.cookies.get("refresh_token"):
        response.delete_cookie(
            "refresh_token",
            path="/",
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
        )
    return response


@router.post("/mfa/verify")
async def verify_mfa(
    data: MFAVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """POST /api/v1/auth/mfa/verify — exchanges mfa_token + TOTP code for access token."""
    portal = _get_portal(request)
    cookie_key = _get_cookie_key(portal)
    result = await auth_service.verify_mfa(db, data.mfa_token, data.totp_code)
    await db.commit()
    response = JSONResponse(content=result.to_response())
    if result.refresh_token:
        response.set_cookie(
            key=cookie_key,
            value=result.refresh_token,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path="/",
            max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS * 3600,
        )
    return response


@router.post("/mfa/enroll")
async def enroll_mfa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/auth/mfa/enroll — returns TOTP URI for QR code. Not enabled until /mfa/confirm."""
    enrollment = await auth_service.enroll_mfa(db, current_user)
    return {"data": enrollment}


@router.post("/mfa/confirm")
async def confirm_mfa(
    data: MFAConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """POST /api/v1/auth/mfa/confirm — verifies TOTP code and enables MFA."""
    await auth_service.confirm_mfa(db, current_user, data.totp_code)
    return {"data": {"message": "MFA enabled successfully"}}


@router.get("/sso/initiate")
async def sso_initiate(
    provider: str,
    org_id: str,
    portal: Optional[str] = "buyer",
) -> dict:
    """GET /api/v1/auth/sso/initiate — SAML or OIDC redirect initiation."""
    from uuid import uuid4
    state = f"{org_id}:{portal}:{uuid4().hex[:8]}"

    if provider == "saml":
        if not SAML_AVAILABLE:
            # Fallback mock for local testing when python3-saml is unavailable
            redirect_url = f"http://localhost:8000/api/v1/auth/sso/callback?state={state}"
            return {"data": {"provider": "saml", "redirect_url": redirect_url, "state": state}}

        from app.auth.sso import build_saml_settings
        saml_settings = build_saml_settings(UUID(org_id))
        idp_sso = saml_settings.get("idp", {}).get("singleSignOnService", {}).get("url")
        return {"data": {"provider": "saml", "redirect_url": idp_sso or "/api/v1/auth/sso/callback", "state": state}}

    elif provider == "oidc":
        from app.auth.sso import build_oidc_auth_url
        auth_url = await build_oidc_auth_url(state=state)
        return {"data": {"provider": "oidc", "redirect_url": auth_url, "state": state}}

    raise AppException(f"Unknown SSO provider: {provider}", "INVALID_SSO_PROVIDER")


@router.post("/sso/callback")
async def sso_callback(
    request: Request,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """POST /api/v1/auth/sso/callback — SAML 2.0 ACS URL handler."""
    from app.auth.sso import get_saml_auth, provision_or_login_sso_user, SSOResult
    form = await request.form()
    relay_state = form.get("RelayState") or state or ""
    parts = relay_state.split(":") if relay_state else []
    org_id_str = parts[0] if len(parts) > 0 else None
    portal = parts[1] if len(parts) > 1 else _get_portal(request) or "buyer"

    if not org_id_str:
        raise AppException("Missing organization identifier in SSO state", "INVALID_SSO_STATE", 400)

    org_id = UUID(org_id_str)

    if SAML_AVAILABLE:
        auth = await get_saml_auth(request, org_id)
        if auth:
            auth.process_response()
            errors = auth.get_errors()
            if errors:
                raise AppException(f"SAML response failed: {auth.get_last_error_reason()}", "SAML_AUTH_FAILED", 401)
            attributes = auth.get_attributes()
            email = auth.get_nameid() or (attributes.get("email", [""])[0])
            first_name = attributes.get("first_name", ["SSO"])[0]
            last_name = attributes.get("last_name", ["User"])[0]
            sso_res = SSOResult(
                email=email,
                first_name=first_name,
                last_name=last_name,
                sso_provider="saml",
                sso_subject_id=auth.get_nameid() or email,
                extra=attributes,
            )
        else:
            raise AppException("Failed to initialize SAML auth", "SSO_NOT_CONFIGURED", 500)
    else:
        # Fallback simulation for developer test environments
        sso_res = SSOResult(
            email=form.get("email", "sso_user@example.com"),
            first_name=form.get("first_name", "Enterprise"),
            last_name=form.get("last_name", "User"),
            sso_provider="saml_simulated",
            sso_subject_id="saml-simulated-id",
        )

    login_result = await provision_or_login_sso_user(db, sso_res, org_id)
    await db.commit()

    cookie_key = _get_cookie_key(portal)
    response = JSONResponse(content=login_result.to_response())
    if login_result.refresh_token:
        response.set_cookie(
            key=cookie_key,
            value=login_result.refresh_token,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path="/",
            max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS * 3600,
        )
    return response


@router.get("/sso/oidc/callback")
async def oidc_callback(
    code: str,
    state: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """GET /api/v1/auth/sso/oidc/callback — OIDC authorization code exchange."""
    from app.auth.sso import handle_oidc_callback, provision_or_login_sso_user

    parts = state.split(":") if state else []
    org_id_str = parts[0] if len(parts) > 0 else None
    portal = parts[1] if len(parts) > 1 else _get_portal(request) or "buyer"

    if not org_id_str:
        raise AppException("Missing organization identifier in OIDC state", "INVALID_SSO_STATE", 400)

    org_id = UUID(org_id_str)
    sso_res = await handle_oidc_callback(code=code, state=state)
    login_result = await provision_or_login_sso_user(db, sso_res, org_id)
    await db.commit()

    cookie_key = _get_cookie_key(portal)
    response = JSONResponse(content=login_result.to_response())
    if login_result.refresh_token:
        response.set_cookie(
            key=cookie_key,
            value=login_result.refresh_token,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path="/",
            max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS * 3600,
        )
    return response
