from __future__ import annotations
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    org_id: Optional[UUID] = None
    turnstile_token: Optional[str] = None


class TurnstileVerifyRequest(BaseModel):
    token: str
    remote_ip: Optional[str] = None


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
