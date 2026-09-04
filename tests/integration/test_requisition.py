from __future__ import annotations
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.config import settings
from app.core.exceptions import AppException, ForbiddenError, NotFoundError, ConflictError
from app.core.redis_client import RedisKeys
from app.db.enums import PRStatus, ProcurementType, UnmappedPrStatusEnum
from app.modules.requisition.fsm import validate_pr_transition, InvalidPrTransitionError
from app.modules.requisition.models import Requisition, RequisitionLine
from app.modules.requisition.schemas import (
    PRCreateRequest,
    PRLineItemRequest,
    PRMergeRequest,
    PRSplitItem,
    PRSplitRequest,
    PRUpdateRequest,
)
from app.modules.requisition.service import requisition_service
from app.modules.unmapped_pr.schemas import UnmappedPRMappingItem
from app.modules.unmapped_pr.service import unmapped_pr_service

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def create_pr_fixtures(db: AsyncSession, org_id: UUID) -> dict:
    """Create test organization, legal entity, business units, cost centers, categories, and users."""
    actor_id = uuid4()
    checker_id = uuid4()
    bu1_id = uuid4()
    bu2_id = uuid4()
    cc1_id = uuid4()
    cat1_id = uuid4()
    cat2_id = uuid4()
    uom_id = uuid4()
    le_id = uuid4()

    # Org
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, :name, :legal_name, 'IN', 'INR', '{"budget_check_config": {"default_mode": "soft"}}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Org {org_id.hex[:6]}", "legal_name": f"Legal {org_id.hex[:6]}"},
    )

    # Users
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Test', 'User', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": actor_id, "org_id": org_id, "email": f"user-{actor_id.hex[:6]}@test.com"},
    )
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Checker', 'User', 'ACTIVE', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": checker_id, "org_id": org_id, "email": f"checker-{checker_id.hex[:6]}@test.com"},
    )

    # Legal Entity
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
        VALUES (:id, :org_id, 'Test Entity', :reg, 'IN')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG-{le_id.hex[:8]}"},
    )

    # Business Units
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, legal_entity_id, code, name)
        VALUES (:id, :org_id, :le_id, 'CORP', 'Corporate BU')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu1_id, "org_id": org_id, "le_id": le_id},
    )
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, legal_entity_id, code, name)
        VALUES (:id, :org_id, :le_id, 'PLANT1', 'Plant 1 BU')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": bu2_id, "org_id": org_id, "le_id": le_id},
    )

    # Cost Center
    await db.execute(
        text("""
        INSERT INTO cost_centers (id, org_id, business_unit_id, code, name, annual_budget, available_budget)
        VALUES (:id, :org_id, :bu_id, 'CC-01', 'IT Cost Center', 1000000.0, 500000.0)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": cc1_id, "org_id": org_id, "bu_id": bu1_id},
    )

    # Categories
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, code, name, level)
        VALUES (:id, :org_id, :code, 'IT Hardware', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat1_id, "org_id": org_id, "code": f"CAT1-{cat1_id.hex[:6]}"},
    )
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, code, name, level)
        VALUES (:id, :org_id, :code, 'Office Supplies', 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat2_id, "org_id": org_id, "code": f"CAT2-{cat2_id.hex[:6]}"},
    )

    # UOM
    await db.execute(
        text("""
        INSERT INTO uom_master (id, org_id, code, name)
        VALUES (:id, :org_id, :code, 'Each')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id, "code": f"EA-{uom_id.hex[:4]}"},
    )

    await db.commit()

    return {
        "org_id": org_id,
        "actor_id": actor_id,
        "checker_id": checker_id,
        "bu1_id": bu1_id,
        "bu2_id": bu2_id,
        "cc1_id": cc1_id,
        "cat1_id": cat1_id,
        "cat2_id": cat2_id,
        "uom_id": uom_id,
    }


# ─── 1. PR Number Auto-Generation ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_pr_number_format():
    """PR number format: {BU_CODE}-PR-{YYYY}-{NNNNNN} matching ^[A-Z0-9]+-PR-\d{4}-\d{6}$."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_fixtures(db, org_id)

        create_data = PRCreateRequest(
            title="Laptop Procurement 2026",
            description="Laptops for new engineering hires",
            procurement_type=ProcurementType.OPEX,
            business_unit_id=fx["bu1_id"],
            cost_center_id=fx["cc1_id"],
            category_id=fx["cat1_id"],
            lines=[
                PRLineItemRequest(
                    line_number=1,
                    item_description="Dell XPS 15 32GB RAM",
                    category_id=fx["cat1_id"],
                    uom_id=fx["uom_id"],
                    quantity=Decimal("5.0"),
                    estimated_unit_price=Decimal("150000.0"),
                )
            ],
        )

        pr = await requisition_service.create(db, create_data, fx["actor_id"], org_id)
        await db.commit()

        assert pr.pr_number is not None
        assert re.match(r"^[A-Z0-9]+-PR-\d{4}-\d{6}$", pr.pr_number)
        assert pr.pr_number.startswith("CORP-PR-")
        assert pr.estimated_value == Decimal("750000.0")


# ─── 2. Merge Requires Same BU (MUST PASS) ─────────────────────────────────

@pytest.mark.asyncio
async def test_merge_requires_same_bu():
    """PRs from different Business Units cannot merge (raises MERGE_DIFFERENT_BU)."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_fixtures(db, org_id)

        # Create PR in BU1
        pr1 = await requisition_service.create(
            db,
            PRCreateRequest(
                title="PR 1 - BU 1",
                business_unit_id=fx["bu1_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat1_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Item 1",
                        category_id=fx["cat1_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("2"),
                        estimated_unit_price=Decimal("100"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )

        # Create PR in BU2
        pr2 = await requisition_service.create(
            db,
            PRCreateRequest(
                title="PR 2 - BU 2",
                business_unit_id=fx["bu2_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat1_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Item 2",
                        category_id=fx["cat1_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("3"),
                        estimated_unit_price=Decimal("100"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        await db.commit()

        with pytest.raises(AppException) as exc_info:
            await requisition_service.merge_prs(
                db,
                pr_ids=[pr1.id, pr2.id],
                actor_id=fx["actor_id"],
                org_id=org_id,
            )
        assert exc_info.value.code == "MERGE_DIFFERENT_BU"


# ─── 3. Merge Requires Same Category ───────────────────────────────────────

@pytest.mark.asyncio
async def test_merge_requires_same_category():
    """PRs from different categories cannot merge (raises MERGE_DIFFERENT_CATEGORY)."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_fixtures(db, org_id)

        pr1 = await requisition_service.create(
            db,
            PRCreateRequest(
                title="PR 1 - IT Hardware",
                business_unit_id=fx["bu1_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat1_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Monitors",
                        category_id=fx["cat1_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("2"),
                        estimated_unit_price=Decimal("20000"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )

        pr2 = await requisition_service.create(
            db,
            PRCreateRequest(
                title="PR 2 - Office Supplies",
                business_unit_id=fx["bu1_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat2_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Paper",
                        category_id=fx["cat2_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("5"),
                        estimated_unit_price=Decimal("500"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        await db.commit()

        with pytest.raises(AppException) as exc_info:
            await requisition_service.merge_prs(
                db,
                pr_ids=[pr1.id, pr2.id],
                actor_id=fx["actor_id"],
                org_id=org_id,
            )
        assert exc_info.value.code == "MERGE_DIFFERENT_CATEGORY"


# ─── 4. Budget Hard Block (MUST PASS) ───────────────────────────────────────

@pytest.mark.asyncio
async def test_budget_hard_block():
    """HARD budget block raises BUDGET_INSUFFICIENT exception on submit."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_fixtures(db, org_id)

        # Set org budget mode override to "hard"
        await db.execute(
            text("""
            UPDATE organizations
            SET settings = '{"budget_check_config": {"default_mode": "hard"}}'
            WHERE id = :id
            """),
            {"id": org_id},
        )
        # Cost center available budget is 500,000. PR estimated value is 600,000
        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="Over Budget Request",
                business_unit_id=fx["bu1_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat1_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="High-end Workstations",
                        category_id=fx["cat1_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("3"),
                        estimated_unit_price=Decimal("200000"),  # Total 600,000 > 500,000 available
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        await db.commit()

        with pytest.raises(AppException) as exc_info:
            await requisition_service.submit(db, pr.id, fx["actor_id"], org_id)
        assert exc_info.value.code == "BUDGET_INSUFFICIENT"


# ─── 5. PR Cache Invalidated (MUST PASS) ────────────────────────────────────

@pytest.mark.asyncio
async def test_pr_cache_invalidated():
    """Redis cache keys for PR count by status are deleted on status changes."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_fixtures(db, org_id)

        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="PR for Cache Test",
                business_unit_id=fx["bu1_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat1_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Headsets",
                        category_id=fx["cat1_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("1"),
                        estimated_unit_price=Decimal("5000"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        await db.commit()

        mock_redis = AsyncMock()
        with patch("app.modules.requisition.service.get_redis_client", return_value=mock_redis):
            await requisition_service._invalidate_pr_cache(org_id)
            assert mock_redis.delete.called
            calls = [c[0][0] for c in mock_redis.delete.call_args_list]
            expected_key = RedisKeys.pr_count_cache(org_id, "DRAFT")
            assert expected_key in calls


# ─── 6. PR Creator Cannot Approve (MUST PASS) ───────────────────────────────

@pytest.mark.asyncio
async def test_pr_creator_cannot_approve():
    """Maker-checker rule: PR creator cannot approve their own PR."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_fixtures(db, org_id)

        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="PR for Maker Checker",
                business_unit_id=fx["bu1_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat1_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Monitors",
                        category_id=fx["cat1_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("1"),
                        estimated_unit_price=Decimal("10000"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        # Advance PR to PENDING_APPROVAL
        pr.status = PRStatus.PENDING_APPROVAL
        await db.commit()

        # Creator attempts to approve -> ForbiddenError
        with pytest.raises(ForbiddenError):
            await requisition_service.approve(
                db,
                pr_id=pr.id,
                task_id=None,
                comment="Self approving",
                actor_id=fx["actor_id"],  # Creator!
                org_id=org_id,
            )

        # Different user (checker) approves -> Success
        approved_pr = await requisition_service.approve(
            db,
            pr_id=pr.id,
            task_id=None,
            comment="Approved by manager",
            actor_id=fx["checker_id"],  # Different user!
            org_id=org_id,
        )
        assert approved_pr.status == PRStatus.APPROVED


# ─── 7. PR Split Logic ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_split_pr():
    """Split an approved PR into 2 child PRs by category."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_fixtures(db, org_id)

        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="Multi-category Equipment",
                business_unit_id=fx["bu1_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat1_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Servers",
                        category_id=fx["cat1_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("2"),
                        estimated_unit_price=Decimal("100000"),
                    ),
                    PRLineItemRequest(
                        line_number=2,
                        item_description="Printers",
                        category_id=fx["cat2_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("4"),
                        estimated_unit_price=Decimal("20000"),
                    ),
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        pr.status = PRStatus.APPROVED
        await db.commit()

        split_request = PRSplitRequest(
            splits=[
                PRSplitItem(category_id=fx["cat1_id"], line_numbers=[1], title="Server Split"),
                PRSplitItem(category_id=fx["cat2_id"], line_numbers=[2], title="Printer Split"),
            ]
        )

        children = await requisition_service.split_pr(
            db, pr.id, split_request, fx["actor_id"], org_id
        )
        await db.commit()

        assert len(children) == 2
        assert pr.status == PRStatus.SPLIT
        assert len(pr.split_into) == 2
        assert children[0].estimated_value == Decimal("200000")
        assert children[1].estimated_value == Decimal("80000")


# ─── 8. PR Withdrawal ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_withdraw_pr():
    """Only PR creator can withdraw a draft or submitted PR."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_fixtures(db, org_id)

        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="PR to withdraw",
                business_unit_id=fx["bu1_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat1_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Cables",
                        category_id=fx["cat1_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("10"),
                        estimated_unit_price=Decimal("100"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        await db.commit()

        # Non-owner fails
        with pytest.raises(ForbiddenError):
            await requisition_service.withdraw(db, pr.id, fx["checker_id"], org_id)

        # Owner succeeds
        withdrawn = await requisition_service.withdraw(db, pr.id, fx["actor_id"], org_id)
        assert withdrawn.status == PRStatus.WITHDRAWN


# ─── 9. Conversion to RFQ and PO ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_convert_to_rfq_and_po():
    """Approved PR converts to RFQ (IN_SOURCING) and then to PO (CONVERTED)."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_fixtures(db, org_id)

        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="PR for conversion",
                business_unit_id=fx["bu1_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat1_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Keyboards",
                        category_id=fx["cat1_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("5"),
                        estimated_unit_price=Decimal("2000"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        pr.status = PRStatus.APPROVED
        await db.commit()

        # Convert to RFQ
        rfq_pr = await requisition_service.convert_to_rfq(db, pr.id, fx["actor_id"], org_id)
        assert rfq_pr.status == PRStatus.IN_SOURCING

        # Convert to PO
        po_pr = await requisition_service.convert_to_po(db, pr.id, fx["actor_id"], org_id)
        assert po_pr.status == PRStatus.CONVERTED


# ─── 10. Unmapped PR Exception Handling & Auto-Map ─────────────────────────

@pytest.mark.asyncio
async def test_unmapped_pr_lifecycle():
    """Test flagging unmapped PR, mapping suggestions, auto-mapping threshold, and resolve."""
    org_id = uuid4()
    async with TestSession() as db:
        fx = await create_pr_fixtures(db, org_id)

        pr = await requisition_service.create(
            db,
            PRCreateRequest(
                title="ERP PR with missing mapping",
                business_unit_id=fx["bu1_id"],
                cost_center_id=fx["cc1_id"],
                category_id=fx["cat1_id"],
                lines=[
                    PRLineItemRequest(
                        line_number=1,
                        item_description="Unmapped chemicals from SAP",
                        category_id=fx["cat1_id"],
                        uom_id=fx["uom_id"],
                        quantity=Decimal("100"),
                        estimated_unit_price=Decimal("50"),
                    )
                ],
            ),
            fx["actor_id"],
            org_id,
        )
        await db.commit()

        # 1. Flag as unmapped
        exc = await unmapped_pr_service.flag_as_unmapped(
            db,
            requisition_id=pr.id,
            failed_fields=[{"field": "category_id", "source_value": "RAW-CHEM-01"}],
            org_id=org_id,
            erp_reference="SAP-PR-9001",
        )
        await db.commit()

        assert exc.status == UnmappedPrStatusEnum.PENDING
        assert pr.status == PRStatus.UNMAPPED

        # 2. Suggest mapping
        suggestion = await unmapped_pr_service.suggest_mapping(db, exc.id, org_id)
        assert "confidence" in suggestion
        assert "auto_apply" in suggestion

        # 3. Auto-map when confidence < 0.85 raises 422
        if suggestion["confidence"] < 0.85:
            with pytest.raises(AppException) as exc_info:
                await unmapped_pr_service.auto_map(db, exc.id, fx["actor_id"], org_id)
            assert exc_info.value.code == "CONFIDENCE_TOO_LOW"

        # 4. Manual mapping resolves exception
        resolved_pr = await unmapped_pr_service.map_pr(
            db,
            exception_id=exc.id,
            mappings=[{"field": "category_id", "value": fx["cat2_id"]}],
            actor_id=fx["actor_id"],
            org_id=org_id,
            notes="Manually assigned to Office Supplies",
        )
        await db.commit()

        assert exc.status == UnmappedPrStatusEnum.RESOLVED
        assert resolved_pr.category_id == fx["cat2_id"]

        # 5. Cannot re-map resolved exception
        with pytest.raises(ConflictError):
            await unmapped_pr_service.map_pr(
                db,
                exception_id=exc.id,
                mappings=[{"field": "category_id", "value": fx["cat1_id"]}],
                actor_id=fx["actor_id"],
                org_id=org_id,
            )
