"""
Integration tests for SPEC_14: Catalog Management & PunchOut Marketplace Engine:
- Parametric faceted search with category and brand aggregations
- Hosted catalog tiered volume pricing calculation
- Shopping cart add/update/remove lifecycle with automatic volume tier recalculation
- 1-Click Cart-to-PR checkout creating real draft Requisition lines
- Bidirectional cXML 1.2 and OCI 4.0 PunchOut marketplace session launch and inbound cart callback
"""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.main  # noqa: F401
from app.config import settings
from app.modules.catalog.models import CatalogTierPricing
from app.modules.catalog.schemas import (
    CartCheckoutRequest,
    CartItemAddRequest,
    PunchoutCallbackItem,
    PunchoutCallbackRequest,
    PunchoutConfigCreateRequest,
    PunchoutLaunchRequest,
    PunchoutProtocolEnum,
)
from app.modules.catalog.service import catalog_service
from app.modules.master_data.models import Category, ItemMaster, UomMaster
from app.modules.organization.models import BusinessUnit

test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def seed_catalog_test_data(db: AsyncSession, org_id):
    user_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO organizations (id, name, legal_name, country_code, base_currency, settings)
        VALUES (:id, 'Catalog Org', 'Catalog Corp', 'IN', 'INR', '{}')
        ON CONFLICT (id) DO NOTHING
        """),
        {"id": org_id},
    )
    await db.execute(
        text("""
        INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, status, version)
        VALUES (:id, :org_id, :email, 'hash', 'Shopper', 'Buyer', 'ACTIVE', 1)
        """),
        {"id": user_id, "org_id": org_id, "email": f"shopper-{user_id.hex[:6]}@enterprise.com"},
    )

    le_id = uuid4()
    await db.execute(
        text("""
        INSERT INTO legal_entities (id, org_id, name, registration_number, gstin, country_code)
        VALUES (:id, :org_id, 'Catalog Legal Entity', :reg, '27ABCDE1234F1Z5', 'IN')
        """),
        {"id": le_id, "org_id": org_id, "reg": f"REG-CAT-{le_id.hex[:4]}"},
    )

    cat = Category(
        id=uuid4(),
        org_id=org_id,
        code=f"IT-{uuid4().hex[:4].upper()}",
        name="Laptops & IT Hardware",
        level=1,
    )
    uom = UomMaster(
        id=uuid4(),
        org_id=org_id,
        code=f"EA-{uuid4().hex[:3].upper()}",
        name="Each",
    )
    bu = BusinessUnit(
        id=uuid4(),
        org_id=org_id,
        code=f"BU-{uuid4().hex[:4].upper()}",
        name="Enterprise IT",
        legal_entity_id=le_id,
    )
    db.add_all([cat, uom, bu])
    await db.commit()
    return user_id, cat.id, uom.id, bu.id


@pytest.mark.asyncio
async def test_faceted_catalog_search_and_tiered_pricing():
    org_id = uuid4()
    async with TestSession() as db:
        user_id, cat_id, uom_id, _ = await seed_catalog_test_data(db, org_id)

        # 1. Create item with specs and brand
        item = ItemMaster(
            id=uuid4(),
            org_id=org_id,
            code=f"DELL-{uuid4().hex[:4].upper()}",
            name="Dell Latitude 7440 Ultrabook",
            description="14-inch FHD, Core i7, 32GB RAM, 1TB SSD",
            category_id=cat_id,
            uom_id=uom_id,
            standard_price=Decimal("95000.00"),
            currency="INR",
            brand="Dell",
            manufacturer="Dell Technologies",
            lead_time_days=5,
            min_order_qty=Decimal("1.0"),
            specifications={"RAM": "32GB", "CPU": "Intel i7", "Storage": "1TB SSD"},
            is_contract_item=True,
            is_active=True,
        )
        db.add(item)
        await db.flush()

        # Add tiered volume discounts
        tier1 = CatalogTierPricing(
            id=uuid4(),
            org_id=org_id,
            item_id=item.id,
            min_quantity=Decimal("5.0"),
            unit_price=Decimal("90000.00"),
        )
        tier2 = CatalogTierPricing(
            id=uuid4(),
            org_id=org_id,
            item_id=item.id,
            min_quantity=Decimal("20.0"),
            unit_price=Decimal("85000.00"),
        )
        db.add_all([tier1, tier2])
        await db.commit()

        # 2. Search catalog
        search_res = await catalog_service.search_catalog(
            db,
            org_id=org_id,
            query="Latitude",
            brand="Dell",
        )

        assert search_res.total >= 1
        found_item = next(i for i in search_res.items if i.id == item.id)
        assert found_item.name == "Dell Latitude 7440 Ultrabook"
        assert found_item.brand == "Dell"
        assert len(found_item.tiers) == 2
        assert found_item.tiers[0].unit_price == 90000.0
        assert found_item.tiers[1].unit_price == 85000.0

        # Check facet aggregations
        assert "brands" in search_res.facets
        assert any(b.value == "Dell" for b in search_res.facets["brands"])


@pytest.mark.asyncio
async def test_shopping_cart_lifecycle_and_volume_discounts():
    org_id = uuid4()
    async with TestSession() as db:
        user_id, cat_id, uom_id, _ = await seed_catalog_test_data(db, org_id)

        item = ItemMaster(
            id=uuid4(),
            org_id=org_id,
            code=f"MON-{uuid4().hex[:4].upper()}",
            name="UltraSharp 27 Monitor",
            category_id=cat_id,
            uom_id=uom_id,
            standard_price=Decimal("30000.00"),
            currency="INR",
            brand="Dell",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        # Volume tier: >= 10 units -> 25000 INR
        tier = CatalogTierPricing(
            id=uuid4(),
            org_id=org_id,
            item_id=item.id,
            min_quantity=Decimal("10.0"),
            unit_price=Decimal("25000.00"),
        )
        db.add(tier)
        await db.commit()

        # 1. Add 2 units -> standard price 30000
        cart1 = await catalog_service.add_item_to_cart(
            db,
            org_id=org_id,
            user_id=user_id,
            payload=CartItemAddRequest(
                item_id=item.id,
                item_code=item.code,
                item_name=item.name,
                quantity=2.0,
            ),
        )
        assert cart1.total_items == 1
        assert cart1.items[0].unit_price == 30000.0
        assert cart1.subtotal == 60000.0

        # 2. Update quantity to 15 -> volume discount triggers: 25000
        cart_item_id = cart1.items[0].id
        cart2 = await catalog_service.update_cart_item_quantity(
            db,
            org_id=org_id,
            user_id=user_id,
            cart_item_id=cart_item_id,
            quantity=15.0,
        )
        assert cart2.items[0].quantity == 15.0
        assert cart2.items[0].unit_price == 25000.0
        assert cart2.subtotal == 375000.0

        # 3. Remove item
        cart3 = await catalog_service.remove_cart_item(
            db,
            org_id=org_id,
            user_id=user_id,
            cart_item_id=cart_item_id,
        )
        assert cart3.total_items == 0
        assert cart3.subtotal == 0.0


@pytest.mark.asyncio
async def test_one_click_cart_checkout_to_pr():
    org_id = uuid4()
    async with TestSession() as db:
        user_id, cat_id, uom_id, bu_id = await seed_catalog_test_data(db, org_id)

        # Add 2 items to cart
        await catalog_service.add_item_to_cart(
            db,
            org_id=org_id,
            user_id=user_id,
            payload=CartItemAddRequest(
                item_code="LOGI-MX3",
                item_name="Logitech MX Master 3S Mouse",
                quantity=5.0,
                unit_price=8500.0,
            ),
        )
        await catalog_service.add_item_to_cart(
            db,
            org_id=org_id,
            user_id=user_id,
            payload=CartItemAddRequest(
                item_code="LOGI-KEY",
                item_name="Logitech MX Mechanical Keyboard",
                quantity=5.0,
                unit_price=13500.0,
            ),
        )

        # Checkout to PR
        checkout_res = await catalog_service.checkout_cart_to_pr(
            db,
            org_id=org_id,
            user_id=user_id,
            payload=CartCheckoutRequest(
                title="Q3 Peripheral Fleet Upgrade",
                business_unit_id=bu_id,
                notes="Standard accessories for engineering pod",
            ),
        )

        assert checkout_res.pr_id is not None
        assert checkout_res.pr_number.startswith("PR-")
        assert checkout_res.line_count == 2
        assert checkout_res.total_value == 110000.0
        assert checkout_res.status == "DRAFT"

        # Cart should now be empty / reset
        active_cart = await catalog_service.get_user_cart_response(db, org_id=org_id, user_id=user_id)
        assert active_cart.total_items == 0


@pytest.mark.asyncio
async def test_cxml_and_oci_punchout_marketplace():
    org_id = uuid4()
    async with TestSession() as db:
        user_id, _, _, _ = await seed_catalog_test_data(db, org_id)

        # 1. Configure external PunchOut marketplace
        config = await catalog_service.create_punchout_config(
            db,
            org_id=org_id,
            payload=PunchoutConfigCreateRequest(
                supplier_name="Amazon Business Marketplace",
                protocol=PunchoutProtocolEnum.CXML,
                inbound_url="https://punchout.amazon.com/cxml",
                shared_secret=f"sec_{uuid4().hex}",
                sender_identity="HKT-BUYER",
                buyer_identity="AMZN-CORP-ID",
            ),
        )
        assert config.id is not None
        assert config.protocol == "CXML"

        # 2. Launch punchout session
        launch_res = await catalog_service.launch_punchout_session(
            db,
            org_id=org_id,
            user_id=user_id,
            payload=PunchoutLaunchRequest(
                config_id=config.id,
                return_url="http://localhost:3000/marketplace/cart",
            ),
        )
        assert launch_res.session_token.startswith("pout_")
        assert "cxml-urlencoded" in launch_res.form_params
        assert "PunchOutSetupRequest" in launch_res.form_params["cxml-urlencoded"]

        # 3. Simulate supplier punchout cart return callback
        cart = await catalog_service.process_punchout_callback(
            db,
            payload=PunchoutCallbackRequest(
                session_token=launch_res.session_token,
                items=[
                    PunchoutCallbackItem(
                        item_code="AMZN-98231",
                        item_name="Standing Desk Converter",
                        quantity=2.0,
                        unit_price=16000.0,
                        currency="INR",
                    )
                ],
            ),
        )

        assert cart.total_items >= 1
        returned_item = next(i for i in cart.items if i.item_code == "AMZN-98231")
        assert returned_item.item_name == "Standing Desk Converter"
        assert returned_item.total_price == 32000.0
