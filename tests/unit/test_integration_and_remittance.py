from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.db.enums import IntegrationJobStatusEnum, PaymentStatusEnum
from app.modules.integration.models import IntegrationJob
from app.modules.integration.repository import IntegrationRepository
from app.modules.integration.service import IntegrationService
from app.modules.invoice.models import Invoice
from app.modules.payment.models import PaymentRecord
from app.modules.payment.service import PaymentService
from app.modules.vendor.models import Vendor
from app.modules.vendor.schemas import BulkVendorCategoryMappingItem
from app.modules.vendor.service import VendorService


@pytest.mark.asyncio
async def test_integration_stats_calculation():
    mock_repo = MagicMock(spec=IntegrationRepository)
    mock_repo.get_stats = AsyncMock(
        return_value={
            "total_jobs": 10,
            "pending_jobs": 2,
            "in_progress_jobs": 1,
            "completed_jobs": 6,
            "failed_jobs": 1,
            "retry_scheduled_jobs": 0,
            "success_rate": 60.0,
        }
    )
    service = IntegrationService(repo=mock_repo)
    db = AsyncMock()
    org_id = uuid4()
    stats = await service.get_stats(db, org_id)

    assert stats["total_jobs"] == 10
    assert stats["completed_jobs"] == 6
    assert stats["success_rate"] == 60.0


@pytest.mark.asyncio
async def test_vendor_bulk_category_mapping():
    mock_repo = MagicMock()
    v_id = uuid4()
    org_id = uuid4()
    actor_id = uuid4()
    mock_vendor = MagicMock(spec=Vendor)
    mock_vendor.id = v_id

    mock_repo.find_by_id = AsyncMock(return_value=mock_vendor)
    mock_repo.set_categories = AsyncMock()

    service = VendorService(repo=mock_repo)
    service.audit = MagicMock()
    service.audit.log = AsyncMock()

    cat_id1 = uuid4()
    items = [BulkVendorCategoryMappingItem(vendor_id=v_id, category_ids=[cat_id1])]

    db = AsyncMock()
    db.add = MagicMock()
    res = await service.bulk_map_categories(db, items, actor_id, org_id)

    assert res.total_processed == 1
    assert res.updated_vendors == 1
    assert len(res.errors) == 0
    mock_repo.set_categories.assert_awaited_once()


def test_payment_remittance_pdf_generation():
    service = PaymentService()
    pmt = MagicMock(spec=PaymentRecord)
    pmt.id = uuid4()
    pmt.status = PaymentStatusEnum.COMPLETED
    pmt.payment_date = date.today()
    pmt.utr_number = "UTR9876543210"
    pmt.payment_method = "NEFT"
    pmt.executed_at = datetime.now(timezone.utc)
    pmt.vendor_id = uuid4()
    pmt.amount = Decimal("50000.00")
    pmt.tds_amount = Decimal("1000.00")
    pmt.tds_rate = Decimal("2.0")
    pmt.net_amount = Decimal("49000.00")

    inv = MagicMock(spec=Invoice)
    inv.invoice_number = "INV-2026-001"
    inv.invoice_date = date.today()
    inv.total_amount = Decimal("50000.00")

    v = MagicMock(spec=Vendor)
    v.company_name = "Acme Supplies Ltd"
    v.vendor_code = "VEND-001"
    v.pan = "ABCDE1234F"
    v.gstin = "27ABCDE1234F1Z5"

    pdf_bytes = service.generate_remittance_pdf(pmt, inv, v)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_integration_trigger_sync():
    mock_repo = MagicMock(spec=IntegrationRepository)
    service = IntegrationService(repo=mock_repo)
    service.audit = MagicMock()
    service.audit.log = AsyncMock()

    db = AsyncMock()
    db.add = MagicMock()
    # Mock db.execute returning empty lists for queries
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = []
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    db.execute = AsyncMock(return_value=mock_result)

    actor_id = uuid4()
    org_id = uuid4()

    res = await service.trigger_sync(
        db=db,
        actor_id=actor_id,
        org_id=org_id,
        adapter_type="SAP",
        entity_type=None,
    )

    assert res["status"] == "SUCCESS"
    assert res["adapter_type"] == "SAP"
    assert "jobs_created" in res
    assert "job_run_id" in res
    db.flush.assert_awaited()
    service.audit.log.assert_awaited_once()

