"""
Unit tests for SPEC_24 Master Data Management.
Tests all services, repositories, validations, CTE hierarchy, exchange rates, and import tasks.
Uses AsyncMock / MagicMock to ensure complete test isolation and zero dependencies on live DB.
"""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.master_data.category.service import (
    CategoryCreateRequest,
    CategoryService,
    CategoryUpdateRequest,
)
from app.modules.master_data.currency.service import (
    CurrencyCreateRequest,
    CurrencyService,
    CurrencyUpdateRequest,
)
from app.modules.master_data.erp_mapping.service import (
    ErpMappingCreateRequest,
    ErpMappingService,
)
from app.modules.master_data.holiday.schemas import HolidayCreateRequest
from app.modules.master_data.holiday.service import HolidayService
from app.modules.master_data.import_service import MasterDataImportService
from app.modules.master_data.location.service import (
    DeliveryLocationService,
    LocationCreateRequest,
)
from app.modules.master_data.models import (
    Category,
    CurrencyMaster,
    DeliveryLocation,
    ErpMaterialGroupMapping,
    HolidayMaster,
    PaymentTerm,
    TaxCode,
    UomMaster,
)
from app.modules.master_data.payment_terms.schemas import (
    PaymentTermCreateRequest,
    PaymentTermUpdateRequest,
)
from app.modules.master_data.payment_terms.service import PaymentTermsService
from app.modules.master_data.tax.service import (
    TaxCreateRequest,
    TaxService,
)
from app.modules.master_data.uom.service import (
    UomCreateRequest,
    UomService,
    UomUpdateRequest,
)


# =============================================================================
# 1. Category Service Tests
# =============================================================================


class TestCategoryService:
    @pytest.mark.asyncio
    async def test_create_root_category_success(self, org_id, user_id):
        repo = MagicMock()
        repo.get_by_code = AsyncMock(return_value=None)
        service = CategoryService(repo=repo)

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        req = CategoryCreateRequest(code="IT", name="Information Technology")

        with patch("app.modules.master_data.category.service.audit_service.log", AsyncMock()):
            cat = await service.create(mock_db, req, user_id, org_id)

        assert cat.code == "IT"
        assert cat.name == "Information Technology"
        assert cat.level == 1
        assert cat.path == "/IT"
        assert cat.parent_id is None
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_child_category_success(self, org_id, user_id):
        repo = MagicMock()
        repo.get_by_code = AsyncMock(return_value=None)
        parent_id = uuid4()
        parent = MagicMock(spec=Category, id=parent_id, level=1, path="/IT")
        repo.get = AsyncMock(return_value=parent)

        service = CategoryService(repo=repo)
        service._get_depth = AsyncMock(return_value=1)

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        req = CategoryCreateRequest(code="HW", name="Hardware", parent_id=parent_id)

        with patch("app.modules.master_data.category.service.audit_service.log", AsyncMock()):
            cat = await service.create(mock_db, req, user_id, org_id)

        assert cat.code == "HW"
        assert cat.level == 2
        assert cat.path == "/IT/HW"
        assert cat.parent_id == parent_id

    @pytest.mark.asyncio
    async def test_category_max_depth_enforced(self, org_id, user_id):
        """Creating category at level 6 raises MAX_DEPTH_EXCEEDED."""
        repo = MagicMock()
        repo.get_by_code = AsyncMock(return_value=None)
        l5_id = uuid4()
        l5_parent = MagicMock(spec=Category, id=l5_id, level=5, path="/1/2/3/4/5")
        repo.get = AsyncMock(return_value=l5_parent)

        service = CategoryService(repo=repo)
        service._get_depth = AsyncMock(return_value=5)

        mock_db = AsyncMock()
        req = CategoryCreateRequest(code="L6", name="Level 6 Child", parent_id=l5_id)

        with pytest.raises(ValidationError) as exc:
            await service.create(mock_db, req, user_id, org_id)
        assert exc.value.message == "MAX_DEPTH_EXCEEDED"

    @pytest.mark.asyncio
    async def test_create_duplicate_code_raises_conflict(self, org_id, user_id):
        repo = MagicMock()
        repo.get_by_code = AsyncMock(return_value=MagicMock(spec=Category))
        service = CategoryService(repo=repo)

        mock_db = AsyncMock()
        req = CategoryCreateRequest(code="EXISTING", name="Duplicate Code")

        with pytest.raises(ConflictError):
            await service.create(mock_db, req, user_id, org_id)

    @pytest.mark.asyncio
    async def test_build_tree_hierarchy(self):
        service = CategoryService(repo=MagicMock())

        Row = MagicMock
        r1 = Row(id=UUID("00000000-0000-0000-0000-000000000001"), name="Root", code="ROOT", parent_id=None, level=1, path="/ROOT", is_active=True, unspsc_code=None)
        r2 = Row(id=UUID("00000000-0000-0000-0000-000000000002"), name="Child", code="CHILD", parent_id=r1.id, level=2, path="/ROOT/CHILD", is_active=True, unspsc_code=None)
        r3 = Row(id=UUID("00000000-0000-0000-0000-000000000003"), name="Grandchild", code="GCHILD", parent_id=r2.id, level=3, path="/ROOT/CHILD/GCHILD", is_active=True, unspsc_code=None)

        tree = service._build_tree([r1, r2, r3])
        assert len(tree) == 1
        assert tree[0]["code"] == "ROOT"
        assert len(tree[0]["children"]) == 1
        assert tree[0]["children"][0]["code"] == "CHILD"
        assert len(tree[0]["children"][0]["children"]) == 1
        assert tree[0]["children"][0]["children"][0]["code"] == "GCHILD"

    @pytest.mark.asyncio
    async def test_soft_delete_with_children_raises_conflict(self, org_id, user_id):
        repo = MagicMock()
        cat_id = uuid4()
        repo.get = AsyncMock(return_value=MagicMock(spec=Category, id=cat_id))
        repo.get_active_children_count = AsyncMock(return_value=2)
        service = CategoryService(repo=repo)

        mock_db = AsyncMock()
        with pytest.raises(ConflictError):
            await service.soft_delete(mock_db, cat_id, user_id, org_id)

    @pytest.mark.asyncio
    async def test_soft_delete_leaf_success(self, org_id, user_id):
        repo = MagicMock()
        cat = MagicMock(spec=Category, id=uuid4(), is_active=True, version=1)
        repo.get = AsyncMock(return_value=cat)
        repo.get_active_children_count = AsyncMock(return_value=0)
        service = CategoryService(repo=repo)

        mock_db = AsyncMock()
        with patch("app.modules.master_data.category.service.audit_service.log", AsyncMock()):
            await service.soft_delete(mock_db, cat.id, user_id, org_id)

        assert cat.is_active is False
        assert cat.deleted_at is not None


# =============================================================================
# 2. UOM Service Tests
# =============================================================================


class TestUomService:
    @pytest.mark.asyncio
    async def test_create_uom_success(self, org_id, user_id):
        repo = MagicMock()
        repo.find_by_code = AsyncMock(return_value=None)
        service = UomService(repository=repo)

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        req = UomCreateRequest(code="KG", name="Kilogram", iso_code="KGM")

        with patch("app.modules.master_data.uom.service.audit_service.log", AsyncMock()):
            uom = await service.create(mock_db, req, user_id, org_id)

        assert uom.code == "KG"
        assert uom.name == "Kilogram"
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_uom_duplicate_raises_conflict(self, org_id, user_id):
        repo = MagicMock()
        repo.find_by_code = AsyncMock(return_value=MagicMock(spec=UomMaster, id=uuid4()))
        service = UomService(repository=repo)

        mock_db = AsyncMock()
        req = UomCreateRequest(code="KG", name="Kilogram")

        with pytest.raises(ConflictError):
            await service.create(mock_db, req, user_id, org_id)


# =============================================================================
# 3. Currency Service Tests
# =============================================================================


class TestCurrencyService:
    @pytest.mark.asyncio
    async def test_create_currency_success(self, org_id, user_id):
        repo = MagicMock()
        repo.get_by_code = AsyncMock(return_value=None)
        repo.get_base_currency = AsyncMock(return_value=None)
        service = CurrencyService(repo=repo)

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        req = CurrencyCreateRequest(code="USD", name="US Dollar", symbol="$", exchange_rate_to_base=Decimal("83.5"))

        with patch("app.modules.master_data.currency.service.audit_service.log", AsyncMock()):
            curr = await service.create(mock_db, req, user_id, org_id)

        assert curr.code == "USD"
        assert curr.symbol == "$"
        assert curr.exchange_rate_to_base == Decimal("83.5")

    @pytest.mark.asyncio
    async def test_cannot_deactivate_base_currency(self, org_id, user_id):
        repo = MagicMock()
        base_curr = MagicMock(spec=CurrencyMaster, is_base_currency=True)
        repo.get = AsyncMock(return_value=base_curr)
        service = CurrencyService(repo=repo)

        mock_db = AsyncMock()
        with pytest.raises(ValidationError) as exc:
            await service.deactivate(mock_db, uuid4(), user_id, org_id)
        assert exc.value.message == "CANNOT_DEACTIVATE_BASE_CURRENCY"

    @pytest.mark.asyncio
    async def test_exchange_rate_from_redis(self):
        service = CurrencyService(repo=MagicMock())
        mock_redis = AsyncMock()
        mock_redis.get.return_value = b"83.500000"

        with patch("app.modules.master_data.currency.service.get_redis_client", return_value=mock_redis):
            rate = await service.get_exchange_rate("USD", "INR")
        assert rate == Decimal("83.500000")


# =============================================================================
# 4. Payment Terms Service Tests
# =============================================================================


class TestPaymentTermsService:
    @pytest.mark.asyncio
    async def test_create_payment_term_success(self, org_id, user_id):
        repo = MagicMock()
        repo.get_by_code = AsyncMock(return_value=None)
        service = PaymentTermsService(repo=repo)

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        req = PaymentTermCreateRequest(
            code="NET30",
            name="Net 30 Days",
            net_days=30,
            discount_percentage=Decimal("2.0"),
            discount_days=10,
        )

        with patch("app.modules.master_data.payment_terms.service.audit_service.log", AsyncMock()):
            pt = await service.create(mock_db, req, user_id, org_id)

        assert pt.code == "NET30"
        assert pt.net_days == 30
        assert pt.discount_days == 10
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_discount_days_greater_than_net_days_rejected(self, org_id, user_id):
        repo = MagicMock()
        service = PaymentTermsService(repo=repo)

        mock_db = AsyncMock()
        req = PaymentTermCreateRequest(
            code="INVALID",
            name="Invalid Terms",
            net_days=15,
            discount_percentage=Decimal("5.0"),
            discount_days=20,  # > net_days (15)
        )

        with pytest.raises(ValidationError):
            await service.create(mock_db, req, user_id, org_id)


# =============================================================================
# 5. Tax Service Tests
# =============================================================================


class TestTaxService:
    @pytest.mark.asyncio
    async def test_create_tax_code_success(self, org_id, user_id):
        repo = MagicMock()
        repo.get_by_code_and_org = AsyncMock(return_value=None)
        service = TaxService(repo=repo)

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        req = TaxCreateRequest(
            code="GST18",
            name="Goods and Services Tax 18%",
            rate=Decimal("18.00"),
            tax_type="GST",
            hsn_chapter="84",
        )

        with patch("app.modules.master_data.tax.service.audit_service.log", AsyncMock()):
            tax = await service.create(mock_db, req, user_id, org_id)

        assert tax.code == "GST18"
        assert tax.rate == Decimal("18.00")
        assert tax.tax_type == "GST"

    @pytest.mark.asyncio
    async def test_invalid_tax_type_rejected(self):
        with pytest.raises(ValueError):
            TaxCreateRequest(
                code="BAD",
                name="Bad Tax",
                rate=Decimal("10.0"),
                tax_type="INVALID_TYPE",
            )


# =============================================================================
# 6. Delivery Location Service Tests
# =============================================================================


class TestDeliveryLocationService:
    @pytest.mark.asyncio
    async def test_create_location_success(self, org_id, user_id):
        repo = MagicMock()
        repo.get_by_code = AsyncMock(return_value=None)
        mock_loc = MagicMock(spec=DeliveryLocation, code="WH-MUM-01", country_code="IN", id=uuid4())
        repo.create = AsyncMock(return_value=mock_loc)
        service = DeliveryLocationService(repo=repo)

        mock_db = AsyncMock()
        req = LocationCreateRequest(
            code="WH-MUM-01",
            name="Mumbai Central Warehouse",
            address="Plot 12, MIDC Andheri",
            city="Mumbai",
            state="Maharashtra",
            postal_code="400093",
            country_code="IN",
        )

        with patch("app.modules.master_data.location.service.audit_service.log", AsyncMock()):
            loc = await service.create(mock_db, req, user_id, org_id)

        assert loc.code == "WH-MUM-01"
        assert loc.country_code == "IN"

    @pytest.mark.asyncio
    async def test_invalid_country_code_rejected(self):
        with pytest.raises(Exception):
            LocationCreateRequest(
                code="WH-01",
                name="WH",
                address="Addr",
                city="City",
                state="State",
                postal_code="123",
                country_code="INDIA",  # must be 2 chars
            )


# =============================================================================
# 7. Holiday Service Tests
# =============================================================================


class TestHolidayService:
    @pytest.mark.asyncio
    async def test_past_date_holiday_rejected(self, org_id, user_id):
        repo = MagicMock()
        service = HolidayService(repo=repo)

        mock_db = AsyncMock()
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
        req = HolidayCreateRequest(name="Past Holiday", holiday_date=yesterday)

        with pytest.raises(ValidationError) as exc:
            await service.create(mock_db, req, user_id, org_id)
        assert exc.value.message == "PAST_DATE_NOT_ALLOWED"

    @pytest.mark.asyncio
    async def test_future_holiday_success(self, org_id, user_id):
        repo = MagicMock()
        repo.find_duplicate = AsyncMock(return_value=None)
        service = HolidayService(repo=repo)

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        next_month = (datetime.now(timezone.utc) + timedelta(days=30)).date()
        req = HolidayCreateRequest(name="National Day", holiday_date=next_month)

        with patch("app.modules.master_data.holiday.service.audit_service.log", AsyncMock()):
            h = await service.create(mock_db, req, user_id, org_id)

        assert h.name == "National Day"
        assert h.holiday_date == next_month


# =============================================================================
# 8. ERP Mapping Service Tests
# =============================================================================


class TestErpMappingService:
    @pytest.mark.asyncio
    async def test_create_mapping_category_not_found_raises_error(self, org_id, user_id):
        repo = MagicMock()
        service = ErpMappingService(repo=repo)

        mock_db = AsyncMock()
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_res)

        req = ErpMappingCreateRequest(erp_material_group="MAT-01", category_id=uuid4())

        with pytest.raises(NotFoundError):
            await service.create(mock_db, req, user_id, org_id)


# =============================================================================
# 9. Master Data Import Service Tests
# =============================================================================


class TestMasterDataImportService:
    @pytest.mark.asyncio
    async def test_import_missing_headers_raises_error(self, org_id, user_id):
        service = MasterDataImportService()
        csv_bytes = b"wrong_header,another_wrong\n1,2\n"
        mock_db = AsyncMock()

        with pytest.raises(ValidationError) as exc:
            await service.import_categories_csv(mock_db, csv_bytes, user_id, org_id)
        assert exc.value.message == "MISSING_CSV_HEADERS"

    @pytest.mark.asyncio
    async def test_import_empty_csv_raises_error(self, org_id, user_id):
        service = MasterDataImportService()
        csv_bytes = b""
        mock_db = AsyncMock()

        with pytest.raises(ValidationError) as exc:
            await service.import_categories_csv(mock_db, csv_bytes, user_id, org_id)
        assert exc.value.message == "EMPTY_CSV_FILE"

    @pytest.mark.asyncio
    async def test_import_too_large_csv_raises_error(self, org_id, user_id):
        service = MasterDataImportService()
        # Generate 5001 rows
        lines = ["code,name,parent_code"]
        for i in range(5001):
            lines.append(f"CAT{i},Name{i},")
        csv_bytes = "\n".join(lines).encode("utf-8")
        mock_db = AsyncMock()

        with pytest.raises(ValidationError) as exc:
            await service.import_categories_csv(mock_db, csv_bytes, user_id, org_id)
        assert exc.value.message == "IMPORT_TOO_LARGE"

    @pytest.mark.asyncio
    async def test_import_valid_csv_enqueues_job(self, org_id, user_id):
        service = MasterDataImportService()
        csv_bytes = b"code,name,parent_code\nIT,Information Tech,\nLAPTOPS,Laptops,IT\n"
        mock_db = AsyncMock()
        mock_db.add = MagicMock()

        with patch("app.modules.master_data.import_service.audit_service.log", AsyncMock()):
            with patch("app.tasks.master_data_import.import_categories_task.delay", MagicMock()) as mock_task:
                job = await service.import_categories_csv(mock_db, csv_bytes, user_id, org_id)

        assert job.job_type == "CATEGORY_IMPORT"
        assert len(job.request_payload["rows"]) == 2
        mock_task.assert_called_once()


# =============================================================================
# 10. Incoterms Router Tests
# =============================================================================


class TestIncotermEndpoints:
    def test_incoterm_create_request_validation(self):
        from app.modules.master_data.router import IncotermCreateRequest, IncotermUpdateRequest
        req = IncotermCreateRequest(
            code="DDP",
            name="Delivered Duty Paid",
            edition_year=2020,
            risk_transfer_point="Buyer designated premises",
        )
        assert req.code == "DDP"
        assert req.edition_year == 2020

        upd = IncotermUpdateRequest(name="Updated DDP", is_active=False)
        assert upd.name == "Updated DDP"
        assert upd.is_active is False

    @pytest.mark.asyncio
    async def test_create_incoterm_conflict(self, org_id, user_id):
        from app.modules.master_data.router import IncotermCreateRequest, create_incoterm
        mock_user = MagicMock(id=user_id, org_id=org_id)
        mock_db = AsyncMock()
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = MagicMock()  # existing found
        mock_db.execute.return_value = mock_res

        req = IncotermCreateRequest(
            code="FOB",
            name="Free on Board",
            risk_transfer_point="Port of origin",
        )
        with pytest.raises(ConflictError):
            await create_incoterm(req, mock_user, mock_db)

    @pytest.mark.asyncio
    async def test_create_incoterm_success(self, org_id, user_id):
        from app.modules.master_data.router import IncotermCreateRequest, create_incoterm
        mock_user = MagicMock(id=user_id, org_id=org_id)
        mock_db = AsyncMock()
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = None  # no existing
        mock_db.execute.return_value = mock_res

        req = IncotermCreateRequest(
            code="CIF",
            name="Cost, Insurance and Freight",
            edition_year=2020,
            risk_transfer_point="Ship rail at destination port",
        )
        res = await create_incoterm(req, mock_user, mock_db)
        assert res["data"].code == "CIF"
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

