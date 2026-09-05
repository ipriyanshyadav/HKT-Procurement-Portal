import asyncio
import os
import sys
from decimal import Decimal
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select, text
from app.db.session import async_session
from app.core.constants import DEFAULT_ORG_ID
from app.modules.master_data.models import Category, UomMaster, ItemMaster

CATALOG_ITEMS = [
    {
        "code": "IT-LAPTOP-01",
        "name": "Dell Latitude 5440 Enterprise Laptop (i7/16GB/512GB)",
        "description": "14-inch FHD, Intel Core i7 13th Gen, 16GB DDR5, 512GB NVMe SSD, 3-Yr ProSupport",
        "standard_price": Decimal("82500.00"),
        "currency": "INR",
        "hsn_code": "84713010",
        "category_code": "CAT-IT",
        "uom_code": "EA",
        "image_url": "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400",
        "is_punchout": False,
    },
    {
        "code": "IT-MON-02",
        "name": "Dell UltraSharp 27-inch 4K USB-C Hub Monitor (U2723QE)",
        "description": "IPS Black technology, 4K UHD 3840x2160, 90W Power Delivery, RJ45 Ethernet",
        "standard_price": Decimal("46500.00"),
        "currency": "INR",
        "hsn_code": "85285200",
        "category_code": "CAT-IT",
        "uom_code": "EA",
        "image_url": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400",
        "is_punchout": False,
    },
    {
        "code": "NET-SW-03",
        "name": "Cisco Catalyst 9200L 24-port PoE+ Gigabit Switch",
        "description": "24 Ports Full PoE+ (370W), 4x 10G SFP+ uplinks, Layer 3 routing capabilities",
        "standard_price": Decimal("145000.00"),
        "currency": "INR",
        "hsn_code": "85176290",
        "category_code": "CAT-NET",
        "uom_code": "EA",
        "image_url": "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400",
        "is_punchout": False,
    },
    {
        "code": "FUR-CHAIR-04",
        "name": "Ergonomic High-Back Mesh Task Chair",
        "description": "Adjustable lumbar support, 4D armrests, breathable mesh, BIFMA certified",
        "standard_price": Decimal("14500.00"),
        "currency": "INR",
        "hsn_code": "94013000",
        "category_code": "CAT-FAC",
        "uom_code": "EA",
        "image_url": "https://images.unsplash.com/photo-1580481077195-c3a821a506cb?w=400",
        "is_punchout": False,
    },
    {
        "code": "FUR-DESK-05",
        "name": "Motorized Dual-Motor Height Adjustable Standing Desk",
        "description": "1500x750mm walnut finish top, digital memory keypad, anti-collision sensor",
        "standard_price": Decimal("28900.00"),
        "currency": "INR",
        "hsn_code": "94031090",
        "category_code": "CAT-FAC",
        "uom_code": "SET",
        "image_url": "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=400",
        "is_punchout": False,
    },
    {
        "code": "PPE-HELMET-06",
        "name": "Karam Industrial Safety Helmet with Ratchet Suspension",
        "description": "HDPE material, ISI marked, chin strap, slot for earmuffs and visor",
        "standard_price": Decimal("480.00"),
        "currency": "INR",
        "hsn_code": "65061090",
        "category_code": "CAT-PPE",
        "uom_code": "EA",
        "image_url": "https://images.unsplash.com/photo-1508873696983-2df57046475a?w=400",
        "is_punchout": False,
    },
    {
        "code": "PPE-BOOTS-07",
        "name": "Steel-Toe Heavy Duty Safety Boots (S3 SRC Rated)",
        "description": "Genuine leather, 200J steel toe cap, anti-static, oil and chemical resistant",
        "standard_price": Decimal("2250.00"),
        "currency": "INR",
        "hsn_code": "64034000",
        "category_code": "CAT-PPE",
        "uom_code": "SET",
        "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
        "is_punchout": False,
    },
    {
        "code": "OFF-PAPER-08",
        "name": "JK Copier A4 Copier Paper (75 GSM, 500 Sheets/Ream)",
        "description": "Fast drying, 98% brightness, jam-free high-speed laser printing",
        "standard_price": Decimal("320.00"),
        "currency": "INR",
        "hsn_code": "48025610",
        "category_code": "CAT-OFF",
        "uom_code": "PKT",
        "image_url": "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400",
        "is_punchout": False,
    },
    {
        "code": "PO-AMZN-09",
        "name": "Amazon Business PunchOut Catalog Storefront",
        "description": "Pre-negotiated corporate catalog with millions of business supplies and Tier-1 discounts",
        "standard_price": Decimal("0.00"),
        "currency": "INR",
        "hsn_code": "998319",
        "category_code": "CAT-OFF",
        "uom_code": "EA",
        "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
        "is_punchout": True,
    },
]

async def seed():
    async with async_session() as db:
        # Get or find categories and UOMs
        cat_res = await db.execute(select(Category).where(Category.deleted_at.is_(None)))
        cats = list(cat_res.scalars().all())
        cat_map = {c.code: c.id for c in cats}

        uom_res = await db.execute(select(UomMaster).where(UomMaster.deleted_at.is_(None)))
        uoms = list(uom_res.scalars().all())
        uom_map = {u.code: u.id for u in uoms}

        fallback_cat_id = cats[0].id if cats else None
        fallback_uom_id = uoms[0].id if uoms else None

        if not fallback_cat_id or not fallback_uom_id:
            print("Categories or UOMs missing, run seed_master_data.py first")
            return

        count = 0
        for item_data in CATALOG_ITEMS:
            code = item_data["code"]
            # check exists
            chk = await db.execute(select(ItemMaster).where(ItemMaster.code == code, ItemMaster.deleted_at.is_(None)))
            if chk.scalar_one_or_none():
                continue

            c_id = cat_map.get(item_data["category_code"]) or fallback_cat_id
            u_id = uom_map.get(item_data["uom_code"]) or fallback_uom_id

            item = ItemMaster(
                id=uuid4(),
                org_id=DEFAULT_ORG_ID,
                code=code,
                name=item_data["name"],
                description=item_data["description"],
                category_id=c_id,
                uom_id=u_id,
                standard_price=item_data["standard_price"],
                currency=item_data["currency"],
                hsn_code=item_data["hsn_code"],
                image_url=item_data["image_url"],
                is_punchout=item_data["is_punchout"],
                is_active=True,
            )
            db.add(item)
            count += 1

        await db.commit()
        print(f"Successfully seeded {count} catalog items into item_master.")

if __name__ == "__main__":
    asyncio.run(seed())
