"""
Unit and integration tests for Super Admin universal portal access,
cross-portal switching, and role permission bypass.
"""
from __future__ import annotations
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.constants import RoleCode
from app.modules.user.role_repository import RoleRepository
from app.auth.service import AuthService, LoginResult
from app.db.enums import UserStatusEnum
from app.auth.router import _get_refresh_token_and_key
from starlette.datastructures import Headers


class DummyRequest:
    def __init__(self, headers=None, cookies=None, path="/"):
        self.headers = Headers(headers or {})
        self.cookies = cookies or {}
        self.url = MagicMock()
        self.url.path = path


class TestSuperAdminRoleBypass:
    @pytest.mark.asyncio
    async def test_superadmin_permission_bypass(self):
        repo = RoleRepository()
        db = AsyncMock()
        user_id = uuid4()
        org_id = uuid4()

        # When user has SUPERADMIN role code
        with patch.object(repo, "get_user_role_codes", new_callable=AsyncMock) as mock_roles:
            mock_roles.return_value = [RoleCode.SUPERADMIN]
            has_perm = await repo.user_has_permission(db, user_id, org_id, "ANY_RANDOM_PERMISSION")
            assert has_perm is True
            # Does not even query role_permissions table
            assert db.execute.call_count == 0

    @pytest.mark.asyncio
    async def test_non_superadmin_still_checks_permissions_table(self):
        repo = RoleRepository()
        db = AsyncMock()
        user_id = uuid4()
        org_id = uuid4()

        with patch.object(repo, "get_user_role_codes", new_callable=AsyncMock) as mock_roles:
            mock_roles.return_value = [RoleCode.BUYER]
            result_mock = MagicMock()
            result_mock.scalar_one_or_none.return_value = None
            db.execute.return_value = result_mock
            has_perm = await repo.user_has_permission(db, user_id, org_id, "ADMIN_DASHBOARD_VIEW")
            assert has_perm is False
            assert db.execute.call_count == 1


class TestSuperAdminUniversalPortalAccess:
    @pytest.mark.asyncio
    async def test_superadmin_can_login_to_all_portals(self):
        service = AuthService()
        db = AsyncMock()
        org_id = uuid4()

        super_user = MagicMock()
        super_user.id = uuid4()
        super_user.org_id = org_id
        super_user.email = "superadmin@procurement.com"
        super_user.status = UserStatusEnum.ACTIVE
        super_user.is_supplier_user = False
        super_user.password_hash = "$2b$12$hash..."
        super_user.password_changed_at = None
        super_user.mfa_enabled = False

        with patch("app.auth.service.user_repository.find_by_email", new_callable=AsyncMock, return_value=super_user), \
             patch("app.auth.service.role_repository.get_user_role_codes", new_callable=AsyncMock, return_value=[RoleCode.SUPERADMIN]), \
             patch.object(service, "_issue_tokens", new_callable=AsyncMock, return_value=LoginResult(access_token="tok", refresh_token="ref")), \
             patch.object(service, "_get_fail_count", new_callable=AsyncMock, return_value=0), \
             patch.object(service, "_clear_fail_count", new_callable=AsyncMock), \
             patch("app.auth.service.get_redis_client", return_value=AsyncMock()), \
             patch("app.auth.service.verify_password", return_value=True), \
             patch("app.auth.service.audit_service.log", new_callable=AsyncMock):

            for portal in ("admin", "buyer", "supplier"):
                result = await service.login(db, "superadmin@procurement.com", "Password123!", org_id=org_id, portal_type=portal)
                assert result.access_token == "tok"

    @pytest.mark.asyncio
    async def test_superadmin_can_refresh_on_any_portal(self):
        service = AuthService()
        db = AsyncMock()
        org_id = uuid4()
        user_id = uuid4()

        super_user = MagicMock()
        super_user.id = user_id
        super_user.org_id = org_id
        super_user.status = UserStatusEnum.ACTIVE
        super_user.is_supplier_user = False

        payload = {
            "token_type": "refresh",
            "jti": "mock-jti-123",
            "sub": str(user_id),
            "org_id": str(org_id),
            "exp": 9999999999,
        }

        with patch("app.auth.service.decode_jwt", return_value=payload), \
             patch("app.auth.service.get_redis_client") as mock_redis, \
             patch("app.auth.service.user_repository.get_by_id", new_callable=AsyncMock, return_value=super_user), \
             patch("app.auth.service.role_repository.get_user_role_codes", new_callable=AsyncMock, return_value=[RoleCode.SUPERADMIN]), \
             patch("app.auth.service.session_repository.get_by_jti", new_callable=AsyncMock, return_value=MagicMock()), \
             patch("app.auth.service.session_repository.revoke", new_callable=AsyncMock), \
             patch.object(service, "_issue_tokens", new_callable=AsyncMock, return_value=LoginResult(access_token="new.tok", refresh_token="new.ref")), \
             patch("app.auth.service.audit_service.log", new_callable=AsyncMock):

            redis_inst = AsyncMock()
            redis_inst.get.return_value = None
            mock_redis.return_value = redis_inst

            # Superadmin can refresh on supplier portal without ForbiddenError
            result = await service.refresh_token(db, "refresh-str", portal_type="supplier")
            assert result.access_token == "new.tok"

            # Superadmin can refresh on admin portal without ForbiddenError
            result_admin = await service.refresh_token(db, "refresh-str", portal_type="admin")
            assert result_admin.access_token == "new.tok"


class TestCrossPortalSessionSwitching:
    def test_refresh_token_cross_portal_cookie_fallback(self):
        # User is in admin portal, but only has refresh_token_buyer cookie
        req = DummyRequest(
            headers={"x-portal-id": "admin"},
            cookies={"refresh_token_buyer": "buyer-cookie-val"},
        )
        token, key, portal = _get_refresh_token_and_key(req)
        assert token == "buyer-cookie-val"
        assert key == "refresh_token_admin"
        assert portal == "admin"

    def test_refresh_token_cross_portal_generic_fallback(self):
        # User is in supplier portal, but has generic refresh_token cookie
        req = DummyRequest(
            headers={"x-portal-id": "supplier"},
            cookies={"refresh_token": "generic-cookie-val"},
        )
        token, key, portal = _get_refresh_token_and_key(req)
        assert token == "generic-cookie-val"
        assert key == "refresh_token"
        assert portal == "supplier"
