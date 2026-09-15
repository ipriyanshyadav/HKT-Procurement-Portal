"""Unit tests for CompanySwitcherService — SPEC_27-A."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, UTC

from app.modules.admin.company_switcher_service import CompanySwitcherService
from app.modules.admin.company_switcher_schemas import UserOrgInviteRequest
from app.core.exceptions import NotFoundError, ForbiddenError


@pytest.mark.asyncio
async def test_list_my_orgs_platform_admin():
    service = CompanySwitcherService()
    db = AsyncMock()

    user = MagicMock()
    user.id = uuid4()
    user.org_id = uuid4()
    user.is_platform_admin = True
    user.is_supplier_user = False

    org1 = MagicMock()
    org1.id = user.org_id
    org1.name = "Home Org"
    org1.code = "home-org"
    org1.logo_url = None

    org2 = MagicMock()
    org2.id = uuid4()
    org2.name = "Other Org"
    org2.code = "other-org"
    org2.logo_url = None

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [org1, org2]
    db.execute.return_value = mock_result

    orgs = await service.list_my_orgs(db, user)
    assert len(orgs) == 2
    assert any(o.is_current for o in orgs)


@pytest.mark.asyncio
async def test_list_my_orgs_standard_user():
    service = CompanySwitcherService()
    db = AsyncMock()

    user = MagicMock()
    user.id = uuid4()
    user.org_id = uuid4()
    user.is_platform_admin = False
    user.is_supplier_user = False

    org1 = MagicMock()
    org1.id = user.org_id
    org1.name = "Home Org"
    org1.code = "home"
    org1.logo_url = None

    res1 = MagicMock()
    res1.scalar_one_or_none.return_value = org1

    res2 = MagicMock()
    res2.all.return_value = []

    db.execute.side_effect = [res1, res2]

    orgs = await service.list_my_orgs(db, user)
    assert len(orgs) == 1
    assert orgs[0].org_id == user.org_id
    assert orgs[0].is_primary is True


@pytest.mark.asyncio
async def test_switch_org_target_not_found():
    service = CompanySwitcherService()
    db = AsyncMock()

    user = MagicMock()
    user.id = uuid4()
    user.org_id = uuid4()

    res = MagicMock()
    res.scalar_one_or_none.return_value = None
    db.execute.return_value = res

    with pytest.raises(NotFoundError):
        await service.switch_org(db, user, target_org_id=uuid4())


@pytest.mark.asyncio
async def test_switch_org_no_membership_raises_forbidden():
    service = CompanySwitcherService()
    db = AsyncMock()

    user = MagicMock()
    user.id = uuid4()
    user.org_id = uuid4()
    user.is_platform_admin = False
    user.is_supplier_user = False

    target_org = MagicMock()
    target_org.id = uuid4()
    target_org.name = "Foreign Org"

    res1 = MagicMock()
    res1.scalar_one_or_none.return_value = target_org

    res2 = MagicMock()
    res2.scalar_one_or_none.return_value = None  # No membership

    db.execute.side_effect = [res1, res2]

    with pytest.raises(ForbiddenError):
        await service.switch_org(db, user, target_org_id=target_org.id)


@pytest.mark.asyncio
@patch("app.modules.admin.company_switcher_service.audit_service.log", new_callable=AsyncMock)
@patch("app.modules.admin.company_switcher_service.get_redis_client")
async def test_switch_org_success(mock_redis_factory, mock_audit):
    service = CompanySwitcherService()
    db = AsyncMock()

    mock_redis = AsyncMock()
    mock_redis_factory.return_value = mock_redis

    user = MagicMock()
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "user@test.com"
    user.is_platform_admin = True
    user.is_supplier_user = False
    user.active_legal_entity_id = None
    user.vendor_id = None

    target_org = MagicMock()
    target_org.id = uuid4()
    target_org.name = "Target Org"

    res1 = MagicMock()
    res1.scalar_one_or_none.return_value = target_org
    db.execute.return_value = res1

    resp = await service.switch_org(
        db, user, target_org_id=target_org.id, previous_jti="old-jti-123"
    )
    assert resp.org_id == target_org.id
    assert resp.org_name == "Target Org"
    assert resp.access_token is not None
    assert resp.refresh_token is not None
    mock_redis.setex.assert_called_once()
    mock_audit.assert_called_once()


@pytest.mark.asyncio
async def test_invite_user_to_org():
    service = CompanySwitcherService()
    db = AsyncMock()

    actor = MagicMock()
    actor.id = uuid4()

    target_user = MagicMock()
    target_user.id = uuid4()
    target_user.email = "invited@test.com"
    target_user.first_name = "Jane"
    target_user.last_name = "Doe"

    res1 = MagicMock()
    res1.scalar_one_or_none.return_value = target_user

    res2 = MagicMock()
    res2.scalar_one_or_none.return_value = None  # No prior membership

    db.execute.side_effect = [res1, res2]

    req = UserOrgInviteRequest(
        email="invited@test.com",
        org_id=uuid4(),
        roles=["BUYER"],
    )
    member = await service.invite_user_to_org(db, actor, req)
    assert member.email == "invited@test.com"
    assert member.roles == ["BUYER"]
    assert db.add.called
