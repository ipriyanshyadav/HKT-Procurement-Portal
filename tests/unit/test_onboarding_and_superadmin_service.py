"""Unit tests for OnboardingService (SPEC_27-B) and SuperadminReportsService (SPEC_27-C)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal
from uuid import uuid4
from datetime import datetime, timezone

from app.core.constants import RoleCode
from app.core.exceptions import AppException, ForbiddenError, NotFoundError
from app.modules.admin.onboarding_service import OnboardingService
from app.modules.admin.superadmin_reports_service import SuperadminReportsService
from app.modules.admin.models import OnboardingSession
from app.modules.organization.models import Organization
from app.modules.user.models import User


@pytest.fixture
def onboarding_srv():
    return OnboardingService()


@pytest.fixture
def superadmin_srv():
    return SuperadminReportsService()


@pytest.fixture
def mock_db():
    return AsyncMock()


# ============================================================================
# 27-B: OnboardingService Tests
# ============================================================================

@pytest.mark.asyncio
async def test_get_or_create_session_creates_new(onboarding_srv, mock_db):
    org_id = uuid4()
    user_id = uuid4()

    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = None
    mock_db.execute.return_value = mock_res

    with patch("app.modules.audit.service.audit_service.log", new_callable=AsyncMock):
        session = await onboarding_srv.get_or_create_session(mock_db, org_id, user_id)
        assert session.org_id == org_id
        assert session.initiated_by == user_id
        assert session.current_step == 1
        assert session.status == "IN_PROGRESS"
        assert session.completed_steps == []
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()


@pytest.mark.asyncio
async def test_get_or_create_session_returns_existing(onboarding_srv, mock_db):
    org_id = uuid4()
    user_id = uuid4()
    existing_session = OnboardingSession(
        id=uuid4(),
        org_id=org_id,
        initiated_by=user_id,
        current_step=3,
        completed_steps=[1, 2],
        step_data={"step_1": {"pan": "AAACP1234A"}},
        status="IN_PROGRESS",
    )

    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = existing_session
    mock_db.execute.return_value = mock_res

    session = await onboarding_srv.get_or_create_session(mock_db, org_id, user_id)
    assert session.id == existing_session.id
    assert session.current_step == 3
    mock_db.add.assert_not_called()


@pytest.mark.asyncio
async def test_save_step_success(onboarding_srv, mock_db):
    org_id = uuid4()
    user_id = uuid4()
    session = OnboardingSession(
        id=uuid4(),
        org_id=org_id,
        initiated_by=user_id,
        current_step=1,
        completed_steps=[],
        step_data={},
        status="IN_PROGRESS",
    )

    with patch.object(onboarding_srv, "get_or_create_session", new_callable=AsyncMock) as mock_get, \
         patch("app.modules.audit.service.audit_service.log", new_callable=AsyncMock):
        mock_get.return_value = session

        updated = await onboarding_srv.save_step(
            mock_db, org_id, user_id, step=1, data={"legal_name": "Acme Inc"}, mark_completed=True
        )
        assert 1 in updated.completed_steps
        assert updated.current_step == 2
        assert "step_1" in updated.step_data
        assert updated.step_data["step_1"]["legal_name"] == "Acme Inc"
        mock_db.flush.assert_called_once()


@pytest.mark.asyncio
async def test_save_step_already_completed_raises(onboarding_srv, mock_db):
    org_id = uuid4()
    user_id = uuid4()
    session = OnboardingSession(
        id=uuid4(),
        org_id=org_id,
        initiated_by=user_id,
        current_step=8,
        completed_steps=[1, 2, 3, 4, 5, 6, 7, 8],
        step_data={},
        status="COMPLETED",
    )

    with patch.object(onboarding_srv, "get_or_create_session", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = session
        with pytest.raises(AppException) as exc:
            await onboarding_srv.save_step(
                mock_db, org_id, user_id, step=2, data={"test": "data"}
            )
        assert exc.value.status_code == 400
        assert exc.value.code == "ONBOARDING_ALREADY_COMPLETED"


@pytest.mark.asyncio
async def test_complete_onboarding_success(onboarding_srv, mock_db):
    org_id = uuid4()
    user_id = uuid4()
    session = OnboardingSession(
        id=uuid4(),
        org_id=org_id,
        initiated_by=user_id,
        current_step=8,
        completed_steps=[1, 2, 3, 4, 5, 6, 7],
        step_data={},
        status="IN_PROGRESS",
    )

    with patch.object(onboarding_srv, "get_or_create_session", new_callable=AsyncMock) as mock_get, \
         patch("app.modules.audit.service.audit_service.log", new_callable=AsyncMock):
        mock_get.return_value = session

        res = await onboarding_srv.complete_onboarding(mock_db, org_id, user_id)
        assert res.status == "COMPLETED"
        assert res.completed_at is not None
        assert 8 in res.completed_steps


@pytest.mark.asyncio
async def test_get_checklist_computation(onboarding_srv, mock_db):
    org_id = uuid4()
    user_id = uuid4()
    session = OnboardingSession(
        id=uuid4(),
        org_id=org_id,
        initiated_by=user_id,
        current_step=4,
        completed_steps=[1, 2, 3, 4],
        step_data={},
        status="IN_PROGRESS",
    )

    with patch.object(onboarding_srv, "get_or_create_session", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = session
        checklist = await onboarding_srv.get_checklist(mock_db, org_id, user_id)
        assert checklist.total_steps == 8
        assert checklist.completed_count == 4
        assert checklist.percent_complete == 50.0
        assert checklist.is_ready_for_golive is False
        assert len(checklist.items) == 8
        assert checklist.items[0].is_completed is True
        assert checklist.items[4].is_completed is False


# ============================================================================
# 27-C: SuperadminReportsService Tests
# ============================================================================

def test_superadmin_verify_platform_admin_forbidden(superadmin_srv):
    user = MagicMock(spec=User)
    user.is_platform_admin = False
    user.roles = ["BUYER", "REQUESTOR"]

    with pytest.raises(ForbiddenError):
        superadmin_srv.verify_platform_admin(user)


def test_superadmin_verify_platform_admin_success(superadmin_srv):
    # Case 1: is_platform_admin = True
    user1 = MagicMock(spec=User)
    user1.is_platform_admin = True
    user1.roles = []
    superadmin_srv.verify_platform_admin(user1)

    # Case 2: RoleCode.SUPERADMIN in roles
    user2 = MagicMock(spec=User)
    user2.is_platform_admin = False
    user2.roles = [RoleCode.SUPERADMIN]
    superadmin_srv.verify_platform_admin(user2)


@pytest.mark.asyncio
async def test_superadmin_platform_overview(superadmin_srv, mock_db):
    actor = MagicMock(spec=User)
    actor.id = uuid4()
    actor.org_id = uuid4()
    actor.is_platform_admin = True
    actor.roles = []

    # Mock db queries for counts & sums
    count_res = MagicMock()
    count_res.scalar.return_value = 10

    po_res = MagicMock()
    po_res.one.return_value = (5, Decimal("100000.00"))

    mock_db.execute.side_effect = [
        count_res,  # orgs
        count_res,  # users
        count_res,  # vendors
        count_res,  # prs
        po_res,     # pos + gmv
        count_res,  # invoices
    ]

    with patch("app.modules.audit.service.audit_service.log", new_callable=AsyncMock):
        res = await superadmin_srv.get_platform_overview(mock_db, actor)
        assert res.total_organizations == 10
        assert res.total_users == 10
        assert res.total_vendors == 10
        assert res.total_prs == 10
        assert res.total_pos == 5
        assert res.total_gmv_inr == Decimal("100000.00")
        assert res.total_invoices == 10


@pytest.mark.asyncio
async def test_superadmin_list_org_performance(superadmin_srv, mock_db):
    actor = MagicMock(spec=User)
    actor.is_platform_admin = True
    actor.roles = []

    org1 = MagicMock(spec=Organization)
    org1.id = uuid4()
    org1.legal_name = "Global Corp"
    org1.created_at = datetime.now(timezone.utc)
    org1.status = "ACTIVE"

    orgs_res = MagicMock()
    orgs_res.scalars.return_value.all.return_value = [org1]

    num_res = MagicMock()
    num_res.scalar.return_value = 2

    po_stat_res = MagicMock()
    po_stat_res.one.return_value = (3, Decimal("50000.00"))

    mock_db.execute.side_effect = [
        orgs_res,    # org list
        num_res,     # users
        num_res,     # vendors
        num_res,     # prs
        po_stat_res  # pos + spend
    ]

    items = await superadmin_srv.list_org_performance(mock_db, actor, page=1, page_size=10)
    assert len(items) == 1
    assert items[0].org_name == "Global Corp"
    assert items[0].spend_mtd_inr == Decimal("50000.00")
    assert items[0].pos_count == 3


@pytest.mark.asyncio
async def test_superadmin_get_org_detail_not_found(superadmin_srv, mock_db):
    actor = MagicMock(spec=User)
    actor.is_platform_admin = True
    actor.roles = []
    target_org_id = uuid4()

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_res

    with pytest.raises(NotFoundError):
        await superadmin_srv.get_org_detail(mock_db, actor, target_org_id)
