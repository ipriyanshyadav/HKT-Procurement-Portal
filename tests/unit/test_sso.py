from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest

from app.auth.sso import (
    SSOResult,
    build_oidc_auth_url,
    build_saml_settings,
    provision_or_login_sso_user,
)
from app.core.exceptions import ForbiddenError
from app.db.enums import UserStatusEnum
from app.modules.user.models import Role, User


class TestSSOHelpers:
    @pytest.mark.asyncio
    async def test_build_oidc_auth_url(self):
        with patch("app.auth.sso.get_oidc_endpoints", AsyncMock(return_value={
            "authorization_endpoint": "https://auth.example.com/oauth2/v1/authorize"
        })):
            url = await build_oidc_auth_url(state="xyz123", redirect_uri="http://localhost:3000/callback")
            assert "https://auth.example.com/oauth2/v1/authorize" in url
            assert "state=xyz123" in url
            assert "response_type=code" in url
            assert "scope=openid+profile+email" in url or "scope=openid%20profile%20email" in url

    def test_build_saml_settings(self):
        org_id = uuid4()
        settings_dict = build_saml_settings(org_id)
        assert "sp" in settings_dict
        assert "idp" in settings_dict
        assert "entityId" in settings_dict["sp"]
        assert "assertionConsumerService" in settings_dict["sp"]


class TestSSOUserProvisioning:
    @pytest.mark.asyncio
    async def test_provision_new_sso_user_with_requestor_role(self):
        db = AsyncMock()
        org_id = uuid4()
        sso_result = SSOResult(
            email="newuser@enterprise.com",
            first_name="Jane",
            last_name="Doe",
            sso_provider="oidc",
            sso_subject_id="sub-12345",
        )

        user_query_res = MagicMock()
        user_query_res.scalar_one_or_none.return_value = None

        role_query_res = MagicMock()
        mock_role = MagicMock(spec=Role)
        mock_role.id = uuid4()
        mock_role.code = "REQUESTOR"
        role_query_res.scalar_one_or_none.return_value = mock_role

        db.execute = AsyncMock(side_effect=[user_query_res, role_query_res])

        with patch("app.auth.sso.auth_service._issue_tokens", AsyncMock()) as mock_tokens, \
             patch("app.auth.sso.audit_service.log", AsyncMock()) as mock_audit:

            mock_tokens.return_value = MagicMock(access_token="tok_123")

            res = await provision_or_login_sso_user(db, sso_result, org_id)

            assert res.access_token == "tok_123"
            assert db.add.call_count >= 2
            assert db.flush.call_count >= 2
            assert mock_audit.call_count == 2

    @pytest.mark.asyncio
    async def test_login_existing_active_sso_user(self):
        db = AsyncMock()
        org_id = uuid4()
        existing_user = MagicMock(spec=User)
        existing_user.id = uuid4()
        existing_user.email = "existing@enterprise.com"
        existing_user.status = UserStatusEnum.ACTIVE

        user_query_res = MagicMock()
        user_query_res.scalar_one_or_none.return_value = existing_user
        db.execute = AsyncMock(return_value=user_query_res)

        sso_result = SSOResult(
            email="existing@enterprise.com",
            first_name="Jane",
            last_name="Doe",
            sso_provider="saml",
            sso_subject_id="saml-sub-999",
        )

        with patch("app.auth.sso.auth_service._issue_tokens", AsyncMock()) as mock_tokens, \
             patch("app.auth.sso.audit_service.log", AsyncMock()) as mock_audit:

            mock_tokens.return_value = MagicMock(access_token="tok_456")

            res = await provision_or_login_sso_user(db, sso_result, org_id)

            assert res.access_token == "tok_456"
            assert db.add.call_count == 0
            assert mock_audit.call_count == 1

    @pytest.mark.asyncio
    async def test_reject_inactive_sso_user(self):
        db = AsyncMock()
        org_id = uuid4()
        inactive_user = MagicMock(spec=User)
        inactive_user.id = uuid4()
        inactive_user.email = "suspended@enterprise.com"
        inactive_user.status = UserStatusEnum.INACTIVE

        user_query_res = MagicMock()
        user_query_res.scalar_one_or_none.return_value = inactive_user
        db.execute = AsyncMock(return_value=user_query_res)

        sso_result = SSOResult(
            email="suspended@enterprise.com",
            first_name="Jane",
            last_name="Doe",
            sso_provider="oidc",
            sso_subject_id="sub-suspended",
        )

        with pytest.raises(ForbiddenError) as exc:
            await provision_or_login_sso_user(db, sso_result, org_id)
        assert exc.value.code == "USER_INACTIVE"
