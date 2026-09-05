from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.user.models import User
from app.modules.workflow.resolver import ApproverResolver


@pytest.mark.unit
class TestApproverResolver:
    @pytest.fixture
    def mock_repos(self):
        user_repo = AsyncMock()
        group_repo = AsyncMock()
        resolver = ApproverResolver(user_repo=user_repo, group_repo=group_repo)
        return resolver, user_repo, group_repo

    @pytest.mark.asyncio
    async def test_resolve_named_user(self, mock_repos):
        resolver, user_repo, _ = mock_repos
        db = AsyncMock(spec=AsyncSession)
        org_id = uuid4()
        user_id = uuid4()
        expected_user = MagicMock(spec=User, id=user_id)
        user_repo.get_by_id = AsyncMock(return_value=expected_user)

        res = await resolver.resolve(
            db,
            resolver="NAMED_USER",
            resolver_config={"user_id": str(user_id)},
            entity_context={},
            org_id=org_id,
        )
        assert res == [expected_user]
        user_repo.get_by_id.assert_awaited_once_with(db, user_id, org_id)

    @pytest.mark.asyncio
    async def test_resolve_named_user_not_found(self, mock_repos):
        resolver, user_repo, _ = mock_repos
        db = AsyncMock(spec=AsyncSession)
        user_repo.get_by_id = AsyncMock(return_value=None)

        res = await resolver.resolve(
            db,
            resolver="NAMED_USER",
            resolver_config={"user_id": str(uuid4())},
            entity_context={},
            org_id=uuid4(),
        )
        assert res == []

    @pytest.mark.asyncio
    async def test_resolve_approval_group(self, mock_repos):
        resolver, _, group_repo = mock_repos
        db = AsyncMock(spec=AsyncSession)
        org_id = uuid4()
        group_id = uuid4()
        mock_group = MagicMock(id=group_id)
        group_repo.get_by_code = AsyncMock(return_value=mock_group)
        members = [MagicMock(spec=User)]
        group_repo.get_members = AsyncMock(return_value=members)

        res = await resolver.resolve(
            db,
            resolver="APPROVAL_GROUP",
            resolver_config={"group_code": "FINANCE_DEPT"},
            entity_context={},
            org_id=org_id,
        )
        assert res == members
        group_repo.get_by_code.assert_awaited_once_with(db, "FINANCE_DEPT", org_id)
        group_repo.get_members.assert_awaited_once_with(db, group_id, org_id)

    @pytest.mark.asyncio
    async def test_resolve_invalid_type(self, mock_repos):
        resolver, _, _ = mock_repos
        db = AsyncMock(spec=AsyncSession)
        with pytest.raises(AppException) as exc_info:
            await resolver.resolve(
                db,
                resolver="UNKNOWN_STRATEGY",
                resolver_config={},
                entity_context={},
                org_id=uuid4(),
            )
        assert exc_info.value.code == "INVALID_RESOLVER"

    @pytest.mark.asyncio
    async def test_resolve_by_role_no_filter(self, mock_repos):
        resolver, user_repo, _ = mock_repos
        db = AsyncMock(spec=AsyncSession)
        org_id = uuid4()
        users = [MagicMock(spec=User)]
        user_repo.get_active_users_with_role = AsyncMock(return_value=users)

        res = await resolver.resolve(
            db,
            resolver="ROLE",
            resolver_config={"role_code": "BUYER"},
            entity_context={},
            org_id=org_id,
        )
        assert res == users

    @pytest.mark.asyncio
    async def test_resolve_by_role_scope_filters(self, mock_repos):
        resolver, user_repo, _ = mock_repos
        db = AsyncMock(spec=AsyncSession)
        org_id = uuid4()
        bu_id = uuid4()
        cat_id = uuid4()

        user1 = MagicMock(spec=User, id=uuid4())
        user2 = MagicMock(spec=User, id=uuid4())
        user_repo.get_active_users_with_role = AsyncMock(return_value=[user1, user2])

        resolver._user_has_bu_scope = AsyncMock(side_effect=lambda db, uid, b_id, o_id: uid == user1.id)
        resolver._user_has_cat_scope = AsyncMock(side_effect=lambda db, uid, c_id, o_id: uid == user1.id)

        # same_bu
        res_bu = await resolver.resolve(
            db,
            resolver="ROLE",
            resolver_config={"role_code": "DEPT_HEAD", "scope_filter": "same_bu"},
            entity_context={"business_unit_id": str(bu_id)},
            org_id=org_id,
        )
        assert res_bu == [user1]

        # same_category
        res_cat = await resolver.resolve(
            db,
            resolver="ROLE",
            resolver_config={"role_code": "CAT_MGR", "scope_filter": "same_category"},
            entity_context={"category_id": str(cat_id)},
            org_id=org_id,
        )
        assert res_cat == [user1]

        # same_bu_and_category
        res_both = await resolver.resolve(
            db,
            resolver="ROLE",
            resolver_config={"role_code": "LEAD", "scope_filter": "same_bu_and_category"},
            entity_context={"bu_id": str(bu_id), "category_id": str(cat_id)},
            org_id=org_id,
        )
        assert res_both == [user1]

        # vendor_category
        res_vendor = await resolver.resolve(
            db,
            resolver="ROLE",
            resolver_config={"role_code": "BUYER", "scope_filter": "vendor_category"},
            entity_context={"vendor_category_ids": [str(cat_id)]},
            org_id=org_id,
        )
        assert res_vendor == [user1]

    @pytest.mark.asyncio
    async def test_resolve_by_role_fallback(self, mock_repos):
        resolver, user_repo, _ = mock_repos
        db = AsyncMock(spec=AsyncSession)
        org_id = uuid4()
        bu_id = uuid4()
        fallback_user = MagicMock(spec=User, id=uuid4())

        # First call with scoped role returns empty after filter
        user_repo.get_active_users_with_role = AsyncMock(side_effect=[[], [fallback_user]])

        res = await resolver.resolve(
            db,
            resolver="ROLE",
            resolver_config={
                "role_code": "SPECIALIST",
                "scope_filter": "same_bu",
                "fallback_role": "ADMIN",
            },
            entity_context={"business_unit_id": str(bu_id)},
            org_id=org_id,
        )
        assert res == [fallback_user]

    @pytest.mark.asyncio
    async def test_user_has_bu_scope_db(self, mock_repos):
        resolver, _, _ = mock_repos
        db = AsyncMock(spec=AsyncSession)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = MagicMock()
        db.execute = AsyncMock(return_value=mock_result)

        has_scope = await resolver._user_has_bu_scope(db, uuid4(), uuid4(), uuid4())
        assert has_scope is True

    @pytest.mark.asyncio
    async def test_user_has_cat_scope_db(self, mock_repos):
        resolver, _, _ = mock_repos
        db = AsyncMock(spec=AsyncSession)
        mock_result = MagicMock()
        mock_result.fetchone.return_value = (1,)
        db.execute = AsyncMock(return_value=mock_result)

        has_scope = await resolver._user_has_cat_scope(db, uuid4(), uuid4(), uuid4())
        assert has_scope is True
