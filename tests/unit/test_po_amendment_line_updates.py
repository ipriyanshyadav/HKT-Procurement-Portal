import pytest
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.core.exceptions import ValidationError, NotFoundError
from app.db.enums import POStatus
from app.modules.purchase_order.models import PurchaseOrder, PoLine
from app.modules.purchase_order.schemas import POAmendRequest, POLineUpdate
from app.modules.purchase_order.service import PurchaseOrderService


@pytest.mark.asyncio
async def test_amend_po_with_line_updates_minor_change():
    service = PurchaseOrderService()
    service.repo = MagicMock()
    service.repo.get = AsyncMock()
    service.repo.next_amendment_number = AsyncMock(return_value=1)
    service.repo.create_amendment = AsyncMock()
    service.audit = MagicMock()
    service.audit.log = AsyncMock()
    service.publisher = MagicMock()
    service.publisher.publish = AsyncMock()
    service.contract_service = MagicMock()
    service.contract_service.update_utilization = AsyncMock()
    service.workflow_service = MagicMock()
    service.workflow_service.initiate = AsyncMock()

    org_id = uuid4()
    actor_id = uuid4()
    po_id = uuid4()
    line1_id = uuid4()
    line2_id = uuid4()

    line1 = MagicMock(spec=PoLine)
    line1.id = line1_id
    line1.line_number = 1
    line1.ordered_quantity = Decimal("10.0")
    line1.received_quantity = Decimal("2.0")
    line1.open_quantity = Decimal("8.0")
    line1.unit_price = Decimal("100.0")
    line1.delivery_date = date(2026, 10, 1)
    line1.item_description = "Industrial Valves"

    line2 = MagicMock(spec=PoLine)
    line2.id = line2_id
    line2.line_number = 2
    line2.ordered_quantity = Decimal("5.0")
    line2.received_quantity = Decimal("0.0")
    line2.open_quantity = Decimal("5.0")
    line2.unit_price = Decimal("200.0")
    line2.delivery_date = date(2026, 10, 15)
    line2.item_description = "Pipe Fittings"

    po = MagicMock(spec=PurchaseOrder)
    po.id = po_id
    po.po_number = "PO-2026-0001"
    po.status = POStatus.RELEASED
    po.total_value = Decimal("2000.00")  # (10*100) + (5*200)
    po.currency = "INR"
    po.amendment_count = 0
    po.contract_id = None
    po.business_unit_id = uuid4()
    po.vendor_id = uuid4()
    po.cost_center_id = uuid4()
    po.lines = [line1, line2]

    service.repo.get.return_value = po

    # Minor update: Line 1 qty increased from 10 to 11 (+100.0, 5% of 2000 => below 10% threshold)
    request = POAmendRequest(
        reason="Requested 1 additional valve for backup",
        line_updates=[
            POLineUpdate(
                po_line_id=line1_id,
                ordered_quantity=Decimal("11.0"),
            )
        ]
    )

    result = await service.amend_po(AsyncMock(), po_id, request, actor_id, org_id)

    assert result.status == POStatus.AMENDED
    assert result.total_value == Decimal("2100.0")
    assert result.amendment_count == 1
    assert line1.ordered_quantity == Decimal("11.0")
    assert line1.open_quantity == Decimal("9.0")  # 11 - 2 received
    service.repo.create_amendment.assert_called_once()
    service.publisher.publish.assert_called_once()


@pytest.mark.asyncio
async def test_amend_po_line_update_cannot_reduce_below_received():
    service = PurchaseOrderService()
    service.repo = MagicMock()
    service.repo.get = AsyncMock()

    org_id = uuid4()
    actor_id = uuid4()
    po_id = uuid4()
    line1_id = uuid4()

    line1 = MagicMock(spec=PoLine)
    line1.id = line1_id
    line1.line_number = 1
    line1.ordered_quantity = Decimal("10.0")
    line1.received_quantity = Decimal("5.0")
    line1.open_quantity = Decimal("5.0")
    line1.unit_price = Decimal("100.0")

    po = MagicMock(spec=PurchaseOrder)
    po.id = po_id
    po.po_number = "PO-2026-0002"
    po.lines = [line1]
    service.repo.get.return_value = po

    # Try reducing ordered quantity to 4, when 5 are already received
    request = POAmendRequest(
        reason="Invalid reduction",
        line_updates=[
            POLineUpdate(
                po_line_id=line1_id,
                ordered_quantity=Decimal("4.0"),
            )
        ]
    )

    with pytest.raises(ValidationError) as exc:
        await service.amend_po(AsyncMock(), po_id, request, actor_id, org_id)
    assert "Cannot reduce ordered quantity" in str(exc.value)


@pytest.mark.asyncio
async def test_amend_po_major_change_triggers_reapproval():
    service = PurchaseOrderService()
    service.repo = MagicMock()
    service.repo.get = AsyncMock()
    service.repo.next_amendment_number = AsyncMock(return_value=1)
    service.repo.create_amendment = AsyncMock()
    service.audit = MagicMock()
    service.audit.log = AsyncMock()
    service.publisher = MagicMock()
    service.publisher.publish = AsyncMock()
    service.rules_engine = MagicMock()
    rule_mock = MagicMock()
    rule_mock.workflow_template_code = "PO_REAPPROVAL_STANDARD"
    service.rules_engine.find_matching_rule = AsyncMock(return_value=rule_mock)
    service.workflow_engine = MagicMock()
    service.workflow_engine.instantiate = AsyncMock()

    org_id = uuid4()
    actor_id = uuid4()
    po_id = uuid4()
    line1_id = uuid4()

    line1 = MagicMock(spec=PoLine)
    line1.id = line1_id
    line1.line_number = 1
    line1.ordered_quantity = Decimal("10.0")
    line1.received_quantity = Decimal("0.0")
    line1.open_quantity = Decimal("10.0")
    line1.unit_price = Decimal("100.0")
    line1.delivery_date = date(2026, 10, 1)
    line1.item_description = "High Torque Motor"

    po = MagicMock(spec=PurchaseOrder)
    po.id = po_id
    po.po_number = "PO-2026-0003"
    po.status = POStatus.RELEASED
    po.total_value = Decimal("1000.00")
    po.currency = "INR"
    po.amendment_count = 0
    po.contract_id = None
    po.business_unit_id = uuid4()
    po.vendor_id = uuid4()
    po.cost_center_id = uuid4()
    po.lines = [line1]

    service.repo.get.return_value = po

    # Major change: Qty increased from 10 to 15 (+500, which is 50% > 10% threshold)
    request = POAmendRequest(
        reason="Scope expansion for Plant B",
        line_updates=[
            POLineUpdate(
                po_line_id=line1_id,
                ordered_quantity=Decimal("15.0"),
            )
        ]
    )

    result = await service.amend_po(AsyncMock(), po_id, request, actor_id, org_id)

    assert result.status == POStatus.PENDING_APPROVAL
    assert result.total_value == Decimal("1500.0")
    service.workflow_engine.instantiate.assert_called_once()
