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

        # 6. Export CSV
        res = await ac.post("/api/v1/analytics/export/csv", json={
            "data": [{"col1": "val1", "col2": 123}],
            "filename": "api_test.csv"
        })
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]

    app.dependency_overrides.clear()
