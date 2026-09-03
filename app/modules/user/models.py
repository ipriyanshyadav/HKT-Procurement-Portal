from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from uuid import UUID, uuid4
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Integer, ForeignKey, Text, CHAR
from sqlalchemy.dialects.postgresql import ARRAY, INET
from sqlalchemy.sql import func
from app.db.base import BaseModel, Base
from app.db.enums import UserStatusEnum, USER_STATUS_PG

class Role(BaseModel):
    __tablename__ = "roles"

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_supplier_role: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

class RolePermission(BaseModel):
    __tablename__ = "role_permissions"

    role_id: Mapped[UUID] = mapped_column(ForeignKey("roles.id"), nullable=False)
    permission_id: Mapped[UUID] = mapped_column(ForeignKey("permissions.id"), nullable=False)
    granted_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    granted_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

class PasswordHistory(BaseModel):
    __tablename__ = "password_history"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    employee_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    department_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    business_unit_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("business_units.id"), nullable=True)
    plant_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("plants.id"), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    language: Mapped[str] = mapped_column(String(5), default="en", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    status: Mapped[UserStatusEnum] = mapped_column(USER_STATUS_PG, default=UserStatusEnum.PENDING_ACTIVATION, nullable=False)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    password_changed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    sso_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    sso_subject_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_supplier_user: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    vendor_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

class UserSession(BaseModel):
    __tablename__ = "user_sessions"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    token_jti: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    revoked_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

class UserMfa(BaseModel):
    __tablename__ = "user_mfa"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    totp_secret_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    backup_codes_hashed: Mapped[List[str]] = mapped_column(ARRAY(Text), default=list, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    enabled_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

class UserRoleAssignment(BaseModel):
    __tablename__ = "user_role_assignments"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    role_id: Mapped[UUID] = mapped_column(ForeignKey("roles.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    assigned_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    valid_from: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    valid_until: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class UserCategoryScope(BaseModel):
    __tablename__ = "user_category_scopes"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

class UserBuScope(BaseModel):
    __tablename__ = "user_bu_scopes"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    business_unit_id: Mapped[UUID] = mapped_column(ForeignKey("business_units.id"), nullable=False)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

class UserCoiDeclaration(BaseModel):
    __tablename__ = "user_coi_declarations"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    declared_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    acknowledged_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class DelegationRule(BaseModel):
    __tablename__ = "delegation_rules"

    delegator_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    delegate_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    valid_from: Mapped[datetime] = mapped_column(nullable=False)
    valid_until: Mapped[datetime] = mapped_column(nullable=False)
    entity_types: Mapped[List[str]] = mapped_column(ARRAY(Text), default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
