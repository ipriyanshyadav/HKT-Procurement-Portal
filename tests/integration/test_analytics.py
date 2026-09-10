"""
Integration tests for SPEC_25 Analytics & Reporting:
- S25-01: Procurement KPI metrics & formulas
- S25-02: Spend analytics (by category, vendor, BU)
- S25-03: Savings analytics & cost overrun handling
- S25-04: Vendor performance scorecard & comparison
- S25-05: Cycle time analytics (PR to PO, RFQ to Award)
- S25-06: SLA compliance report
- S25-07: Compliance dashboard
- S25-10: Cost of capital analysis (using organization cost_of_capital_rate)
- S25-14: CSV & Excel export
- S25-16: Access control & BU-scoped data isolation
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.dependencies import get_current_user
from app.config import settings
from app.db.session import get_db
from app.main import app
from app.modules.analytics.export_service import analytics_export_service
from app.modules.analytics.service import analytics_service
from app.modules.user.models import User

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def _override_get_db():
    async with TestSession() as session:
        yield session


async def create_analytics_fixtures(db: AsyncSession, org_id: UUID, cost_of_capital_rate: Decimal = Decimal("0.1500")) -> dict:
    """Sets up org, BUs, categories, vendors, users, PRs, and POs."""
    bu1_id = uuid4()
    bu2_id = uuid4()
    cat1_id = uuid4()
    cat2_id = uuid4()
    vendor1_id = uuid4()
    vendor2_id = uuid4()
    buyer1_id = uuid4()
    head_user_id = uuid4()
    le_id = uuid4()
    uom_id = uuid4()

    # 1. Organization
    await db.execute(
        text("""
            INSERT INTO organizations (id, name, legal_name, country_code, base_currency, cost_of_capital_rate, settings)
            VALUES (:id, :name, :legal_name, 'IN', 'INR', :cocr, '{"budget_check_config": {"default_mode": "soft"}}')
            ON CONFLICT (id) DO UPDATE SET cost_of_capital_rate = :cocr
        """),
        {
            "id": org_id,
            "name": f"Analytics Org {org_id.hex[:6]}",
            "legal_name": f"Legal Org {org_id.hex[:6]}",
            "cocr": cost_of_capital_rate,
        },
    )

    # 2. Legal Entity
    await db.execute(
        text("""
            INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
            VALUES (:id, :org_id, 'Analytics Legal Entity', :reg, 'IN')
            ON CONFLICT (id) DO NOTHING
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG{le_id.hex[:8]}"},
    )

    # 3. Business Units
    await db.execute(
        text("""
            INSERT INTO business_units (id, org_id, name, code, legal_entity_id)
            VALUES (:bu1, :org_id, 'Engineering BU', :code1, :le_id),
                   (:bu2, :org_id, 'Marketing BU', :code2, :le_id)
            ON CONFLICT (id) DO NOTHING
        """),
        {
            "bu1": bu1_id,
            "bu2": bu2_id,
            "org_id": org_id,
            "code1": f"ENG-{bu1_id.hex[:4]}",
            "code2": f"MKT-{bu2_id.hex[:4]}",
            "le_id": le_id,
        },
    )

    # 4. Users
    await db.execute(
        text("""
            INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version, business_unit_id)
            VALUES (:b1, :org_id, :email1, 'hash', 'Buyer', 'Eng', 'ACTIVE', 1, :bu1),
                   (:h1, :org_id, :email2, 'hash', 'Head', 'Procurement', 'ACTIVE', 1, NULL)
            ON CONFLICT (id) DO NOTHING
        """),
        {
            "b1": buyer1_id,
            "h1": head_user_id,
            "org_id": org_id,
            "email1": f"buyer-{buyer1_id.hex[:6]}@test.com",
            "email2": f"head-{head_user_id.hex[:6]}@test.com",
            "bu1": bu1_id,
        },
    )

    # 5. Categories
    await db.execute(
        text("""
            INSERT INTO categories (id, org_id, name, code, level)
            VALUES (:c1, :org_id, 'Software & IT', :code1, 1),
                   (:c2, :org_id, 'Marketing Services', :code2, 1)
            ON CONFLICT (id) DO NOTHING
        """),
        {
            "c1": cat1_id,
            "c2": cat2_id,
            "org_id": org_id,
            "code1": f"CAT1-{cat1_id.hex[:4]}",
            "code2": f"CAT2-{cat2_id.hex[:4]}",
        },
    )

    # 6. UOM
    await db.execute(
        text("""
            INSERT INTO uom_master (id, org_id, name, code)
            VALUES (:id, :org_id, 'Units', 'UNT')
            ON CONFLICT (id) DO NOTHING
        """),
        {"id": uom_id, "org_id": org_id},
    )

    # 7. Vendors
    await db.execute(
        text("""
            INSERT INTO vendors (id, org_id, vendor_code, company_name, primary_email, status, version)
            VALUES (:v1, :org_id, :code1, 'TechCorp Solutions', :email1, 'ACTIVE', 1),
                   (:v2, :org_id, :code2, 'AdAgency Worldwide', :email2, 'ACTIVE', 1)
            ON CONFLICT (id) DO NOTHING
        """),
        {
            "v1": vendor1_id,
            "v2": vendor2_id,
            "org_id": org_id,
            "code1": f"VND1-{vendor1_id.hex[:4]}",
            "code2": f"VND2-{vendor2_id.hex[:4]}",
            "email1": f"tech-{vendor1_id.hex[:4]}@test.com",
            "email2": f"agency-{vendor2_id.hex[:4]}@test.com",
        },
    )

    # 8. Cost Centers
    cc1_id = uuid4()
    cc2_id = uuid4()
    await db.execute(
        text("""
            INSERT INTO cost_centers (id, org_id, business_unit_id, code, name)
            VALUES (:cc1, :org_id, :bu1, :code1, 'Engineering CC'),
                   (:cc2, :org_id, :bu2, :code2, 'Marketing CC')
            ON CONFLICT (id) DO NOTHING
        """),
        {
            "cc1": cc1_id,
            "cc2": cc2_id,
            "org_id": org_id,
            "bu1": bu1_id,
            "bu2": bu2_id,
            "code1": f"CC1-{cc1_id.hex[:4]}",
            "code2": f"CC2-{cc2_id.hex[:4]}",
        },
    )

    await db.commit()

    return {
        "org_id": org_id,
        "bu1_id": bu1_id,
        "bu2_id": bu2_id,
        "cat1_id": cat1_id,
        "cat2_id": cat2_id,
        "vendor1_id": vendor1_id,
        "vendor2_id": vendor2_id,
        "buyer1_id": buyer1_id,
        "head_user_id": head_user_id,
        "cc1_id": cc1_id,
        "cc2_id": cc2_id,
        "uom_id": uom_id,
    }


@pytest.mark.asyncio
async def test_bu_scoped_user_cannot_see_other_bu_data():
    """MUST PASS: bu_scoped_user_cannot_see_other_bu_data.
    BU-scoped user sees only their BU's spend, while unscoped user sees full org spend.
    """
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_analytics_fixtures(db, org_id, cost_of_capital_rate=Decimal("0.1500"))

        pr1_id = uuid4()
        po1_id = uuid4()
        pr2_id = uuid4()
        po2_id = uuid4()

        # PR1 and PO1 in BU1 (Engineering)
        await db.execute(
            text("""
                INSERT INTO requisitions (id, org_id, pr_number, title, status, requestor_id, business_unit_id,
                                          cost_center_id, category_id, currency, estimated_value, version)
                VALUES (:pr1, :org_id, :num1, 'Server Cluster', 'APPROVED', :buyer1, :bu1,
                        :cc1, :cat1, 'INR', 100000.00, 1)
            """),
            {
                "pr1": pr1_id,
                "org_id": org_id,
                "num1": f"PR-{pr1_id.hex[:6]}",
                "buyer1": f["buyer1_id"],
                "bu1": f["bu1_id"],
                "cc1": f["cc1_id"],
                "cat1": f["cat1_id"],
            },
        )
        await db.execute(
            text("""
                INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, source_pr_id, status,
                                             business_unit_id, category_id, currency, total_value, buyer_id, version)
                VALUES (:po1, :org_id, :num1, 'Server PO', :v1, :pr1, 'APPROVED',
                        :bu1, :cat1, 'INR', 80000.00, :buyer1, 1)
            """),
            {
                "po1": po1_id,
                "org_id": org_id,
                "num1": f"PO-{po1_id.hex[:6]}",
                "v1": f["vendor1_id"],
                "pr1": pr1_id,
                "bu1": f["bu1_id"],
                "cat1": f["cat1_id"],
                "buyer1": f["buyer1_id"],
            },
        )

        # PR2 and PO2 in BU2 (Marketing)
        await db.execute(
            text("""
                INSERT INTO requisitions (id, org_id, pr_number, title, status, requestor_id, business_unit_id,
                                          cost_center_id, category_id, currency, estimated_value, version)
                VALUES (:pr2, :org_id, :num2, 'Campaign Services', 'APPROVED', :buyer1, :bu2,
                        :cc2, :cat2, 'INR', 200000.00, 1)
            """),
            {
                "pr2": pr2_id,
                "org_id": org_id,
                "num2": f"PR-{pr2_id.hex[:6]}",
                "buyer1": f["buyer1_id"],
                "bu2": f["bu2_id"],
                "cc2": f["cc2_id"],
                "cat2": f["cat2_id"],
            },
        )
        await db.execute(
            text("""
                INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, source_pr_id, status,
                                             business_unit_id, category_id, currency, total_value, buyer_id, version)
                VALUES (:po2, :org_id, :num2, 'Marketing PO', :v2, :pr2, 'APPROVED',
                        :bu2, :cat2, 'INR', 170000.00, :buyer1, 1)
            """),
            {
                "po2": po2_id,
                "org_id": org_id,
                "num2": f"PO-{po2_id.hex[:6]}",
                "v2": f["vendor2_id"],
                "pr2": pr2_id,
                "bu2": f["bu2_id"],
                "cat2": f["cat2_id"],
                "buyer1": f["buyer1_id"],
            },
        )
        await db.commit()

        # Test 1: BU1-scoped query only returns PO1 spend (80,000)
        bu1_spend = await analytics_service.get_spend_summary(
            db, org_id, fiscal_year=None, user_bu_scope=[f["bu1_id"]]
        )
        assert len(bu1_spend) == 1
        assert bu1_spend[0]["category_name"] == "Software & IT"
        assert bu1_spend[0]["total_spend"] == 80000.0
        assert bu1_spend[0]["po_count"] == 1

        # Test 2: BU2-scoped query only returns PO2 spend (170,000)
        bu2_spend = await analytics_service.get_spend_summary(
            db, org_id, fiscal_year=None, user_bu_scope=[f["bu2_id"]]
        )
        assert len(bu2_spend) == 1
        assert bu2_spend[0]["category_name"] == "Marketing Services"
        assert bu2_spend[0]["total_spend"] == 170000.0

        # Test 3: Unscoped query (user_bu_scope=[]) returns both PO1 + PO2 spend (250,000 total)
        unscoped_spend = await analytics_service.get_spend_summary(
            db, org_id, fiscal_year=None, user_bu_scope=[]
        )
        assert len(unscoped_spend) == 2
        total_org_spend = sum(item["total_spend"] for item in unscoped_spend)
        assert total_org_spend == 250000.0


@pytest.mark.asyncio
async def test_cost_of_capital_uses_org_rate():
    """MUST PASS: cost_of_capital_uses_org_rate.
    Cost of capital uses organization.cost_of_capital_rate (e.g. 18%), NOT hardcoded 12%.
    Formula: savings_amount * cost_of_capital_rate.
    """
    org_id = uuid4()
    custom_cocr = Decimal("0.1800")  # 18% annual cost of capital rate

    async with TestSession() as db:
        f = await create_analytics_fixtures(db, org_id, cost_of_capital_rate=custom_cocr)

        pr_id = uuid4()
        po_id = uuid4()

        # PR estimated = 100,000; PO actual = 80,000 -> savings = 20,000
        await db.execute(
            text("""
                INSERT INTO requisitions (id, org_id, pr_number, title, status, requestor_id, business_unit_id,
                                          cost_center_id, category_id, currency, estimated_value, version)
                VALUES (:pr_id, :org_id, :pr_num, 'Capital Test PR', 'APPROVED', :buyer1, :bu1,
                        :cc1, :cat1, 'INR', 100000.00, 1)
            """),
            {
                "pr_id": pr_id,
                "org_id": org_id,
                "pr_num": f"PR-{pr_id.hex[:6]}",
                "buyer1": f["buyer1_id"],
                "bu1": f["bu1_id"],
                "cc1": f["cc1_id"],
                "cat1": f["cat1_id"],
            },
        )
        await db.execute(
            text("""
                INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, source_pr_id, status,
                                             business_unit_id, category_id, currency, total_value, buyer_id, version)
                VALUES (:po_id, :org_id, :po_num, 'Capital Test PO', :v1, :pr_id, 'APPROVED',
                        :bu1, :cat1, 'INR', 80000.00, :buyer1, 1)
            """),
            {
                "po_id": po_id,
                "org_id": org_id,
                "po_num": f"PO-{po_id.hex[:6]}",
                "v1": f["vendor1_id"],
                "pr_id": pr_id,
                "bu1": f["bu1_id"],
                "cat1": f["cat1_id"],
                "buyer1": f["buyer1_id"],
            },
        )
        await db.commit()

        kpis = await analytics_service.get_procurement_kpis(db, org_id, fiscal_year=None, user_bu_scope=[])
        assert kpis["savings_amount"] == 20000.0
        assert kpis["cost_of_capital_rate"] == 0.18
        # Benefit = 20,000 * 0.18 = 3,600.0 (if it used 12%, it would be 2,400.0)
        assert kpis["cost_of_capital_benefit"] == 3600.0
        assert kpis["cost_of_capital_benefit"] != 2400.0


@pytest.mark.asyncio
async def test_kpi_pr_to_po_cycle_time():
    """Cycle time calculated correctly from PR.created_at to PO.created_at."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_analytics_fixtures(db, org_id)

        pr_id = uuid4()
        po_id = uuid4()
        now = datetime.now(timezone.utc)
        pr_created = now - timedelta(days=10)

        await db.execute(
            text("""
                INSERT INTO requisitions (id, org_id, pr_number, title, status, requestor_id, business_unit_id,
                                          cost_center_id, category_id, currency, estimated_value, version, created_at)
                VALUES (:pr_id, :org_id, :pr_num, 'Cycle PR', 'APPROVED', :buyer1, :bu1,
                        :cc1, :cat1, 'INR', 50000.00, 1, :pr_created)
            """),
            {
                "pr_id": pr_id,
                "org_id": org_id,
                "pr_num": f"PR-{pr_id.hex[:6]}",
                "buyer1": f["buyer1_id"],
                "bu1": f["bu1_id"],
                "cc1": f["cc1_id"],
                "cat1": f["cat1_id"],
                "pr_created": pr_created,
            },
        )
        await db.execute(
            text("""
                INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, source_pr_id, status,
                                             business_unit_id, category_id, currency, total_value, buyer_id, version, created_at)
                VALUES (:po_id, :org_id, :po_num, 'Cycle PO', :v1, :pr_id, 'APPROVED',
                        :bu1, :cat1, 'INR', 45000.00, :buyer1, 1, :now)
            """),
            {
                "po_id": po_id,
                "org_id": org_id,
                "po_num": f"PO-{po_id.hex[:6]}",
                "v1": f["vendor1_id"],
                "pr_id": pr_id,
                "bu1": f["bu1_id"],
                "cat1": f["cat1_id"],
                "buyer1": f["buyer1_id"],
                "now": now,
            },
        )
        await db.commit()

        kpis = await analytics_service.get_procurement_kpis(db, org_id, user_bu_scope=[])
        assert 9.9 <= kpis["pr_to_po_cycle_days"] <= 10.1


@pytest.mark.asyncio
async def test_savings_negative_cost_overrun():
    """PO value > PR estimate -> negative savings (cost overrun) shown correctly."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_analytics_fixtures(db, org_id)

        pr_id = uuid4()
        po_id = uuid4()

        # PR estimated = 50,000; PO actual = 65,000 -> overrun = -15,000 (-30%)
        await db.execute(
            text("""
                INSERT INTO requisitions (id, org_id, pr_number, title, status, requestor_id, business_unit_id,
                                          cost_center_id, category_id, currency, estimated_value, version)
                VALUES (:pr_id, :org_id, :pr_num, 'Overrun PR', 'APPROVED', :buyer1, :bu1,
                        :cc1, :cat1, 'INR', 50000.00, 1)
            """),
            {
                "pr_id": pr_id,
                "org_id": org_id,
                "pr_num": f"PR-{pr_id.hex[:6]}",
                "buyer1": f["buyer1_id"],
                "bu1": f["bu1_id"],
                "cc1": f["cc1_id"],
                "cat1": f["cat1_id"],
            },
        )
        await db.execute(
            text("""
                INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, source_pr_id, status,
                                             business_unit_id, category_id, currency, total_value, buyer_id, version)
                VALUES (:po_id, :org_id, :po_num, 'Overrun PO', :v1, :pr_id, 'APPROVED',
                        :bu1, :cat1, 'INR', 65000.00, :buyer1, 1)
            """),
            {
                "po_id": po_id,
                "org_id": org_id,
                "po_num": f"PO-{po_id.hex[:6]}",
                "v1": f["vendor1_id"],
                "pr_id": pr_id,
                "bu1": f["bu1_id"],
                "cat1": f["cat1_id"],
                "buyer1": f["buyer1_id"],
            },
        )
        await db.commit()

        savings = await analytics_service.get_savings_analysis(db, org_id, user_bu_scope=[])
        assert savings["total_savings"] == -15000.0
        assert savings["savings_percentage"] == -30.0


@pytest.mark.asyncio
async def test_vendor_performance_scorecard():
    """Vendor scorecard retrieves quality, delivery, and composite scores."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_analytics_fixtures(db, org_id)

        # Insert vendor scorecard
        await db.execute(
            text("""
                INSERT INTO vendor_scorecards (id, org_id, vendor_id, period_start, period_end,
                                               on_time_delivery_rate, quality_acceptance_rate,
                                               commercial_compliance_score, responsiveness_score,
                                               overall_score, calculated_at)
                VALUES (:id, :org_id, :v1, CURRENT_DATE - 30, CURRENT_DATE,
                        95.0, 98.0, 90.0, 85.0, 93.5, NOW())
            """),
            {"id": uuid4(), "org_id": org_id, "v1": f["vendor1_id"]},
        )
        await db.commit()

        single = await analytics_service.get_vendor_performance(db, org_id, vendor_id=f["vendor1_id"])
        assert single["vendor_name"] == "TechCorp Solutions"
        assert single["avg_quality"] == 98.0
        assert single["avg_delivery"] == 95.0
        assert single["performance_tier"] == "PREFERRED"

        comparison = await analytics_service.get_vendor_performance(db, org_id, vendor_id=None)
        assert len(comparison) >= 2


@pytest.mark.asyncio
async def test_unmapped_pr_analytics():
    """Unmapped PR metrics compute pending, resolved, and breach counts."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_analytics_fixtures(db, org_id)

        pr_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO requisitions (id, org_id, pr_number, title, status, requestor_id, business_unit_id,
                                          cost_center_id, category_id, currency, estimated_value, version)
                VALUES (:pr_id, :org_id, :pr_num, 'Unmapped PR', 'DRAFT', :buyer1, :bu1,
                        :cc1, :cat1, 'INR', 10000.00, 1)
            """),
            {
                "pr_id": pr_id,
                "org_id": org_id,
                "pr_num": f"PR-{pr_id.hex[:6]}",
                "buyer1": f["buyer1_id"],
                "bu1": f["bu1_id"],
                "cc1": f["cc1_id"],
                "cat1": f["cat1_id"],
            },
        )

        now = datetime.now(timezone.utc)
        await db.execute(
            text("""
                INSERT INTO unmapped_pr_exceptions (id, org_id, requisition_id, failed_fields, status,
                                                   sla_breach_level, created_at, version)
                VALUES (:id1, :org_id, :pr_id, '[]', 'PENDING', 3, :now, 1)
            """),
            {"id1": uuid4(), "org_id": org_id, "pr_id": pr_id, "now": now},
        )
        await db.execute(
            text("""
                INSERT INTO unmapped_pr_exceptions (id, org_id, requisition_id, failed_fields, status,
                                                   sla_breach_level, created_at, resolved_at, version)
                VALUES (:id2, :org_id, :pr_id, '[]', 'RESOLVED', 0, :created, :resolved, 1)
            """),
            {
                "id2": uuid4(),
                "org_id": org_id,
                "pr_id": pr_id,
                "created": now - timedelta(hours=4),
                "resolved": now,
            },
        )
        await db.commit()

        res = await analytics_service.get_unmapped_pr_analytics(db, org_id)
        assert res["pending"] == 1
        assert res["resolved"] == 1
        assert res["sla_breach_count"] == 1
        assert 3.9 <= res["avg_resolution_hours"] <= 4.1


@pytest.mark.asyncio
async def test_export_csv_and_excel():
    """CSV streaming and Excel exports produce proper binary and content headers."""
    sample_data = [
        {"category": "Hardware", "spend": 50000, "orders": 12},
        {"category": "Services", "spend": 30000, "orders": 8},
    ]

    # Test CSV
    csv_resp = await analytics_export_service.export_csv(
        sample_data, columns=["category", "spend", "orders"], filename="test.csv"
    )
    assert csv_resp.media_type == "text/csv"
    assert "attachment; filename=\"test.csv\"" in csv_resp.headers["content-disposition"]

    chunks = []
    async for chunk in csv_resp.body_iterator:
        chunks.append(chunk)
    csv_text = "".join(chunks)
    assert "category,spend,orders" in csv_text
    assert "Hardware,50000,12" in csv_text

    # Test Excel
    excel_resp = await analytics_export_service.export_excel(
        sample_data, sheet_name="SpendReport", filename="test.xlsx"
    )
    assert "spreadsheetml.sheet" in excel_resp.media_type
    assert len(excel_resp.body) > 100  # Valid binary zip/xlsx structure


@pytest.mark.asyncio
async def test_analytics_endpoints_and_scope():
    """Test router endpoints (/dashboard, /spend, /savings, /cycle-times, /export)."""
    org_id = uuid4()
    bu1_id = uuid4()

    mock_user = User(
        id=uuid4(),
        org_id=org_id,
        email="buyer@test.com",
        first_name="Test",
        last_name="Buyer",
        business_unit_id=bu1_id,
    )
    mock_user.roles = ["BUYER"]

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Health
        res = await ac.get("/api/v1/analytics/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # 2. Dashboard
        res = await ac.get("/api/v1/analytics/dashboard")
        assert res.status_code == 200
        data = res.json()["data"]
        assert "kpis" in data
        assert "spend" in data

        # 3. Spend
        res = await ac.get("/api/v1/analytics/spend")
        assert res.status_code == 200
        assert "by_category" in res.json()["data"]

        # 4. Savings
        res = await ac.get("/api/v1/analytics/savings")
        assert res.status_code == 200
        assert "total_savings" in res.json()["data"]

        # 5. Cycle Times
        res = await ac.get("/api/v1/analytics/cycle-times")
        assert res.status_code == 200
        assert "pr_to_po_avg_days" in res.json()["data"]
        assert "approval_bottlenecks" in res.json()["data"]

        # 6. Export CSV
        res = await ac.post("/api/v1/analytics/export/csv", json={
            "data": [{"col1": "val1", "col2": 123}],
            "filename": "api_test.csv"
        })
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_spend_cube_pareto_calculation():
    """Test Spend Cube endpoint: category/bu slicing, CAPEX vs OPEX, and Pareto 80/20 distribution."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_analytics_fixtures(db, org_id)

        # Create 1 CAPEX PR and 1 OPEX PR
        pr_capex = uuid4()
        pr_opex = uuid4()
        await db.execute(
            text("""
                INSERT INTO requisitions (id, org_id, pr_number, title, status, requestor_id, business_unit_id,
                                          cost_center_id, category_id, currency, estimated_value, is_capex, version)
                VALUES (:pr1, :org_id, :num1, 'Capex Servers', 'APPROVED', :buyer1, :bu1,
                        :cc1, :cat1, 'INR', 800000.00, true, 1),
                       (:pr2, :org_id, :num2, 'Opex Supplies', 'APPROVED', :buyer1, :bu2,
                        :cc2, :cat2, 'INR', 200000.00, false, 1)
            """),
            {
                "pr1": pr_capex,
                "pr2": pr_opex,
                "org_id": org_id,
                "num1": f"PR-{pr_capex.hex[:6]}",
                "num2": f"PR-{pr_opex.hex[:6]}",
                "buyer1": f["buyer1_id"],
                "bu1": f["bu1_id"],
                "bu2": f["bu2_id"],
                "cc1": f["cc1_id"],
                "cc2": f["cc2_id"],
                "cat1": f["cat1_id"],
                "cat2": f["cat2_id"],
            },
        )

        po1_id = uuid4()
        po2_id = uuid4()
        # PO1: vendor1, capex, 800,000
        # PO2: vendor2, opex, 200,000
        await db.execute(
            text("""
                INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, source_pr_id, status,
                                             business_unit_id, category_id, currency, total_value, buyer_id, version)
                VALUES (:po1, :org_id, :num1, 'Capex PO', :v1, :pr1, 'APPROVED',
                        :bu1, :cat1, 'INR', 800000.00, :buyer1, 1),
                       (:po2, :org_id, :num2, 'Opex PO', :v2, :pr2, 'APPROVED',
                        :bu2, :cat2, 'INR', 200000.00, :buyer1, 1)
            """),
            {
                "po1": po1_id,
                "po2": po2_id,
                "org_id": org_id,
                "num1": f"PO-{po1_id.hex[:6]}",
                "num2": f"PO-{po2_id.hex[:6]}",
                "v1": f["vendor1_id"],
                "v2": f["vendor2_id"],
                "pr1": pr_capex,
                "pr2": pr_opex,
                "bu1": f["bu1_id"],
                "bu2": f["bu2_id"],
                "cat1": f["cat1_id"],
                "cat2": f["cat2_id"],
                "buyer1": f["buyer1_id"],
            },
        )
        await db.commit()

    mock_user = User(
        id=f["head_user_id"],
        org_id=org_id,
        email="head@test.com",
        first_name="Head",
        last_name="Procurement",
    )
    mock_user.roles = ["PROCUREMENT_HEAD"]
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/analytics/spend-cube")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["total_spend"] == 1000000.0
        assert data["capex_spend"] == 800000.0
        assert data["opex_spend"] == 200000.0
        assert data["capex_percentage"] == 80.0
        assert data["opex_percentage"] == 20.0
        assert len(data["by_category"]) >= 2
        assert len(data["by_bu"]) >= 2

        pareto = data["pareto_vendors"]
        assert len(pareto) == 2
        assert pareto[0]["vendor_id"] == str(f["vendor1_id"])
        assert pareto[0]["total_spend"] == 800000.0
        assert pareto[0]["pareto_tier"] == "TOP_80"
        assert pareto[1]["vendor_id"] == str(f["vendor2_id"])
        assert data["pareto_summary"]["total_vendors"] == 2

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_maverick_spend_identification():
    """Test Maverick Spend endpoint: identifies POs without contracts or RFQs and flags risk levels."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_analytics_fixtures(db, org_id)

        contract_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO contracts (id, org_id, business_unit_id, category_id, contract_number, title, vendor_id, status, total_value, start_date, end_date, version)
                VALUES (:c_id, :org_id, :bu1, :cat1, 'CON-001', 'IT Master Agreement', :v1, 'ACTIVE', 1000000.0, CURRENT_DATE, CURRENT_DATE + INTERVAL '365 days', 1)
            """),
            {"c_id": contract_id, "org_id": org_id, "bu1": f["bu1_id"], "cat1": f["cat1_id"], "v1": f["vendor1_id"]},
        )

        po_contracted = uuid4()
        po_maverick = uuid4()

        await db.execute(
            text("""
                INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, contract_id, source_pr_id, rfq_id,
                                             status, business_unit_id, category_id, currency, total_value, buyer_id, version)
                VALUES (:po1, :org_id, :num1, 'Contracted PO', :v1, :c_id, NULL, NULL,
                        'APPROVED', :bu1, :cat1, 'INR', 600000.00, :buyer1, 1),
                       (:po2, :org_id, :num2, 'Maverick PO', :v2, NULL, NULL, NULL,
                        'APPROVED', :bu2, :cat2, 'INR', 400000.00, :buyer1, 1)
            """),
            {
                "po1": po_contracted,
                "po2": po_maverick,
                "org_id": org_id,
                "num1": f"PO-{po_contracted.hex[:6]}",
                "num2": f"PO-{po_maverick.hex[:6]}",
                "v1": f["vendor1_id"],
                "v2": f["vendor2_id"],
                "c_id": contract_id,
                "bu1": f["bu1_id"],
                "bu2": f["bu2_id"],
                "cat1": f["cat1_id"],
                "cat2": f["cat2_id"],
                "buyer1": f["buyer1_id"],
            },
        )
        await db.commit()

    mock_user = User(
        id=f["head_user_id"],
        org_id=org_id,
        email="head@test.com",
        first_name="Head",
        last_name="Procurement",
    )
    mock_user.roles = ["PROCUREMENT_HEAD"]
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/analytics/maverick-spend")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["total_po_spend"] == 1000000.0
        assert data["contracted_spend"] == 600000.0
        assert data["maverick_spend"] == 400000.0
        assert data["leakage_rate"] == 40.0
        assert data["total_po_count"] == 2
        assert data["maverick_po_count"] == 1
        assert data["compliant_po_count"] == 1

        uncontracted = data["uncontracted_pos"]
        assert len(uncontracted) >= 1
        assert uncontracted[0]["po_number"] == f"PO-{po_maverick.hex[:6]}"
        assert uncontracted[0]["risk_level"] in ("HIGH", "MEDIUM")

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_custom_report_builder_dynamic_query():
    """Test Custom Report Builder: dynamic dimension grouping, metrics, filters, and sorting."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_analytics_fixtures(db, org_id)

        po1_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, status,
                                             business_unit_id, category_id, currency, total_value, buyer_id, version)
                VALUES (:po1, :org_id, :num1, 'Report PO', :v1, 'APPROVED',
                        :bu1, :cat1, 'INR', 150000.00, :buyer1, 1)
            """),
            {
                "po1": po1_id,
                "org_id": org_id,
                "num1": f"PO-{po1_id.hex[:6]}",
                "v1": f["vendor1_id"],
                "bu1": f["bu1_id"],
                "cat1": f["cat1_id"],
                "buyer1": f["buyer1_id"],
            },
        )
        await db.commit()

    mock_user = User(
        id=f["head_user_id"],
        org_id=org_id,
        email="head@test.com",
        first_name="Head",
        last_name="Procurement",
    )
    mock_user.roles = ["PROCUREMENT_HEAD"]
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        req_payload = {
            "name": "Category & Vendor Spend",
            "dimensions": ["category_name", "vendor_name"],
            "metrics": ["total_po_value", "po_count", "avg_po_value"],
            "filters": [
                {"field": "status", "operator": "eq", "value": "APPROVED"}
            ],
            "sort": [
                {"field": "total_po_value", "direction": "desc"}
            ],
            "page": 1,
            "page_size": 25,
        }
        res = await ac.post("/api/v1/analytics/reports", json=req_payload)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["name"] == "Category & Vendor Spend"
        assert data["total_records"] >= 1
        assert len(data["data"]) >= 1
        row = data["data"][0]
        assert "category_name" in row
        assert "vendor_name" in row
        assert "total_po_value" in row
        assert row["total_po_value"] == 150000.0

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_compliance_audit_reports():
    """Test Compliance Audit Reports: emergency RFQs, single vendor justifications, and audit logs."""
    org_id = uuid4()
    async with TestSession() as db:
        f = await create_analytics_fixtures(db, org_id)

        # 1. Emergency RFQ
        rfq_em_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO rfqs (id, org_id, rfq_number, title, rfq_type, sourcing_type, status,
                                  buyer_id, business_unit_id, category_id, estimated_value,
                                  is_emergency, description, version)
                VALUES (:id, :org_id, 'RFQ-EM-01', 'Critical Plant Repair', 'LIMITED_TENDER', 'GOODS', 'PUBLISHED',
                        :b1, :bu1, :cat1, 250000.0, true, 'Factory boiler failure emergency', 1)
            """),
            {
                "id": rfq_em_id,
                "org_id": org_id,
                "b1": f["buyer1_id"],
                "bu1": f["bu1_id"],
                "cat1": f["cat1_id"],
            },
        )

        # 2. Single-Vendor RFQ
        rfq_sv_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO rfqs (id, org_id, rfq_number, title, rfq_type, sourcing_type, status,
                                  buyer_id, business_unit_id, category_id, estimated_value,
                                  is_single_vendor, single_vendor_justification, version)
                VALUES (:id, :org_id, 'RFQ-SV-01', 'Proprietary OEM Spares', 'LIMITED_TENDER', 'GOODS', 'PUBLISHED',
                        :b1, :bu1, :cat1, 180000.0, true, 'Sole licensed distributor in APAC', 1)
            """),
            {
                "id": rfq_sv_id,
                "org_id": org_id,
                "b1": f["buyer1_id"],
                "bu1": f["bu1_id"],
                "cat1": f["cat1_id"],
            },
        )

        # 3. Force-Approval Audit Log
        audit_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO audit_logs (id, org_id, entity_type, entity_id, action, actor_email, metadata, created_at)
                VALUES (:id, :org_id, 'PURCHASE_ORDER', :ent_id, 'WORKFLOW_ADMIN_INTERVENTION', 'admin@test.com',
                        '{"intervention_type": "FORCE_ADVANCE", "reason": "Bypassed VP offline approved"}', NOW())
            """),
            {"id": audit_id, "org_id": org_id, "ent_id": uuid4()},
        )
        await db.commit()

    mock_user = User(
        id=f["head_user_id"],
        org_id=org_id,
        email="head@test.com",
        first_name="Head",
        last_name="Procurement",
    )
    mock_user.roles = ["PROCUREMENT_HEAD"]
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/analytics/compliance-reports")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data["emergency_rfqs"]) >= 1
        assert data["emergency_rfqs"][0]["rfq_number"] == "RFQ-EM-01"
        assert len(data["single_vendor_rfqs"]) >= 1
        assert data["single_vendor_rfqs"][0]["rfq_number"] == "RFQ-SV-01"
        assert len(data["force_approves"]) >= 1
        assert data["summary"]["emergency_rfq_count"] >= 1
        assert data["summary"]["single_vendor_count"] >= 1
        assert data["summary"]["force_approve_count"] >= 1

    app.dependency_overrides.clear()

