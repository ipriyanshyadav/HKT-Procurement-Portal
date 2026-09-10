"""
Integration tests for Multi-Tenant Active Company Switcher & Cross-Tenant Rollup:
- Discovering accessible legal entities and operating companies per user
- Switching active operating company context and JWT claim renewal
- Enforcing cross-tenant isolation and unauthorized access rejection (ForbiddenError)
- Group-wide cross-tenant spend rollup, cycle times, category Pareto, and vendor overlaps
"""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.auth.jwt import decode_jwt
from app.config import settings
from app.core.exceptions import ForbiddenError
from app.modules.organization.company_switcher_service import company_switcher_service
from app.modules.organization.schemas import SwitchCompanyContextRequest
from app.modules.user.models import User

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def seed_multi_tenant_fixtures(db: AsyncSession, org_id):
    other_org_id = uuid4()
    user_id = uuid4()
    le_a_id = uuid4()
    le_b_id = uuid4()
    le_foreign_id = uuid4()
    bu_a_id = uuid4()
    bu_b_id = uuid4()
    cat_it_id = uuid4()
    cat_ops_id = uuid4()
    vendor_shared_id = uuid4()

    # Create primary org
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, :name, :legal_name, 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id, "name": f"Parent Org {org_id.hex[:6]}", "legal_name": f"Parent Corp {org_id.hex[:6]}"},
    )

    # Create secondary external org
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, :name, :legal_name, 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": other_org_id, "name": f"External Org {other_org_id.hex[:6]}", "legal_name": f"External Corp {other_org_id.hex[:6]}"},
    )

    # Create Legal Entity A in Primary Org
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, gstin, country_code)
        VALUES (:id, :org_id, :name, :reg, '27ABCDE1234F1Z5', 'IN')
        """),
        {"id": le_a_id, "org_id": org_id, "name": f"Holdings India {org_id.hex[:4]}", "reg": f"REG-A-{org_id.hex[:4]}"},
    )

    # Create Legal Entity B in Primary Org
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, gstin, country_code)
        VALUES (:id, :org_id, :name, :reg, '29ABCDE1234F1Z8', 'IN')
        """),
        {"id": le_b_id, "org_id": org_id, "name": f"Holdings Logistics {org_id.hex[:4]}", "reg": f"REG-B-{org_id.hex[:4]}"},
    )

    # Create Foreign Legal Entity in Secondary Org
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, gstin, country_code)
        VALUES (:id, :org_id, :name, :reg, '33ABCDE1234F1Z1', 'IN')
        """),
        {"id": le_foreign_id, "org_id": other_org_id, "name": f"Foreign Affiliate {other_org_id.hex[:4]}", "reg": f"REG-F-{other_org_id.hex[:4]}"},
    )

    # Create Business Units
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, legal_entity_id, code, name, default_currency, is_active)
        VALUES (:id, :org_id, :le_id, :code, :name, 'INR', true)
        """),
        {"id": bu_a_id, "org_id": org_id, "le_id": le_a_id, "code": f"BU-A-{bu_a_id.hex[:4]}", "name": "Digital Products"},
    )
    await db.execute(
        text("""
        INSERT INTO business_units (id, org_id, legal_entity_id, code, name, default_currency, is_active)
        VALUES (:id, :org_id, :le_id, :code, :name, 'INR', true)
        """),
        {"id": bu_b_id, "org_id": org_id, "le_id": le_b_id, "code": f"BU-B-{bu_b_id.hex[:4]}", "name": "Supply Chain Logistics"},
    )

    # Create Categories
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, code, name, level)
        VALUES (:id, :org_id, :code, :name, 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_it_id, "org_id": org_id, "code": f"CAT-IT-{cat_it_id.hex[:4]}", "name": "Cloud Infrastructure"},
    )
    await db.execute(
        text("""
        INSERT INTO categories (id, org_id, code, name, level)
        VALUES (:id, :org_id, :code, :name, 1)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": cat_ops_id, "org_id": org_id, "code": f"CAT-OPS-{cat_ops_id.hex[:4]}", "name": "Freight & Warehousing"},
    )

    # Create Shared Vendor
    await db.execute(
        text("""
        INSERT INTO vendors (id, org_id, vendor_code, company_name, legal_name, primary_email, status)
        VALUES (:id, :org_id, :code, :cname, :name, :email, 'ACTIVE')
        """),
        {
            "id": vendor_shared_id,
            "org_id": org_id,
            "code": f"VEND-SHR-{vendor_shared_id.hex[:4]}",
            "cname": "Global Tech & Logistics Corp",
            "name": "GlobalCorp Legal",
            "email": f"vendor-{vendor_shared_id.hex[:6]}@globalcorp.com",
        },
    )

    # Create User in Primary Org
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, is_supplier_user, active_legal_entity_id, version)
        VALUES (:id, :org_id, :email, 'hash', 'Chief', 'Procurement', 'ACTIVE', false, :active_le, 1)
        """),
        {
            "id": user_id,
            "org_id": org_id,
            "email": f"cpo-{user_id.hex[:6]}@enterprise.com",
            "active_le": le_a_id,
        },
    )

    # Assign CPO role
    cpo_role_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO roles (id, org_id, code, name, is_system_role)
        VALUES (:id, :org_id, 'PROCUREMENT_HEAD', 'Procurement Head', true)
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": cpo_role_id, "org_id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO user_role_assignments (id, user_id, role_id, org_id)
        VALUES (gen_random_uuid(), :user_id, :role_id, :org_id)
        """),
        {"user_id": user_id, "role_id": cpo_role_id, "org_id": org_id},
    )

    # Grant cross-org access to foreign entity via user_company_access
    await db.execute(
        text("""
        INSERT INTO user_company_access (id, org_id, user_id, target_org_id, legal_entity_id, role_code, is_default)
        VALUES (gen_random_uuid(), :org_id, :user_id, :target_org_id, :le_id, 'BUYER', false)
        """),
        {
            "org_id": org_id,
            "user_id": user_id,
            "target_org_id": other_org_id,
            "le_id": le_foreign_id,
        },
    )

    # Seed Purchase Orders under both entities
    # PO 1 under Entity A (BU A)
    po1_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, status, business_unit_id, category_id, currency, total_value, buyer_id)
        VALUES (:id, :org_id, :po_num, 'Cloud Servers 2026', :vendor_id, 'ACKNOWLEDGED', :bu_id, :cat_id, 'INR', 150000.00, :buyer_id)
        """),
        {
            "id": po1_id,
            "org_id": org_id,
            "po_num": f"PO-A-{po1_id.hex[:6]}",
            "vendor_id": vendor_shared_id,
            "bu_id": bu_a_id,
            "cat_id": cat_it_id,
            "buyer_id": user_id,
        },
    )

    # PO 2 under Entity B (BU B) - same vendor!
    po2_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO purchase_orders (id, org_id, po_number, title, vendor_id, status, business_unit_id, category_id, currency, total_value, buyer_id)
        VALUES (:id, :org_id, :po_num, 'Freight Network Fleet', :vendor_id, 'ACKNOWLEDGED', :bu_id, :cat_id, 'INR', 250000.00, :buyer_id)
        """),
        {
            "id": po2_id,
            "org_id": org_id,
            "po_num": f"PO-B-{po2_id.hex[:6]}",
            "vendor_id": vendor_shared_id,
            "bu_id": bu_b_id,
            "cat_id": cat_ops_id,
            "buyer_id": user_id,
        },
    )

    await db.commit()

    return {
        "org_id": org_id,
        "other_org_id": other_org_id,
        "user_id": user_id,
        "le_a_id": le_a_id,
        "le_b_id": le_b_id,
        "le_foreign_id": le_foreign_id,
        "vendor_shared_id": vendor_shared_id,
    }


@pytest.mark.asyncio
async def test_get_accessible_companies():
    org_id = uuid4()
    async with TestSession() as db:
        fixtures = await seed_multi_tenant_fixtures(db, org_id)

        user = await db.get(User, fixtures["user_id"])
        assert user is not None

        companies = await company_switcher_service.get_accessible_companies(db, user)

        # User has access to Entity A, Entity B (in primary org) and Foreign Entity (via user_company_access)
        entity_ids = [c.id for c in companies]
        assert fixtures["le_a_id"] in entity_ids
        assert fixtures["le_b_id"] in entity_ids
        assert fixtures["le_foreign_id"] in entity_ids

        # Entity A was marked active
        active_companies = [c for c in companies if c.is_active_context]
        assert len(active_companies) == 1
        assert active_companies[0].id == fixtures["le_a_id"]

        # Business unit counts
        entity_a = next(c for c in companies if c.id == fixtures["le_a_id"])
        assert entity_a.business_unit_count == 1


@pytest.mark.asyncio
async def test_switch_company_context_success():
    org_id = uuid4()
    async with TestSession() as db:
        fixtures = await seed_multi_tenant_fixtures(db, org_id)

        user = await db.get(User, fixtures["user_id"])
        assert user is not None
        assert user.active_legal_entity_id == fixtures["le_a_id"]

        # Switch context to Entity B
        req = SwitchCompanyContextRequest(target_legal_entity_id=fixtures["le_b_id"])
        response = await company_switcher_service.switch_company_context(db, user, req)

        assert response.access_token is not None
        assert response.active_company.id == fixtures["le_b_id"]
        assert response.active_company.is_active_context is True

        # Verify claims in new JWT
        claims = decode_jwt(response.access_token)
        assert claims["sub"] == str(user.id)
        assert claims["active_legal_entity_id"] == str(fixtures["le_b_id"])

        # Verify DB updated
        await db.refresh(user)
        assert user.active_legal_entity_id == fixtures["le_b_id"]


@pytest.mark.asyncio
async def test_switch_company_context_unauthorized_fails():
    org_id = uuid4()
    async with TestSession() as db:
        fixtures = await seed_multi_tenant_fixtures(db, org_id)

        user = await db.get(User, fixtures["user_id"])
        assert user is not None

        # Create an unrelated entity in a different org without granting access
        unauthorized_le_id = uuid4()
        unauthorized_org_id = uuid4()
        await db.execute(
            text("""
            INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
            VALUES (:id, 'Rogue Org', 'Rogue Corp', 'IN', 'INR', '{}')
            ON CONFLICT (id) DO NOTHING
            """),
            {"id": unauthorized_org_id},
        )
        await db.execute(
            text("""
            INSERT INTO legal_entities (id, org_id, name, registration_number, country_code)
            VALUES (:id, :org_id, 'Rogue Entity', 'ROGUE-123', 'IN')
            """),
            {"id": unauthorized_le_id, "org_id": unauthorized_org_id},
        )
        await db.commit()

        # Attempt to switch to unauthorized entity must be rejected
        req = SwitchCompanyContextRequest(target_legal_entity_id=unauthorized_le_id)
        with pytest.raises(ForbiddenError) as exc_info:
            await company_switcher_service.switch_company_context(db, user, req)
        assert "not permitted" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_cross_tenant_rollup_aggregation():
    org_id = uuid4()
    async with TestSession() as db:
        fixtures = await seed_multi_tenant_fixtures(db, org_id)

        user = await db.get(User, fixtures["user_id"])
        assert user is not None

        rollup = await company_switcher_service.get_cross_tenant_rollup(db, user)

        # Expected total spend = 150,000 + 250,000 = 400,000 INR
        assert rollup.total_spend == Decimal("400000.00")
        assert rollup.total_po_count == 2
        assert rollup.total_entities_count >= 2

        # Entity breakdown
        assert len(rollup.entities) >= 2
        top_entity = rollup.entities[0]
        assert top_entity.entity_id == fixtures["le_b_id"]
        assert top_entity.spend == Decimal("250000.00")
        assert top_entity.spend_percentage == 62.5  # 250k / 400k * 100

        second_entity = rollup.entities[1]
        assert second_entity.entity_id == fixtures["le_a_id"]
        assert second_entity.spend == Decimal("150000.00")
        assert second_entity.spend_percentage == 37.5  # 150k / 400k * 100

        # Vendor Overlap identification:
        # GlobalCorp is used across BOTH Entity A and Entity B!
        shared_vendor = next(v for v in rollup.vendor_overlaps if v.vendor_id == fixtures["vendor_shared_id"])
        assert shared_vendor.entity_count == 2
        assert shared_vendor.total_group_spend == Decimal("400000.00")
        assert shared_vendor.po_count == 2
        assert "Group Master Agreement" in shared_vendor.consolidation_opportunity

        # Top Categories
        cat_names = [c.category_name for c in rollup.top_categories]
        assert "Freight & Warehousing" in cat_names
        assert "Cloud Infrastructure" in cat_names
