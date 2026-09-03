from __future__ import annotations
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


@router.post("/login")
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """POST /api/v1/auth/login — password login. Returns access_token; sets refresh_token cookie."""
    result = await auth_service.login(db, data.email, data.password, data.org_id)
    response = JSONResponse(content=result.to_response())
    if result.refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=result.refresh_token,
            httponly=True,
            secure=True,
            samesite="strict",
            max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS * 3600,
        )
    return response


@router.post("/refresh")
async def refresh(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """POST /api/v1/auth/refresh — reads refresh_token from httpOnly cookie."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise AppException("Refresh token not found in cookie", "MISSING_REFRESH_TOKEN")
    result = await auth_service.refresh_token(db, refresh_token)
    response = JSONResponse(content={"data": {"access_token": result.access_token}})
    response.set_cookie(
        key="refresh_token",
        value=result.refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS * 3600,
    )
    return response


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """POST /api/v1/auth/logout — revokes session and clears refresh_token cookie."""
    refresh_token = request.cookies.get("refresh_token", "")
    if refresh_token:
        await auth_service.logout(db, current_user, refresh_token)
    response = JSONResponse(content={"data": {"message": "Logged out successfully"}})
    response.delete_cookie("refresh_token")
    return response


@router.post("/mfa/verify")
async def verify_mfa(
    data: MFAVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """POST /api/v1/auth/mfa/verify — exchanges mfa_token + TOTP code for access token."""
    result = await auth_service.verify_mfa(db, data.mfa_token, data.totp_code)
    response = JSONResponse(content=result.to_response())
    if result.refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=result.refresh_token,
            httponly=True,
            secure=True,
            samesite="strict",
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
async def sso_initiate(provider: str, org_id: str) -> dict:
    """GET /api/v1/auth/sso/initiate — SAML or OIDC redirect initiation."""
    if provider == "saml":
        if not SAML_AVAILABLE:
            raise AppException("SAML SSO is not configured", "SSO_NOT_CONFIGURED")
        return {"data": {"message": "SAML initiation — configure IdP metadata"}}
    elif provider == "oidc":
        return {"data": {"message": "OIDC initiation — redirect to authorization endpoint"}}
    raise AppException(f"Unknown SSO provider: {provider}", "INVALID_SSO_PROVIDER")


@router.post("/sso/callback")
async def sso_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """POST /api/v1/auth/sso/callback — SAML 2.0 ACS URL handler."""
    if not SAML_AVAILABLE:
        raise AppException("SAML SSO is not configured", "SSO_NOT_CONFIGURED")
    return JSONResponse(content={"data": {"message": "SAML callback received"}})


@router.get("/sso/oidc/callback")
async def oidc_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """GET /api/v1/auth/sso/oidc/callback — OIDC authorization code exchange."""
    return JSONResponse(content={"data": {"message": "OIDC callback received", "state": state}})
