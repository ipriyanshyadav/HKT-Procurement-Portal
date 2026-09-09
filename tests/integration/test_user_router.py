from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.db.enums import UserStatusEnum
from app.db.session import get_db
from app.main import app
from app.modules.user.models import User, Role, UserRoleAssignment
from app.modules.user.role_repository import role_repository


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "admin@example.com"
    user.first_name = "Admin"
    user.last_name = "User"
    user.status = UserStatusEnum.ACTIVE
    user.mfa_enabled = False
    user.is_supplier_user = False
    user.vendor_id = None
    user.password_hash = hash_password("ValidP@ssw0rd123")
    return user


@pytest.fixture
def client(mock_user):
    async def _fake_db():
        mock = AsyncMock()
        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = ["PR_CREATE"]
        mock.execute = AsyncMock(return_value=mock_res)
        mock.commit = AsyncMock()
        mock.flush = AsyncMock()
        mock.refresh = AsyncMock()
        yield mock

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: mock_user

    with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
        yield TestClient(app)

    app.dependency_overrides.clear()



@pytest.mark.integration
class TestUserRouter:
    def test_get_me(self, client, mock_user):
        res = client.get("/api/v1/users/me")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == str(mock_user.id)
        assert data["email"] == mock_user.email

    def test_get_my_permissions(self, client):
        with patch("app.modules.user.router.get_db") as _:
            res = client.get("/api/v1/users/me/permissions")
            assert res.status_code == 200

    def test_change_my_password_incorrect(self, client):
        res = client.put(
            "/api/v1/users/me/password",
            json={"current_password": "WrongPassword1!", "new_password": "NewValidP@ss123"},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_CREDENTIALS"

    def test_change_my_password_weak(self, client):
        res = client.put(
            "/api/v1/users/me/password",
            json={"current_password": "ValidP@ssw0rd123", "new_password": "weak"},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "WEAK_PASSWORD"

    def test_change_my_password_success(self, client):
        with patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res = client.put(
                "/api/v1/users/me/password",
                json={"current_password": "ValidP@ssw0rd123", "new_password": "NewStr0ngP@ssw0rd!"},
            )
            assert res.status_code == 200
            assert res.json()["data"]["message"] == "Password changed successfully"

    def test_list_users(self, client, mock_user):
        with patch("app.modules.user.router.user_repository.get_multi", new_callable=AsyncMock, return_value=[mock_user]), \
             patch("app.modules.user.router.role_repository.get_user_role_codes", new_callable=AsyncMock, return_value=["ADMIN"]):
            res = client.get("/api/v1/users/")
            assert res.status_code == 200
            assert len(res.json()["data"]) == 1

    def test_list_roles(self, client, mock_user):
        role = Role(id=uuid4(), org_id=mock_user.org_id, code="ADMIN", name="Admin", description="Admin role")
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [role]

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_result)
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        res = client.get("/api/v1/users/roles")
        assert res.status_code == 200
        assert len(res.json()["data"]) == 1
        assert res.json()["data"][0]["code"] == "ADMIN"

    def test_create_user_weak_password(self, client):
        res = client.post(
            "/api/v1/users/",
            json={"email": "new@example.com", "first_name": "New", "last_name": "User", "password": "123"},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "WEAK_PASSWORD"

    def test_create_user_email_conflict(self, client, mock_user):
        with patch("app.modules.user.router.user_repository.find_by_email", new_callable=AsyncMock, return_value=mock_user):
            res = client.post(
                "/api/v1/users/",
                json={
                    "email": "existing@example.com",
                    "first_name": "New",
                    "last_name": "User",
                    "password": "ValidP@ssw0rd123",
                },
            )
            assert res.status_code == 400
            assert res.json()["error"]["code"] == "EMAIL_CONFLICT"

    def test_create_user_success(self, client):
        role_mock = MagicMock(id=uuid4())
        mock_exec = MagicMock()
        mock_exec.scalar_one_or_none.return_value = role_mock

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_exec)
            mock.flush = AsyncMock()
            mock.commit = AsyncMock()
            mock.add = MagicMock()
            yield mock

        app.dependency_overrides[get_db] = _fake_db

        with patch("app.modules.user.router.user_repository.find_by_email", new_callable=AsyncMock, return_value=None), \
             patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res = client.post(
                "/api/v1/users/",
                json={
                    "email": "created@example.com",
                    "first_name": "Created",
                    "last_name": "User",
                    "password": "ValidP@ssw0rd123",
                    "roles": ["BUYER"],
                },
            )
            assert res.status_code in (200, 201)

    def test_assign_user_role_not_found(self, client):
        with patch("app.modules.user.router.user_repository.get_by_id", new_callable=AsyncMock, return_value=None):
            res = client.post(
                f"/api/v1/users/{uuid4()}/roles",
                json={"role_code": "BUYER"},
            )
            assert res.status_code == 400
            assert res.json()["error"]["code"] == "NOT_FOUND"


    def test_assign_user_role_success(self, client, mock_user):
        role = Role(id=uuid4(), org_id=mock_user.org_id, code="BUYER", name="Buyer")
        mock_res1 = MagicMock()
        mock_res1.scalar_one_or_none.return_value = role
        mock_res2 = MagicMock()
        mock_res2.scalar_one_or_none.return_value = None  # not assigned yet

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(side_effect=[mock_res1, mock_res2])
            mock.add = MagicMock()
            mock.commit = AsyncMock()
            yield mock

        app.dependency_overrides[get_db] = _fake_db

        with patch("app.modules.user.router.user_repository.get_by_id", new_callable=AsyncMock, return_value=mock_user):
            res = client.post(
                f"/api/v1/users/{mock_user.id}/roles",
                json={"role_code": "BUYER"},
            )
            assert res.status_code == 200

    def test_remove_user_role(self, client, mock_user):
        role = Role(id=uuid4(), org_id=mock_user.org_id, code="BUYER", name="Buyer")
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = role

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_res)
            mock.commit = AsyncMock()
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        res = client.delete(f"/api/v1/users/{mock_user.id}/roles/BUYER")
        assert res.status_code == 200

    def test_get_user(self, client, mock_user):
        with patch("app.modules.user.router.user_repository.get_by_id", new_callable=AsyncMock, return_value=mock_user):
            res = client.get(f"/api/v1/users/{mock_user.id}")
            assert res.status_code == 200
            assert res.json()["data"]["id"] == str(mock_user.id)

    def test_update_user(self, client, mock_user):
        with patch("app.modules.user.router.user_repository.get_by_id", new_callable=AsyncMock, return_value=mock_user):
            res = client.put(
                f"/api/v1/users/{mock_user.id}",
                json={"first_name": "Updated", "last_name": "Name"},
            )
            assert res.status_code == 200

    def test_activate_and_deactivate_user(self, client, mock_user):
        with patch("app.modules.user.router.user_repository.get_by_id", new_callable=AsyncMock, return_value=mock_user), \
             patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res_act = client.post(f"/api/v1/users/{mock_user.id}/activate")
            assert res_act.status_code == 200

            res_deact = client.post(f"/api/v1/users/{mock_user.id}/deactivate")
            assert res_deact.status_code == 200

    def test_delegations_flow(self, client, mock_user):
        from datetime import datetime, timezone, timedelta
        from app.modules.user.models import DelegationRule

        delegate = MagicMock(spec=User)
        delegate.id = uuid4()
        delegate.first_name = "Jane"
        delegate.last_name = "Delegate"
        delegate.email = "jane@example.com"
        delegate.status = UserStatusEnum.ACTIVE

        rule = DelegationRule(
            id=uuid4(),
            org_id=mock_user.org_id,
            delegator_id=mock_user.id,
            delegate_id=delegate.id,
            reason="Vacation leave",
            valid_from=datetime.now(timezone.utc),
            valid_until=datetime.now(timezone.utc) + timedelta(days=7),
            entity_types=["PR", "PO"],
            is_active=True,
            created_by=mock_user.id,
        )

        with patch("app.modules.user.router.delegation_repository.list_by_delegator", new_callable=AsyncMock, return_value=[(rule, delegate)]):
            res = client.get("/api/v1/users/me/delegations")
            assert res.status_code == 200
            data = res.json()["data"]
            assert len(data) == 1
            assert data[0]["reason"] == "Vacation leave"
            assert data[0]["delegate_email"] == "jane@example.com"

        with patch("app.modules.user.router.user_repository.get_by_id", new_callable=AsyncMock, return_value=delegate), \
             patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res_create = client.post(
                "/api/v1/users/me/delegations",
                json={
                    "delegate_id": str(delegate.id),
                    "reason": "Business trip",
                    "valid_from": datetime.now(timezone.utc).isoformat(),
                    "valid_until": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
                    "entity_types": ["PR", "PO", "INVOICE"],
                },
            )
            assert res_create.status_code == 200
            created_data = res_create.json()["data"]
            assert created_data["reason"] == "Business trip"
            assert created_data["delegate_name"] == "Jane Delegate"

        with patch("app.modules.user.router.delegation_repository.get_by_id_and_delegator", new_callable=AsyncMock, return_value=rule), \
             patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res_del = client.delete(f"/api/v1/users/me/delegations/{rule.id}")
            assert res_del.status_code == 200
            assert rule.is_active is False

    def test_create_role(self, client, mock_user):
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = None

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_res)
            mock.flush = AsyncMock()
            mock.commit = AsyncMock()
            mock.add = MagicMock()
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        with patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res = client.post(
                "/api/v1/users/roles",
                json={
                    "code": "CUSTOM_ROLE",
                    "name": "Custom Role",
                    "description": "Role for testing",
                    "permission_codes": ["pr.create"],
                },
            )
            assert res.status_code in (200, 201)
            assert res.json()["data"]["code"] == "CUSTOM_ROLE"

    def test_get_role(self, client, mock_user):
        role_id = uuid4()
        role = Role(id=role_id, org_id=mock_user.org_id, code="ADMIN", name="Admin", description="Admin role")
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = role
        mock_res.scalars.return_value.all.return_value = []

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_res)
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        res = client.get(f"/api/v1/users/roles/{role_id}")
        assert res.status_code == 200
        assert res.json()["data"]["code"] == "ADMIN"

    def test_update_role(self, client, mock_user):
        role_id = uuid4()
        role = Role(id=role_id, org_id=mock_user.org_id, code="ADMIN", name="Admin", description="Admin role")
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = role

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_res)
            mock.commit = AsyncMock()
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        with patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res = client.put(
                f"/api/v1/users/roles/{role_id}",
                json={"name": "Admin New", "description": "Updated description"},
            )
            assert res.status_code == 200
            assert role.name == "Admin New"

    def test_update_role_permissions(self, client, mock_user):
        role_id = uuid4()
        role = Role(id=role_id, org_id=mock_user.org_id, code="ADMIN", name="Admin")
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = role
        mock_res.scalars.return_value.all.return_value = []

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_res)
            mock.commit = AsyncMock()
            mock.add = MagicMock()
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        with patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res = client.put(
                f"/api/v1/users/roles/{role_id}/permissions",
                json={"permission_codes": ["pr.create", "pr.approve"]},
            )
            assert res.status_code == 200

    def test_list_permissions(self, client):
        perms = [
            {"id": str(uuid4()), "code": "pr.create", "name": "Create PR", "module": "PR", "description": "Desc", "assigned_roles": ["BUYER"]}
        ]
        with patch("app.modules.user.router.role_repository.get_all_permissions", new_callable=AsyncMock, return_value=perms):
            res = client.get("/api/v1/users/permissions")
            assert res.status_code == 200
            assert len(res.json()["data"]) == 1
            assert res.json()["data"][0]["code"] == "pr.create"

    def test_get_role_permissions_matrix(self, client):
        matrix_data = {
            "roles": [{"id": str(uuid4()), "code": "BUYER", "name": "Buyer", "is_system_role": True, "is_supplier_role": False}],
            "permissions": [{"id": str(uuid4()), "code": "pr.create", "name": "Create PR", "module": "PR"}],
            "matrix": {"BUYER": ["pr.create"]},
        }
        with patch("app.modules.user.router.role_repository.get_permissions_matrix", new_callable=AsyncMock, return_value=matrix_data):
            res = client.get("/api/v1/users/role-permissions/matrix")
            assert res.status_code == 200
            assert "BUYER" in res.json()["data"]["matrix"]

    def test_toggle_role_permission(self, client):
        with patch("app.modules.user.router.role_repository.toggle_role_permission", new_callable=AsyncMock, return_value=True), \
             patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res = client.post(
                "/api/v1/users/role-permissions/toggle",
                json={"role_code": "BUYER", "permission_code": "pr.create", "granted": True},
            )
            assert res.status_code == 200
            assert res.json()["data"]["granted"] is True

    def test_list_sessions(self, client, mock_user):
        from app.modules.user.models import UserSession
        session_obj = MagicMock(spec=UserSession)
        session_obj.id = uuid4()
        session_obj.user_id = mock_user.id
        session_obj.token_jti = "token-jti-123"
        session_obj.ip_address = "127.0.0.1"
        session_obj.user_agent = "Mozilla/5.0"
        session_obj.created_at = datetime.now(timezone.utc)
        session_obj.last_activity_at = datetime.now(timezone.utc)
        session_obj.expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
        session_obj.is_revoked = False
        session_obj.revoked_reason = None

        with patch("app.modules.user.router.session_repository.list_sessions", new_callable=AsyncMock, return_value=([(session_obj, mock_user)], 1)):
            res = client.get("/api/v1/users/sessions")
            assert res.status_code == 200
            data = res.json()["data"]
            assert len(data) == 1
            assert data[0]["token_jti"] == "token-jti-123"
            assert data[0]["user_email"] == mock_user.email

    def test_revoke_session(self, client):
        session_id = uuid4()
        from app.modules.user.models import UserSession
        session_obj = MagicMock(spec=UserSession)
        session_obj.id = session_id
        session_obj.user_id = uuid4()

        with patch("app.modules.user.router.session_repository.get_by_id", new_callable=AsyncMock, return_value=session_obj), \
             patch("app.modules.user.router.session_repository.revoke", new_callable=AsyncMock), \
             patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res = client.post(
                f"/api/v1/users/sessions/{session_id}/revoke",
                json={"reason": "Compromised credential"},
            )
            assert res.status_code == 200
            assert res.json()["data"]["message"] == "Session successfully revoked"

    def test_revoke_all_user_sessions(self, client):
        user_id = uuid4()
        with patch("app.modules.user.router.session_repository.revoke_all", new_callable=AsyncMock), \
             patch("app.modules.user.router.audit_service.log", new_callable=AsyncMock):
            res = client.post(f"/api/v1/users/sessions/user/{user_id}/revoke-all")
            assert res.status_code == 200
            assert res.json()["data"]["message"] == "All active sessions revoked for user"

