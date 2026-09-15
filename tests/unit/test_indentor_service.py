from __future__ import annotations

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.core.constants import PermissionCode, RoleCode
from app.db.enums import PRSource, PRStatus
from app.modules.requisition.models import Requisition
from app.modules.requisition.schemas import (
    BuyerSelectionItem,
    IndentCartTransferRequest,
    IndentTransferRequest,
    PRLineItemRequest,
)
from app.modules.requisition.service import RequisitionService
from app.modules.user.models import User


@pytest.fixture
def requisition_service():
    repo = AsyncMock()
    return RequisitionService(repo=repo)


def test_indentor_role_and_permission_constants():
    """Verify INDENTOR role and related permissions are defined in constants."""
    assert RoleCode.INDENTOR == "INDENTOR"
    assert PermissionCode.INDENT_CREATE == "indent.create"
    assert PermissionCode.INDENT_VIEW_OWN == "indent.view_own"
    assert PermissionCode.INDENT_TRANSFER == "indent.transfer"
    assert PermissionCode.INDENT_WITHDRAW == "indent.withdraw"
    assert PermissionCode.INDENT_RECEIVE_GRN == "indent.receive_grn"
    assert PermissionCode.INDENT_VIEW_TRACKING == "indent.view_tracking"


def test_indent_transfer_request_validation():
    """Verify IndentTransferRequest schema validation and fields."""
    bu_id = uuid4()
    cc_id = uuid4()
    cat_id = uuid4()
    buyer_id = uuid4()

    req = IndentTransferRequest(
        title="Lab Equipment Indent",
        business_unit_id=bu_id,
        cost_center_id=cc_id,
        category_id=cat_id,
        procurement_type="OPEX",
        assigned_buyer_id=buyer_id,
        indent_notes="Urgent requirement for testing bench",
        lines=[
            PRLineItemRequest(
                line_number=1,
                item_description="Digital Oscilloscope",
                category_id=cat_id,
                uom_id=uuid4(),
                quantity=Decimal("2"),
                estimated_unit_price=Decimal("45000.00"),
            )
        ],
    )

    assert req.title == "Lab Equipment Indent"
    assert req.assigned_buyer_id == buyer_id
    assert req.indent_notes == "Urgent requirement for testing bench"
    assert len(req.lines) == 1


@pytest.mark.asyncio
async def test_create_indent_sets_indentor_flags_and_status(requisition_service):
    """create_indent must set is_indent=True, indentor_id, source=INDENT_CART, and status=SUBMITTED."""
    mock_db = AsyncMock()
    org_id = uuid4()
    actor_id = uuid4()
    buyer_id = uuid4()

    actor = MagicMock(spec=User)
    actor.id = actor_id
    actor.org_id = org_id

    created_pr = MagicMock(spec=Requisition)
    created_pr.id = uuid4()
    created_pr.pr_number = "PR-IT-2026-000099"
    created_pr.title = "Lab Test Equipment"
    created_pr.status = PRStatus.DRAFT

    requisition_service.create = AsyncMock(return_value=created_pr)
    requisition_service.get_available_buyers = AsyncMock(return_value=[])

    data = MagicMock(spec=IndentTransferRequest)
    data.assigned_buyer_id = buyer_id
    data.indent_notes = "Special notes to buyer"
    data.category_id = uuid4()
    data.business_unit_id = uuid4()

    with patch("app.modules.requisition.service.audit_service.log", new=AsyncMock()):
        result = await requisition_service.create_indent(
            mock_db,
            data=data,
            actor=actor,
            org_id=org_id,
        )

    assert result.is_indent is True
    assert result.indentor_id == actor_id
    assert result.assigned_buyer_id == buyer_id
    assert result.indent_notes == "Special notes to buyer"
    assert result.source == PRSource.INDENT_CART
    assert result.status == PRStatus.SUBMITTED
    requisition_service.repo.update.assert_awaited_once_with(mock_db, created_pr)


@pytest.mark.asyncio
async def test_create_indent_auto_assigns_buyer_when_none_specified(requisition_service):
    """When assigned_buyer_id is None, create_indent auto-assigns from available buyers."""
    mock_db = AsyncMock()
    org_id = uuid4()
    actor_id = uuid4()
    auto_buyer_id = uuid4()

    actor = MagicMock(spec=User)
    actor.id = actor_id
    actor.org_id = org_id

    created_pr = MagicMock(spec=Requisition)
    created_pr.id = uuid4()
    created_pr.pr_number = "PR-IT-2026-000100"
    created_pr.title = "Monitor Demand"
    created_pr.status = PRStatus.DRAFT

    requisition_service.create = AsyncMock(return_value=created_pr)
    buyer_item = BuyerSelectionItem(
        id=auto_buyer_id,
        name="Sarah Jenkins",
        email="buyer@procurement.com",
    )
    requisition_service.get_available_buyers = AsyncMock(return_value=[buyer_item])

    data = MagicMock(spec=IndentTransferRequest)
    data.assigned_buyer_id = None
    data.indent_notes = None
    data.category_id = uuid4()
    data.business_unit_id = uuid4()

    with patch("app.modules.requisition.service.audit_service.log", new=AsyncMock()):
        result = await requisition_service.create_indent(
            mock_db,
            data=data,
            actor=actor,
            org_id=org_id,
        )

    assert result.assigned_buyer_id == auto_buyer_id


@pytest.mark.asyncio
async def test_get_available_buyers_queries_buyer_role_users(requisition_service):
    """get_available_buyers queries users assigned the BUYER role."""
    mock_db = AsyncMock()
    org_id = uuid4()

    mock_user = MagicMock(spec=User)
    mock_user.id = uuid4()
    mock_user.first_name = "Sarah"
    mock_user.last_name = "Buyer"
    mock_user.email = "buyer@procurement.com"
    mock_user.department_id = None

    mock_db.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(unique=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[mock_user])))))
    )

    buyers = await requisition_service.get_available_buyers(mock_db, org_id=org_id)
    assert len(buyers) == 1
    assert buyers[0].id == mock_user.id
    assert buyers[0].name == "Sarah Buyer"
    assert buyers[0].email == "buyer@procurement.com"


@pytest.mark.asyncio
async def test_get_indentor_tracking_filters_by_actor_and_indent_flag(requisition_service):
    """get_indentor_tracking returns only indents belonging to the requesting indentor."""
    mock_db = AsyncMock()
    org_id = uuid4()
    indentor = MagicMock(spec=User)
    indentor.id = uuid4()

    pr_mock = MagicMock(spec=Requisition)
    pr_mock.id = uuid4()
    pr_mock.pr_number = "PR-IT-2026-000101"
    pr_mock.is_indent = True
    pr_mock.indentor_id = indentor.id

    mock_db.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=1)),  # count
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[pr_mock])))),  # select
    ]

    with patch("app.modules.user.role_repository.role_repository.get_user_role_codes", new_callable=AsyncMock, return_value=["INDENTOR"]):
        items, total = await requisition_service.get_indentor_tracking(
            mock_db, actor=indentor, org_id=org_id, page=1, page_size=20
        )

    assert total == 1
    assert len(items) == 1
    assert items[0].id == pr_mock.id
