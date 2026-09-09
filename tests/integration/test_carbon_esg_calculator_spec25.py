from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.modules.analytics.esg_service import carbon_esg_service
from app.modules.analytics.schemas import (
    CategoryEmissionFactorCreate,
    SupplierESGScorecardUpdate,
)
from app.modules.organization.models import Organization
from app.modules.vendor.models import Vendor


@pytest.fixture
async def db_session():
    test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_carbon_esg_footprint_calculation(db_session: AsyncSession):
    # 1. Setup isolated organization
    org_id = uuid4()
    org = Organization(
        id=org_id,
        name=f"ESG Test Org {uuid4().hex[:6]}",
        legal_name=f"ESG Test Org Legal {uuid4().hex[:6]}",
    )
    db_session.add(org)

    # 2. Add test vendor
    vendor_id = uuid4()
    vendor = Vendor(
        id=vendor_id,
        org_id=org_id,
        company_name=f"Green Tech Solutions {uuid4().hex[:4]}",
        primary_email=f"contact_{uuid4().hex[:6]}@greentech.com",
        vendor_code="VEND-ESG-01",
    )
    db_session.add(vendor)
    await db_session.commit()

    # 3. Test emission factors seeding & CRUD
    factors = await carbon_esg_service.get_emission_factors(db_session, org_id)
    assert len(factors) >= 8
    cat_names = {f.category_name for f in factors}
    assert "IT & Electronics" in cat_names
    assert "Logistics & Freight" in cat_names

    # Custom emission factor creation
    custom_factor = await carbon_esg_service.save_emission_factor(
        db_session,
        org_id,
        CategoryEmissionFactorCreate(
            category_name="Renewable Power & Utilities",
            scope1_factor=0.0120,
            scope2_factor=0.0250,
            scope3_factor=0.1500,
        ),
    )
    assert custom_factor.category_name == "Renewable Power & Utilities"
    assert custom_factor.scope3_factor == 0.15

    # 4. Test Supplier ESG Scorecard update
    scorecard = await carbon_esg_service.update_supplier_scorecard(
        db_session,
        org_id,
        vendor_id,
        SupplierESGScorecardUpdate(
            environmental_score=92.0,
            social_score=88.0,
            governance_score=95.0,
            carbon_intensity_kg_per_spend=0.2800,
            sbti_committed=True,
            net_zero_target_year=2030,
            iso_14001_certified=True,
            renewable_energy_pct=85.0,
            audit_notes="Audited by SGS Global. Certified ISO 14001 & SBTi approved.",
        ),
    )
    assert scorecard.vendor_id == vendor_id
    assert scorecard.esg_rating == "AAA"
    assert scorecard.sbti_committed is True
    assert scorecard.composite_esg_score >= 90.0

    # 5. Test Carbon Footprint Calculation
    footprint = await carbon_esg_service.calculate_carbon_footprint(db_session, org_id)
    assert footprint.total_co2e_tonnes > 0
    assert footprint.scope1_co2e_tonnes > 0
    assert footprint.scope2_co2e_tonnes > 0
    assert footprint.scope3_co2e_tonnes > 0
    assert len(footprint.category_breakdown) > 0
    assert len(footprint.net_zero_trajectory) == 7
    assert len(footprint.decarbonization_recommendations) >= 3

    # Verify trajectory starts in 2024 and extends to 2030 with decreasing targets
    t_2024 = footprint.net_zero_trajectory[0]
    t_2030 = footprint.net_zero_trajectory[-1]
    assert t_2024.year == 2024
    assert t_2030.year == 2030
    assert t_2030.target_co2e_tonnes < t_2024.target_co2e_tonnes
