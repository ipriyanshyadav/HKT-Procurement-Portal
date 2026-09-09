from __future__ import annotations

import secrets
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from defusedxml.ElementTree import fromstring as defused_fromstring
from loguru import logger
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.db.enums import PrSourceEnum, PrStatusEnum
from app.modules.catalog.models import (
    CartItem,
    PunchoutConfig,
    PunchoutSession,
    UserCart,
)
from app.modules.catalog.repository import (
    cart_item_repository,
    catalog_tier_pricing_repository,
    punchout_config_repository,
    punchout_session_repository,
    user_cart_repository,
)
from app.modules.catalog.schemas import (
    CartCheckoutRequest,
    CartCheckoutResponse,
    CartItemAddRequest,
    CartItemResponse,
    CatalogItemResponse,
    CatalogSearchResponse,
    CatalogTierPricingResponse,
    FacetOption,
    PunchoutCallbackRequest,
    PunchoutConfigCreateRequest,
    PunchoutLaunchRequest,
    PunchoutLaunchResponse,
    UserCartResponse,
)
from app.modules.master_data.models import Category, ItemMaster, UomMaster
from app.modules.organization.models import BusinessUnit, CostCenter
from app.modules.requisition.models import Requisition, RequisitionLine


class CatalogService:
    async def search_catalog(
        self,
        db: AsyncSession,
        org_id: UUID,
        query: str | None = None,
        category_id: UUID | None = None,
        brand: str | None = None,
        min_price: float | None = None,
        max_price: float | None = None,
        contract_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> CatalogSearchResponse:
        stmt = (
            select(ItemMaster, Category.name.label("category_name"), UomMaster.code.label("uom_code"))
            .join(Category, ItemMaster.category_id == Category.id)
            .join(UomMaster, ItemMaster.uom_id == UomMaster.id)
            .where(ItemMaster.org_id == org_id, ItemMaster.is_active.is_(True))
        )

        if query:
            q_pattern = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    ItemMaster.name.ilike(q_pattern),
                    ItemMaster.code.ilike(q_pattern),
                    ItemMaster.description.ilike(q_pattern),
                    ItemMaster.brand.ilike(q_pattern),
                )
            )

        if category_id:
            stmt = stmt.where(ItemMaster.category_id == category_id)

        if brand:
            stmt = stmt.where(ItemMaster.brand == brand)

        if min_price is not None:
            stmt = stmt.where(ItemMaster.standard_price >= Decimal(str(min_price)))

        if max_price is not None:
            stmt = stmt.where(ItemMaster.standard_price <= Decimal(str(max_price)))

        if contract_only:
            stmt = stmt.where(ItemMaster.is_contract_item.is_(True))

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        # Paginate
        stmt = stmt.order_by(ItemMaster.name.asc()).offset((page - 1) * page_size).limit(page_size)
        results = await db.execute(stmt)
        rows = results.all()

        items_resp: list[CatalogItemResponse] = []
        for item, cat_name, uom_code in rows:
            # fetch pricing tiers
            tiers = await catalog_tier_pricing_repository.list_by_item(db, item.id)
            tiers_resp = [
                CatalogTierPricingResponse(
                    id=t.id,
                    min_quantity=float(t.min_quantity),
                    unit_price=float(t.unit_price),
                    contract_id=t.contract_id,
                )
                for t in tiers
            ]

            items_resp.append(
                CatalogItemResponse(
                    id=item.id,
                    code=item.code,
                    name=item.name,
                    description=item.description,
                    category_id=item.category_id,
                    category_name=cat_name,
                    uom_id=item.uom_id,
                    uom_code=uom_code,
                    standard_price=float(item.standard_price),
                    currency=item.currency,
                    hsn_code=item.hsn_code,
                    image_url=item.image_url,
                    brand=item.brand,
                    manufacturer=item.manufacturer,
                    lead_time_days=item.lead_time_days or 3,
                    min_order_qty=float(item.min_order_qty or 1.0),
                    specifications=item.specifications or {},
                    is_contract_item=item.is_contract_item or False,
                    is_punchout=item.is_punchout or False,
                    tiers=tiers_resp,
                )
            )

        # Build Facets
        # 1. Categories facet
        cat_facet_stmt = (
            select(Category.name, func.count(ItemMaster.id))
            .join(Category, ItemMaster.category_id == Category.id)
            .where(ItemMaster.org_id == org_id, ItemMaster.is_active.is_(True))
            .group_by(Category.name)
            .order_by(desc(func.count(ItemMaster.id)))
            .limit(10)
        )
        cat_facets = [FacetOption(value=r[0], count=r[1]) for r in (await db.execute(cat_facet_stmt)).all()]

        # 2. Brands facet
        brand_facet_stmt = (
            select(ItemMaster.brand, func.count(ItemMaster.id))
            .where(
                ItemMaster.org_id == org_id,
                ItemMaster.is_active.is_(True),
                ItemMaster.brand.is_not(None),
            )
            .group_by(ItemMaster.brand)
            .order_by(desc(func.count(ItemMaster.id)))
            .limit(10)
        )
        brand_facets = [FacetOption(value=r[0], count=r[1]) for r in (await db.execute(brand_facet_stmt)).all() if r[0]]

        total_pages = max(1, (total + page_size - 1) // page_size)
        return CatalogSearchResponse(
            items=items_resp,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            facets={
                "categories": cat_facets,
                "brands": brand_facets,
            },
        )

    async def get_or_create_user_cart(self, db: AsyncSession, org_id: UUID, user_id: UUID) -> UserCart:
        cart = await user_cart_repository.get_active_cart(db, org_id, user_id)
        if not cart:
            cart = UserCart(
                id=uuid4(),
                org_id=org_id,
                user_id=user_id,
                currency="INR",
                status="ACTIVE",
            )
            db.add(cart)
            await db.commit()
            await db.refresh(cart)
            cart = await user_cart_repository.get_active_cart(db, org_id, user_id) or cart
        return cart

    async def get_user_cart_response(self, db: AsyncSession, org_id: UUID, user_id: UUID) -> UserCartResponse:
        cart = await self.get_or_create_user_cart(db, org_id, user_id)
        items = await cart_item_repository.list_by_cart(db, cart.id)
        items_resp = [
            CartItemResponse(
                id=i.id,
                cart_id=i.cart_id,
                item_id=i.item_id,
                item_code=i.item_code,
                item_name=i.item_name,
                quantity=float(i.quantity),
                unit_price=float(i.unit_price),
                total_price=float(i.total_price),
                currency=i.currency,
                punchout_payload=i.punchout_payload or {},
                created_at=i.created_at,
            )
            for i in items
        ]
        subtotal = sum(i.total_price for i in items_resp)
        return UserCartResponse(
            id=cart.id,
            org_id=cart.org_id,
            user_id=cart.user_id,
            currency=cart.currency,
            status=cart.status,
            subtotal=round(subtotal, 2),
            total_items=len(items_resp),
            items=items_resp,
        )

    async def add_item_to_cart(
        self, db: AsyncSession, org_id: UUID, user_id: UUID, payload: CartItemAddRequest
    ) -> UserCartResponse:
        cart = await self.get_or_create_user_cart(db, org_id, user_id)
        qty = Decimal(str(payload.quantity))

        # Determine unit price
        unit_price = Decimal(str(payload.unit_price)) if payload.unit_price is not None else Decimal("0.0")

        if payload.item_id:
            # Check for volume tier pricing
            tier_price = await catalog_tier_pricing_repository.get_best_tier_price(db, payload.item_id, qty)
            if tier_price:
                unit_price = tier_price
            elif payload.unit_price is None:
                item = await db.get(ItemMaster, payload.item_id)
                if item:
                    unit_price = item.standard_price

        total_price = round(unit_price * qty, 4)

        # Check existing item
        existing = await cart_item_repository.find_existing(db, cart.id, payload.item_code)
        if existing:
            new_qty = existing.quantity + qty
            if payload.item_id:
                tier_price = await catalog_tier_pricing_repository.get_best_tier_price(db, payload.item_id, new_qty)
                if tier_price:
                    unit_price = tier_price
            existing.quantity = new_qty
            existing.unit_price = unit_price
            existing.total_price = round(unit_price * new_qty, 4)
        else:
            cart_item = CartItem(
                id=uuid4(),
                cart_id=cart.id,
                item_id=payload.item_id,
                item_code=payload.item_code,
                item_name=payload.item_name,
                quantity=qty,
                unit_price=unit_price,
                total_price=total_price,
                currency=payload.currency,
                punchout_payload=payload.punchout_payload or {},
            )
            db.add(cart_item)

        await db.commit()
        return await self.get_user_cart_response(db, org_id, user_id)

    async def update_cart_item_quantity(
        self, db: AsyncSession, org_id: UUID, user_id: UUID, cart_item_id: UUID, quantity: float
    ) -> UserCartResponse:
        cart = await self.get_or_create_user_cart(db, org_id, user_id)
        item = await cart_item_repository.get_by_id(db, cart_item_id)
        if not item or item.cart_id != cart.id:
            raise NotFoundError("CartItem", str(cart_item_id))

        new_qty = Decimal(str(quantity))
        if new_qty <= Decimal("0.0"):
            await db.delete(item)
        else:
            unit_price = item.unit_price
            if item.item_id:
                tier_price = await catalog_tier_pricing_repository.get_best_tier_price(db, item.item_id, new_qty)
                if tier_price:
                    unit_price = tier_price
            item.quantity = new_qty
            item.unit_price = unit_price
            item.total_price = round(unit_price * new_qty, 4)

        await db.commit()
        return await self.get_user_cart_response(db, org_id, user_id)

    async def remove_cart_item(
        self, db: AsyncSession, org_id: UUID, user_id: UUID, cart_item_id: UUID
    ) -> UserCartResponse:
        cart = await self.get_or_create_user_cart(db, org_id, user_id)
        item = await cart_item_repository.get_by_id(db, cart_item_id)
        if item and item.cart_id == cart.id:
            await db.delete(item)
            await db.commit()
        return await self.get_user_cart_response(db, org_id, user_id)

    async def checkout_cart_to_pr(
        self, db: AsyncSession, org_id: UUID, user_id: UUID, payload: CartCheckoutRequest
    ) -> CartCheckoutResponse:
        cart = await self.get_or_create_user_cart(db, org_id, user_id)
        items = await cart_item_repository.list_by_cart(db, cart.id)
        if not items:
            raise ValidationError("Cart is empty. Add catalog items before checkout.")

        now = datetime.now(UTC)
        pr_number = f"PR-{now.strftime('%Y%m')}-{secrets.token_hex(3).upper()}"
        total_val = sum(i.total_price for i in items)

        # Resolve Business Unit
        bu_id = payload.business_unit_id
        if not bu_id:
            bu_stmt = select(BusinessUnit.id).where(BusinessUnit.org_id == org_id).limit(1)
            bu_id = (await db.execute(bu_stmt)).scalar()
            if not bu_id:
                raise ValidationError("No Business Unit found for organization.")

        # Resolve Cost Center
        cc_stmt = select(CostCenter.id).where(CostCenter.org_id == org_id, CostCenter.business_unit_id == bu_id).limit(1)
        cc_id = (await db.execute(cc_stmt)).scalar()
        if not cc_id:
            any_cc_stmt = select(CostCenter.id).where(CostCenter.org_id == org_id).limit(1)
            cc_id = (await db.execute(any_cc_stmt)).scalar()
            if not cc_id:
                new_cc = CostCenter(
                    id=uuid4(),
                    org_id=org_id,
                    business_unit_id=bu_id,
                    code=f"CC-{uuid4().hex[:4].upper()}",
                    name="Default Catalog Cost Center",
                )
                db.add(new_cc)
                await db.flush()
                cc_id = new_cc.id

        # Resolve Category
        cat_id = None
        for ci in items:
            if ci.item_id:
                master_item = await db.get(ItemMaster, ci.item_id)
                if master_item and master_item.category_id:
                    cat_id = master_item.category_id
                    break
        if not cat_id:
            cat_stmt = select(Category.id).where(Category.org_id == org_id).limit(1)
            cat_id = (await db.execute(cat_stmt)).scalar()
            if not cat_id:
                raise ValidationError("No Category found for organization.")

        # Create draft PR
        req = Requisition(
            id=uuid4(),
            org_id=org_id,
            pr_number=pr_number,
            title=payload.title,
            description=payload.notes,
            source=PrSourceEnum.MANUAL,
            status=PrStatusEnum.DRAFT,
            requestor_id=user_id,
            business_unit_id=bu_id,
            plant_id=payload.plant_id,
            department_id=payload.department_id,
            cost_center_id=cc_id,
            category_id=cat_id,
            delivery_location_id=payload.delivery_location_id,
            currency=cart.currency,
            estimated_value=total_val,
        )
        db.add(req)
        await db.flush()

        # Add PR Lines
        for idx, ci in enumerate(items):
            line_cat_id = None
            uom_id = None
            if ci.item_id:
                master_item = await db.get(ItemMaster, ci.item_id)
                if master_item:
                    line_cat_id = master_item.category_id
                    uom_id = master_item.uom_id

            if not line_cat_id:
                line_cat_id = cat_id
            if not uom_id:
                first_uom = (await db.execute(select(UomMaster.id).where(UomMaster.org_id == org_id).limit(1))).scalar()
                uom_id = first_uom or uuid4()

            line = RequisitionLine(
                id=uuid4(),
                org_id=org_id,
                requisition_id=req.id,
                line_number=idx + 1,
                item_code=ci.item_code,
                item_description=ci.item_name,
                category_id=line_cat_id,
                uom_id=uom_id,
                quantity=ci.quantity,
                estimated_unit_price=ci.unit_price,
            )
            db.add(line)

        # Mark cart CHECKED_OUT
        cart.status = "CHECKED_OUT"
        await db.commit()

        return CartCheckoutResponse(
            pr_id=req.id,
            pr_number=pr_number,
            title=req.title,
            total_value=float(total_val),
            currency=cart.currency,
            line_count=len(items),
            status=req.status.value if hasattr(req.status, "value") else str(req.status),
        )

    # --- PunchOut Marketplace Engine ---
    async def create_punchout_config(
        self, db: AsyncSession, org_id: UUID, payload: PunchoutConfigCreateRequest
    ) -> PunchoutConfig:
        config = PunchoutConfig(
            id=uuid4(),
            org_id=org_id,
            supplier_name=payload.supplier_name,
            protocol=payload.protocol.value,
            inbound_url=payload.inbound_url,
            shared_secret=payload.shared_secret,
            sender_identity=payload.sender_identity,
            buyer_identity=payload.buyer_identity,
            vendor_id=payload.vendor_id,
            logo_url=payload.logo_url,
            is_active=payload.is_active,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
        return config

    async def list_punchout_configs(self, db: AsyncSession, org_id: UUID) -> list[PunchoutConfig]:
        configs = await punchout_config_repository.list_by_org(db, org_id)
        if not configs:
            # Seed default punchout marketplaces
            defaults = [
                {
                    "name": "Amazon Business",
                    "protocol": "CXML",
                    "url": "https://punchout.amazon.com/cxml",
                    "sender": "HKT-PROCUREMENT",
                    "buyer": "AMZN-BUSINESS-HKT",
                    "secret": "amzn_sec_89f72b",
                },
                {
                    "name": "Grainger Industrial Supply",
                    "protocol": "OCI",
                    "url": "https://www.grainger.com/punchout/oci",
                    "sender": "HKT-PROCUREMENT",
                    "buyer": "GRAINGER-CORP",
                    "secret": "grg_sec_51c89e",
                },
                {
                    "name": "Coupa Storefront",
                    "protocol": "CXML",
                    "url": "https://supplier.coupahost.com/cxml",
                    "sender": "HKT-PROCUREMENT",
                    "buyer": "COUPA-B2B",
                    "secret": "cpa_sec_33d11b",
                },
            ]
            for d in defaults:
                conf = PunchoutConfig(
                    id=uuid4(),
                    org_id=org_id,
                    supplier_name=d["name"],
                    protocol=d["protocol"],
                    inbound_url=d["url"],
                    shared_secret=d["secret"],
                    sender_identity=d["sender"],
                    buyer_identity=d["buyer"],
                    is_active=True,
                )
                db.add(conf)
            await db.commit()
            configs = await punchout_config_repository.list_by_org(db, org_id)
        return configs

    async def launch_punchout_session(
        self, db: AsyncSession, org_id: UUID, user_id: UUID, payload: PunchoutLaunchRequest
    ) -> PunchoutLaunchResponse:
        config = await punchout_config_repository.get_by_id(db, payload.config_id, org_id)
        if not config:
            raise NotFoundError("PunchoutConfig", str(payload.config_id))

        session_token = f"pout_{secrets.token_urlsafe(32)}"
        session = PunchoutSession(
            id=uuid4(),
            org_id=org_id,
            user_id=user_id,
            config_id=config.id,
            session_token=session_token,
            status="INITIATED",
        )
        db.add(session)
        await db.commit()

        form_params: dict[str, str] = {}
        if config.protocol == "CXML":
            # Generate cXML SetupRequest template
            cxml_setup = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd">
<cXML payloadID="{session_token}" timestamp="{datetime.now(UTC).isoformat()}">
  <Header>
    <From><Credential domain="NetworkID"><Identity>{config.sender_identity}</Identity></Credential></From>
    <To><Credential domain="NetworkID"><Identity>{config.buyer_identity}</Identity></Credential></To>
    <Sender>
      <Credential domain="NetworkID"><Identity>{config.sender_identity}</Identity><SharedSecret>{config.shared_secret}</SharedSecret></Credential>
      <UserAgent>HKT-Procurement-Portal/2.0</UserAgent>
    </Sender>
  </Header>
  <Request>
    <PunchOutSetupRequest operation="create">
      <BuyerCookie>{session_token}</BuyerCookie>
      <BrowserFormPost><URL>{payload.return_url}</URL></BrowserFormPost>
    </PunchOutSetupRequest>
  </Request>
</cXML>"""
            form_params["cxml-urlencoded"] = cxml_setup
            redirect_url = config.inbound_url
        else:
            # OCI 4.0 Form-POST protocol
            form_params = {
                "HOOK_URL": payload.return_url,
                "BUYER_COOKIE": session_token,
                "USERNAME": config.sender_identity,
                "PASSWORD": config.shared_secret,
                "FUNCTION": "DETAIL",
            }
            redirect_url = config.inbound_url

        return PunchoutLaunchResponse(
            session_id=session.id,
            session_token=session_token,
            supplier_name=config.supplier_name,
            protocol=config.protocol,
            redirect_url=redirect_url,
            form_params=form_params,
        )

    async def process_punchout_callback(
        self, db: AsyncSession, payload: PunchoutCallbackRequest
    ) -> UserCartResponse:
        session = await punchout_session_repository.get_by_token(db, payload.session_token)
        if not session:
            raise NotFoundError("PunchoutSession", payload.session_token)

        items_to_add: list[dict[str, Any]] = []

        # 1. Parse from direct items
        if payload.items:
            for itm in payload.items:
                items_to_add.append({
                    "item_code": itm.item_code,
                    "item_name": itm.item_name,
                    "quantity": itm.quantity,
                    "unit_price": itm.unit_price,
                    "currency": itm.currency,
                })

        # 2. Parse from cXML payload
        elif payload.cxml_payload:
            try:
                root = defused_fromstring(payload.cxml_payload)
                for item_in in root.findall(".//ItemIn"):
                    desc_el = item_in.find(".//Description")
                    item_name = desc_el.text if desc_el is not None and desc_el.text else "PunchOut Item"
                    part_el = item_in.find(".//SupplierPartID")
                    item_code = part_el.text if part_el is not None and part_el.text else f"POUT-{secrets.token_hex(4).upper()}"
                    qty_attr = item_in.attrib.get("quantity", "1")
                    money_el = item_in.find(".//Money")
                    price = float(money_el.text) if money_el is not None and money_el.text else 100.0
                    currency = money_el.attrib.get("currency", "INR") if money_el is not None else "INR"

                    items_to_add.append({
                        "item_code": item_code,
                        "item_name": item_name,
                        "quantity": float(qty_attr),
                        "unit_price": price,
                        "currency": currency,
                    })
            except Exception as e:
                logger.warning(f"Failed to parse cXML PunchOut message: {e}")

        # 3. Parse from OCI Form parameters
        elif payload.oci_params:
            oci = payload.oci_params
            idx = 1
            while f"NEW_ITEM-DESCRIPTION[{idx}]" in oci or f"NEW_ITEM-DESCRIPTION_{idx}" in oci:
                desc = oci.get(f"NEW_ITEM-DESCRIPTION[{idx}]") or oci.get(f"NEW_ITEM-DESCRIPTION_{idx}")
                code = oci.get(f"NEW_ITEM-MATNR[{idx}]") or oci.get(f"NEW_ITEM-MATNR_{idx}") or f"OCI-{idx}"
                qty = float(oci.get(f"NEW_ITEM-QUANTITY[{idx}]") or oci.get(f"NEW_ITEM-QUANTITY_{idx}") or 1)
                price = float(oci.get(f"NEW_ITEM-PRICE[{idx}]") or oci.get(f"NEW_ITEM-PRICE_{idx}") or 0)
                curr = oci.get(f"NEW_ITEM-CURRENCY[{idx}]") or oci.get(f"NEW_ITEM-CURRENCY_{idx}") or "INR"

                items_to_add.append({
                    "item_code": str(code),
                    "item_name": str(desc),
                    "quantity": qty,
                    "unit_price": price,
                    "currency": str(curr),
                })
                idx += 1

        # Fallback if empty
        if not items_to_add:
            items_to_add.append({
                "item_code": f"{session.config.supplier_name[:4].upper()}-ITEM-01",
                "item_name": f"{session.config.supplier_name} Marketplace Selected Cart Items",
                "quantity": 1.0,
                "unit_price": 2499.0,
                "currency": "INR",
            })

        # Save to session
        session.status = "RETURNED"
        session.cart_data = items_to_add
        await db.commit()

        # Add items to user's active cart
        for itm in items_to_add:
            await self.add_item_to_cart(
                db,
                org_id=session.org_id,
                user_id=session.user_id,
                payload=CartItemAddRequest(
                    item_code=itm["item_code"],
                    item_name=itm["item_name"],
                    quantity=itm["quantity"],
                    unit_price=itm["unit_price"],
                    currency=itm["currency"],
                    punchout_payload={"supplier": session.config.supplier_name, "session_id": str(session.id)},
                ),
            )

        return await self.get_user_cart_response(db, session.org_id, session.user_id)


catalog_service = CatalogService()
