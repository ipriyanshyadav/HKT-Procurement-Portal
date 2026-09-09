from __future__ import annotations
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repository_base import BaseRepository
from app.db.enums import VendorStatusEnum
from app.modules.vendor.models import (
    Vendor,
    VendorContact,
    VendorBankAccount,
    VendorCategoryMapping,
    VendorDocument,
    VendorScorecard,
    VendorErpSyncLog,
    VendorRiskAssessment,
)


class VendorRepository(BaseRepository[Vendor]):
    def __init__(self) -> None:
        super().__init__(Vendor)

    async def find_by_id(
        self, db: AsyncSession, vendor_id: UUID, org_id: Optional[UUID] = None
    ) -> Optional[Vendor]:
        stmt = select(Vendor).where(Vendor.id == vendor_id, Vendor.deleted_at.is_(None))
        if org_id:
            stmt = stmt.where(Vendor.org_id == org_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_ids(
        self, db: AsyncSession, vendor_ids: List[UUID], org_id: Optional[UUID] = None
    ) -> List[Vendor]:
        if not vendor_ids:
            return []
        stmt = select(Vendor).where(Vendor.id.in_(vendor_ids), Vendor.deleted_at.is_(None))
        if org_id:
            stmt = stmt.where(Vendor.org_id == org_id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_vendor_code(
        self, db: AsyncSession, org_id: UUID, vendor_code: str
    ) -> Optional[Vendor]:
        stmt = select(Vendor).where(
            and_(
                Vendor.org_id == org_id,
                Vendor.vendor_code == vendor_code.strip(),
                Vendor.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_email(
        self, db: AsyncSession, org_id: UUID, email: str
    ) -> Optional[Vendor]:
        stmt = select(Vendor).where(
            and_(
                Vendor.org_id == org_id,
                func.lower(Vendor.primary_email) == email.lower().strip(),
                Vendor.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_pan(
        self, db: AsyncSession, org_id: UUID, pan: str
    ) -> Optional[Vendor]:
        stmt = select(Vendor).where(
            and_(
                Vendor.org_id == org_id,
                func.upper(Vendor.pan) == pan.upper().strip(),
                Vendor.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_gstin(
        self, db: AsyncSession, org_id: UUID, gstin: str
    ) -> Optional[Vendor]:
        stmt = select(Vendor).where(
            and_(
                Vendor.org_id == org_id,
                func.upper(Vendor.gstin) == gstin.upper().strip(),
                Vendor.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_invitation_token(
        self, db: AsyncSession, token: str
    ) -> Optional[Vendor]:
        stmt = select(Vendor).where(
            and_(
                Vendor.invitation_token == token,
                Vendor.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_email_domain(
        self, db: AsyncSession, org_id: UUID, domain: str
    ) -> List[Vendor]:
        pattern = f"%@{domain.lower().strip()}"
        stmt = select(Vendor).where(
            and_(
                Vendor.org_id == org_id,
                func.lower(Vendor.primary_email).like(pattern),
                Vendor.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_active_vendor_names(
        self, db: AsyncSession, org_id: UUID
    ) -> List[Vendor]:
        stmt = select(Vendor).where(
            and_(
                Vendor.org_id == org_id,
                Vendor.status.in_([VendorStatusEnum.ACTIVE, VendorStatusEnum.QUALIFIED, VendorStatusEnum.SUBMITTED]),
                Vendor.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_bank_ifsc(
        self, db: AsyncSession, org_id: UUID, account_number_encrypted: str, ifsc: str
    ) -> Optional[VendorBankAccount]:
        stmt = select(VendorBankAccount).where(
            and_(
                VendorBankAccount.org_id == org_id,
                VendorBankAccount.account_number_encrypted == account_number_encrypted,
                func.upper(VendorBankAccount.ifsc_code) == ifsc.upper().strip(),
                VendorBankAccount.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_vendors(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: Optional[str] = None,
        category_id: Optional[UUID] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
    ) -> Tuple[List[Vendor], int]:
        query = select(Vendor).where(
            Vendor.org_id == org_id,
            Vendor.deleted_at.is_(None),
        )

        if status:
            query = query.where(Vendor.status == status)

        if category_id:
            query = query.join(
                VendorCategoryMapping,
                VendorCategoryMapping.vendor_id == Vendor.id,
            ).where(
                VendorCategoryMapping.category_id == category_id,
                VendorCategoryMapping.deleted_at.is_(None),
            )

        if search:
            s = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Vendor.company_name.ilike(s),
                    Vendor.legal_name.ilike(s),
                    Vendor.vendor_code.ilike(s),
                    Vendor.pan.ilike(s),
                    Vendor.gstin.ilike(s),
                    Vendor.primary_email.ilike(s),
                )
            )

        count_stmt = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_stmt)).scalar() or 0

        sort_col = getattr(Vendor, sort_by, Vendor.created_at)
        if sort_dir.lower() == "asc":
            query = query.order_by(asc(sort_col))
        else:
            query = query.order_by(desc(sort_col))

        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = await db.execute(query)
        items = list(result.scalars().all())
        return items, total

    async def get_categories(
        self, db: AsyncSession, vendor_id: UUID
    ) -> List[VendorCategoryMapping]:
        stmt = select(VendorCategoryMapping).where(
            VendorCategoryMapping.vendor_id == vendor_id,
            VendorCategoryMapping.deleted_at.is_(None),
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def set_categories(
        self, db: AsyncSession, org_id: UUID, vendor_id: UUID, category_ids: List[UUID]
    ) -> List[VendorCategoryMapping]:
        # Soft delete existing
        now = datetime.now(timezone.utc)
        stmt_existing = select(VendorCategoryMapping).where(
            VendorCategoryMapping.vendor_id == vendor_id,
            VendorCategoryMapping.deleted_at.is_(None),
        )
        existing = (await db.execute(stmt_existing)).scalars().all()
        existing_cat_ids = set()
        for m in existing:
            if m.category_id not in category_ids:
                m.deleted_at = now
            else:
                existing_cat_ids.add(m.category_id)

        new_mappings = []
        for cat_id in category_ids:
            if cat_id not in existing_cat_ids:
                mapping = VendorCategoryMapping(
                    org_id=org_id,
                    vendor_id=vendor_id,
                    category_id=cat_id,
                    is_qualified=False,
                )
                db.add(mapping)
                new_mappings.append(mapping)
        await db.flush()
        return await self.get_categories(db, vendor_id)

    async def get_contacts(
        self, db: AsyncSession, vendor_id: UUID
    ) -> List[VendorContact]:
        stmt = select(VendorContact).where(
            VendorContact.vendor_id == vendor_id,
            VendorContact.deleted_at.is_(None),
        ).order_by(desc(VendorContact.is_primary), VendorContact.created_at.asc())
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def create_contact(
        self, db: AsyncSession, org_id: UUID, vendor_id: UUID, data: dict
    ) -> VendorContact:
        contact = VendorContact(
            org_id=org_id,
            vendor_id=vendor_id,
            name=data["name"],
            designation=data.get("designation"),
            email=data["email"],
            phone=data.get("phone"),
            is_primary=data.get("is_primary", False),
            is_active=True,
        )
        db.add(contact)
        await db.flush()
        return contact

    async def get_bank_accounts(
        self, db: AsyncSession, vendor_id: UUID
    ) -> List[VendorBankAccount]:
        stmt = select(VendorBankAccount).where(
            VendorBankAccount.vendor_id == vendor_id,
            VendorBankAccount.deleted_at.is_(None),
        ).order_by(desc(VendorBankAccount.is_primary), VendorBankAccount.created_at.asc())
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_bank_account(
        self, db: AsyncSession, bank_id: UUID, vendor_id: UUID
    ) -> Optional[VendorBankAccount]:
        stmt = select(VendorBankAccount).where(
            VendorBankAccount.id == bank_id,
            VendorBankAccount.vendor_id == vendor_id,
            VendorBankAccount.deleted_at.is_(None),
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_bank_account(
        self, db: AsyncSession, org_id: UUID, vendor_id: UUID, data: dict
    ) -> VendorBankAccount:
        bank = VendorBankAccount(
            org_id=org_id,
            vendor_id=vendor_id,
            account_holder_name=data.get("account_holder_name", ""),
            bank_name=data["bank_name"],
            branch_name=data.get("branch_name"),
            account_number_encrypted=data["account_number_encrypted"],
            ifsc_code=data["ifsc_code"],
            swift_code=data.get("swift_code"),
            is_primary=data.get("is_primary", False),
            penny_test_status=data.get("penny_test_status", "NOT_INITIATED"),
            penny_test_reference=data.get("penny_test_reference"),
        )
        db.add(bank)
        await db.flush()
        return bank

    async def get_documents(
        self, db: AsyncSession, vendor_id: UUID
    ) -> List[VendorDocument]:
        stmt = select(VendorDocument).where(
            VendorDocument.vendor_id == vendor_id,
            VendorDocument.deleted_at.is_(None),
        ).order_by(VendorDocument.created_at.desc())
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def create_document(
        self, db: AsyncSession, org_id: UUID, vendor_id: UUID, data: dict
    ) -> VendorDocument:
        doc = VendorDocument(
            org_id=org_id,
            vendor_id=vendor_id,
            document_id=data["document_id"],
            document_type_id=data["document_type_id"],
            expiry_date=data.get("expiry_date"),
            verification_notes=data.get("verification_notes"),
            verification_status="PENDING",
        )
        db.add(doc)
        await db.flush()
        return doc

    async def get_expiring_documents(
        self, db: AsyncSession, check_date: date
    ) -> List[VendorDocument]:
        stmt = select(VendorDocument).where(
            VendorDocument.expiry_date.is_not(None),
            VendorDocument.expiry_date <= check_date,
            VendorDocument.deleted_at.is_(None),
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_latest_scorecard(
        self, db: AsyncSession, vendor_id: UUID
    ) -> Optional[VendorScorecard]:
        stmt = (
            select(VendorScorecard)
            .where(VendorScorecard.vendor_id == vendor_id)
            .order_by(VendorScorecard.calculated_at.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_scorecard(
        self, db: AsyncSession, org_id: UUID, vendor_id: UUID, data: dict
    ) -> VendorScorecard:
        scorecard = VendorScorecard(
            org_id=org_id,
            vendor_id=vendor_id,
            period_start=data.get("period_start", date.today()),
            period_end=data.get("period_end", date.today()),
            on_time_delivery_rate=data.get("on_time_delivery_rate", 0),
            quality_acceptance_rate=data.get("quality_acceptance_rate", 0),
            commercial_compliance_score=data.get("commercial_compliance_score", 0),
            responsiveness_score=data.get("responsiveness_score", 0),
            overall_score=data.get("overall_score", 0),
        )
        db.add(scorecard)
        await db.flush()
        return scorecard

    async def get_risk_assessment(
        self, db: AsyncSession, vendor_id: UUID, org_id: UUID
    ) -> Optional[VendorRiskAssessment]:
        stmt = (
            select(VendorRiskAssessment)
            .where(
                VendorRiskAssessment.vendor_id == vendor_id,
                VendorRiskAssessment.org_id == org_id,
                VendorRiskAssessment.deleted_at.is_(None),
            )
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def upsert_risk_assessment(
        self,
        db: AsyncSession,
        org_id: UUID,
        vendor_id: UUID,
        data: dict,
        assessed_by: Optional[UUID] = None,
    ) -> VendorRiskAssessment:
        existing = await self.get_risk_assessment(db, vendor_id, org_id)
        if existing:
            for key, val in data.items():
                if val is not None and hasattr(existing, key):
                    setattr(existing, key, val)
            if assessed_by:
                existing.assessed_by = assessed_by
            existing.last_assessed_at = datetime.now(timezone.utc)
            await db.flush()
            return existing

        assessment = VendorRiskAssessment(
            org_id=org_id,
            vendor_id=vendor_id,
            financial_risk_score=data.get("financial_risk_score", Decimal("0.0")),
            credit_rating=data.get("credit_rating", "UNRATED"),
            financial_stability_score=data.get("financial_stability_score", Decimal("0.0")),
            liquidity_risk=data.get("liquidity_risk", "LOW"),
            bankruptcy_risk=data.get("bankruptcy_risk", "LOW"),
            debt_to_equity_ratio=data.get("debt_to_equity_ratio"),
            esg_risk_score=data.get("esg_risk_score", Decimal("0.0")),
            environmental_score=data.get("environmental_score", Decimal("0.0")),
            social_score=data.get("social_score", Decimal("0.0")),
            governance_score=data.get("governance_score", Decimal("0.0")),
            esg_rating=data.get("esg_rating", "NOT_ASSESSED"),
            overall_risk_score=data.get("overall_risk_score", Decimal("0.0")),
            risk_tier=data.get("risk_tier", "LOW"),
            risk_factors=data.get("risk_factors", []),
            mitigation_actions=data.get("mitigation_actions", []),
            last_assessed_at=datetime.now(timezone.utc),
            assessed_by=assessed_by,
        )
        db.add(assessment)
        await db.flush()
        return assessment

    async def list_risk_assessments(
        self, db: AsyncSession, org_id: UUID
    ) -> List[Tuple[VendorRiskAssessment, Vendor]]:
        stmt = (
            select(VendorRiskAssessment, Vendor)
            .join(Vendor, Vendor.id == VendorRiskAssessment.vendor_id)
            .where(
                VendorRiskAssessment.org_id == org_id,
                VendorRiskAssessment.deleted_at.is_(None),
                Vendor.deleted_at.is_(None),
            )
            .order_by(VendorRiskAssessment.overall_risk_score.desc())
        )
        res = await db.execute(stmt)
        return list(res.all())


vendor_repository = VendorRepository()
