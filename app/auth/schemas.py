from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    org_id: UUID | None = None
    turnstile_token: str | None = None
    portal: str | None = None


class TurnstileVerifyRequest(BaseModel):
    token: str
    remote_ip: str | None = None


class LoginResponse(BaseModel):
    data: dict


class MFAVerifyRequest(BaseModel):
    mfa_token: str
    totp_code: str


class MFAEnrollResponse(BaseModel):
    totp_uri: str
    backup_codes: list[str]


class MFAConfirmRequest(BaseModel):
    totp_code: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class RefreshRequest(BaseModel):
    refresh_token: str | None = None

