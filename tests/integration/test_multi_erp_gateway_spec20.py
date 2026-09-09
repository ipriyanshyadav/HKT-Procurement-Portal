from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.modules.integration.service import integration_service
from app.modules.organization.models import Organization


@pytest.fixture
async def db_session():
    test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_multi_erp_bi_directional_sync_and_dlq(db_session: AsyncSession):
    # 1. Setup isolated organization
    org_id = uuid4()
    org = Organization(
        id=org_id,
        name=f"ERP Gateway Test Org {uuid4().hex[:6]}",
        legal_name=f"ERP Gateway Test Org Legal {uuid4().hex[:6]}",
    )
    db_session.add(org)
    await db_session.commit()

    po_id = uuid4()
    invoice_id = uuid4()

    # 2. Outbound SAP S/4HANA PO Sync (IDoc ORDERS05)
    sap_po_sync = await integration_service.sync_entity_to_erp(
        db_session,
        org_id=org_id,
        erp_system="SAP_S4HANA",
        entity_type="PURCHASE_ORDER",
        internal_id=po_id,
    )
    await db_session.commit()

    assert sap_po_sync["status"] == "SUCCESS"
    assert sap_po_sync["erp_system"] == "SAP_S4HANA"
    assert sap_po_sync["entity_type"] == "PURCHASE_ORDER"
    assert sap_po_sync["idoc_number"] is not None
    assert "IDOC-ORDERS" in sap_po_sync["idoc_number"]
    assert sap_po_sync["payload_checksum"] is not None

    # 3. Idempotency Check: Second call returns existing mapping without re-posting
    sap_idempotent_sync = await integration_service.sync_entity_to_erp(
        db_session,
        org_id=org_id,
        erp_system="SAP_S4HANA",
        entity_type="PURCHASE_ORDER",
        internal_id=po_id,
        force_retry=False,
    )
    assert "already synchronized" in sap_idempotent_sync["message"].lower()
    assert sap_idempotent_sync["external_id"] == sap_po_sync["external_id"]

    # 4. Outbound NetSuite Invoice Sync (SuiteTalk vendorBill)
    ns_inv_sync = await integration_service.sync_entity_to_erp(
        db_session,
        org_id=org_id,
        erp_system="NETSUITE",
        entity_type="INVOICE",
        internal_id=invoice_id,
    )
    await db_session.commit()

    assert ns_inv_sync["status"] == "SUCCESS"
    assert ns_inv_sync["erp_system"] == "NETSUITE"
    assert "NS-BILL" in ns_inv_sync["external_id"]
    assert ns_inv_sync["payload_checksum"] is not None

    # 5. Inbound ERP Webhook Payload Processing
    inbound_res = await integration_service.process_inbound_erp_payload(
        db_session,
        org_id=org_id,
        erp_system="SAP_S4HANA",
        entity_type="GOODS_RECEIPT",
        external_id="SAP-GRN-99881122",
        payload={
            "document_number": "SAP-GRN-99881122",
            "movement_type": "101",
            "quantity_received": 100,
            "status": "POSTED",
        },
    )
    await db_session.commit()

    assert inbound_res["status"] == "ACCEPTED"
    assert inbound_res["external_id"] == "SAP-GRN-99881122"

    # 6. Reconciliation Parity Report
    recon = await integration_service.get_erp_reconciliation_report(db_session, org_id=org_id)
    assert recon["total_mapped_entities"] >= 3
    assert recon["success_count"] >= 3
    assert recon["parity_percentage"] == 100.0

    # 7. Dead Letter Queue & Force Retry Recovery Flow
    # Simulate a failed entity transitioning to DEAD_LETTER after 3 retries
    dead_letter_entity_id = uuid4()
    failed_mapping = await integration_service.repo.upsert_entity_mapping(
        db=db_session,
        org_id=org_id,
        erp_system="NETSUITE",
        entity_type="VENDOR",
        internal_id=dead_letter_entity_id,
        external_id=f"NS-ERR-{dead_letter_entity_id.hex[:6]}",
        sync_status="DEAD_LETTER",
        retry_count=3,
        last_error="NetSuite API Connection Timeout (Max Retries Exceeded)",
    )
    await db_session.commit()

    # Verify reconciliation report picks up DLQ item
    recon_with_dlq = await integration_service.get_erp_reconciliation_report(db_session, org_id=org_id)
    assert recon_with_dlq["dead_letter_count"] >= 1
    dlq_ids = [m.id for m in recon_with_dlq["dead_letter_queue"]]
    assert failed_mapping.id in dlq_ids

    # Trigger force retry on DLQ item
    recovered_sync = await integration_service.retry_dlq_mapping(
        db_session, org_id=org_id, mapping_id=failed_mapping.id
    )
    await db_session.commit()

    assert recovered_sync["status"] == "SUCCESS"
    assert recovered_sync["entity_type"] == "VENDOR"

    # Verify DLQ cleared for this entity
    final_recon = await integration_service.get_erp_reconciliation_report(db_session, org_id=org_id)
    assert final_recon["dead_letter_count"] == 0
