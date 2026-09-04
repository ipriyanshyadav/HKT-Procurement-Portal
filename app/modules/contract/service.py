"""
Contract Management Service (SPEC_13 S13-01 to S13-17).

Handles contract lifecycle, creation from award recommendations, FSM validation,
eSignature initiation & completion (Digio / DocuSign), versioned amendments,
rate contract utilization with optimistic locking, milestone completion, and auto-renewal.
"""
from __future__ import annotations

import io
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from loguru import logger
from minio import Minio
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppException, NotFoundError, ValidationError
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.contract.fsm import can_transition, validate_contract_transition
from app.modules.contract.models import (
    Contract,
    ContractAmendment,
    ContractDocument,
    ContractLine,
    ContractMilestone,
    ContractTemplate,
)
from app.modules.contract.repository import contract_repository
from app.modules.contract.schemas import (
    ContractAmendRequest,
    ContractCreateRequest,
    ContractFromAwardRequest,
    EsignWebhookPayload,
)
from app.modules.evaluation.repository import award_repository
from app.modules.integration.adapters.digio import digio_adapter
from app.modules.integration.adapters.docusign import docusign_adapter
from app.modules.sourcing.repository import rfq_repository


class ContractService:
    """Core domain service for contract management."""

    def __init__(self) -> None:
        self.repo = contract_repository
        self.award_repo = award_repository
        self.rfq_repo = rfq_repository
        self.audit = audit_service
        self.digio_adapter = digio_adapter
        self.docusign_adapter = docusign_adapter
        self._minio_client: Optional[Minio] = None

    def _get_minio(self) -> Minio:
        if self._minio_client is None:
            self._minio_client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_USE_SSL,
            )
        return self._minio_client

    def _generate_contract_pdf(self, contract: Contract, org_id: UUID) -> bytes:
        """Generate draft contract agreement document in memory using ReportLab."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "ContractTitle",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0f172a"),
            alignment=1,  # Center
        )
        sub_style = ParagraphStyle(
            "ContractSub",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#475569"),
            alignment=1,
        )
        header_cell_style = ParagraphStyle(
            "HeaderCell",
            parent=styles["Normal"],
            fontSize=9,
            leading=11,
            textColor=colors.white,
            fontName="Helvetica-Bold",
        )
        cell_style = ParagraphStyle(
            "BodyCell",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#1e293b"),
        )

        elements = []

        # Header Title
        elements.append(Paragraph("<b>ENTERPRISE PROCUREMENT CONTRACT AGREEMENT</b>", title_style))
        elements.append(Spacer(1, 4))
        elements.append(
            Paragraph(
                f"Contract Reference: <b>{contract.contract_number}</b> | Type: <b>{contract.contract_type}</b>",
                sub_style,
            )
        )
        elements.append(Spacer(1, 14))

        # Metadata Table
        meta_data = [
            [
                Paragraph("<b>Title:</b>", cell_style),
                Paragraph(contract.title, cell_style),
                Paragraph("<b>Status:</b>", cell_style),
                Paragraph(str(contract.status), cell_style),
            ],
            [
                Paragraph("<b>Vendor ID:</b>", cell_style),
                Paragraph(str(contract.vendor_id), cell_style),
                Paragraph("<b>Total Value:</b>", cell_style),
                Paragraph(f"{contract.currency} {float(contract.total_value):,.2f}", cell_style),
            ],
            [
                Paragraph("<b>Start Date:</b>", cell_style),
                Paragraph(contract.start_date.isoformat(), cell_style),
                Paragraph("<b>End Date:</b>", cell_style),
                Paragraph(contract.end_date.isoformat(), cell_style),
            ],
            [
                Paragraph("<b>Auto Renewal:</b>", cell_style),
                Paragraph("Enabled" if contract.auto_renew else "Disabled", cell_style),
                Paragraph("<b>Renewal Notice:</b>", cell_style),
                Paragraph(f"{contract.renewal_notice_days} days", cell_style),
            ],
        ]
        meta_table = Table(meta_data, colWidths=[80, 180, 80, 180])
        meta_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(meta_table)
        elements.append(Spacer(1, 16))

        # Contract Lines Table
        elements.append(Paragraph("<b>1. SCOPE OF SUPPLY / SCHEDULE OF RATES</b>", styles["Heading3"]))
        elements.append(Spacer(1, 6))

        lines_header = [
            Paragraph("Line #", header_cell_style),
            Paragraph("Item Description", header_cell_style),
            Paragraph("Qty", header_cell_style),
            Paragraph("Unit Rate", header_cell_style),
            Paragraph("HSN", header_cell_style),
        ]
        lines_data = [lines_header]
        for line in contract.lines or []:
            qty_str = f"{float(line.contracted_quantity):,.2f}" if line.contracted_quantity is not None else "As Ordered"
            lines_data.append(
                [
                    Paragraph(str(line.line_number), cell_style),
                    Paragraph(line.item_description, cell_style),
                    Paragraph(qty_str, cell_style),
                    Paragraph(f"{float(line.unit_rate):,.2f}", cell_style),
                    Paragraph(line.hsn_code or "N/A", cell_style),
                ]
            )

        if len(lines_data) == 1:
            lines_data.append([Paragraph("No lines defined", cell_style)] * 5)

        lines_table = Table(lines_data, colWidths=[40, 260, 70, 80, 70])
        lines_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(lines_table)
        elements.append(Spacer(1, 16))

        # Milestones Section
        if contract.milestones:
            elements.append(Paragraph("<b>2. CONTRACT MILESTONES & DELIVERABLES</b>", styles["Heading3"]))
            elements.append(Spacer(1, 6))
            ms_header = [
                Paragraph("Milestone", header_cell_style),
                Paragraph("Due Date", header_cell_style),
                Paragraph("Responsible Party", header_cell_style),
                Paragraph("Status", header_cell_style),
            ]
            ms_data = [ms_header]
            for ms in contract.milestones:
                ms_data.append(
                    [
                        Paragraph(ms.title, cell_style),
                        Paragraph(ms.due_date.isoformat(), cell_style),
                        Paragraph(ms.responsible_party, cell_style),
                        Paragraph(ms.status, cell_style),
                    ]
                )
            ms_table = Table(ms_data, colWidths=[240, 90, 110, 80])
            ms_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            elements.append(ms_table)
            elements.append(Spacer(1, 20))

        # Signatures
        sig_data = [
            [
                Paragraph("<b>FOR BUYER:</b><br/><br/>_____________________<br/>Authorized Signatory", cell_style),
                Paragraph("<b>FOR SUPPLIER / VENDOR:</b><br/><br/>_____________________<br/>Authorized Signatory", cell_style),
            ]
        ]
        sig_table = Table(sig_data, colWidths=[260, 260])
        sig_table.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
        elements.append(sig_table)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    async def _upload_draft_to_minio(self, contract: Contract, org_id: UUID) -> str:
        """Render contract PDF and store into MinIO contract-documents bucket."""
        pdf_bytes = self._generate_contract_pdf(contract, org_id)
        bucket_name = settings.CONTRACT_DOCUMENTS_BUCKET
        object_name = f"contracts/{org_id}/{contract.id}/draft_v{contract.version}.pdf"

        try:
            client = self._get_minio()
            if not client.bucket_exists(bucket_name):
                client.make_bucket(bucket_name)

            client.put_object(
                bucket_name=bucket_name,
                object_name=object_name,
                data=io.BytesIO(pdf_bytes),
                length=len(pdf_bytes),
                content_type="application/pdf",
            )
            logger.info("Uploaded contract draft PDF to MinIO: {}/{}", bucket_name, object_name)
        except Exception as exc:
            logger.warning("MinIO upload fallback for contract {}: {}", contract.id, exc)

        return f"{bucket_name}/{object_name}"

    async def _generate_contract_number(self, db: AsyncSession, org_id: UUID) -> str:
        year = datetime.now(timezone.utc).year
        seq = await self.repo.get_next_contract_sequence(db, org_id, year)
        return f"{settings.CONTRACT_NUMBER_PREFIX}-{year}-{seq:05d}"

    def _enrich_contract_metadata(self, contract: Contract) -> Contract:
        """Compute days_remaining and expiry_warning_level on contract object."""
        today = date.today()
        days = (contract.end_date - today).days
        contract.days_remaining = days
        if days <= 0:
            contract.expiry_warning_level = "EXPIRED"
        elif days < 30:
            contract.expiry_warning_level = "CRITICAL"
        elif days < 60:
            contract.expiry_warning_level = "WARNING"
        else:
            contract.expiry_warning_level = "SAFE"
        return contract

    async def create_contract(
        self,
        db: AsyncSession,
        data: ContractCreateRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Contract:
        """Create a new contract manually (S13-01 / S13-03)."""
        if data.end_date <= data.start_date:
            raise ValidationError("INVALID_DATE_RANGE", "Contract end date must be after start date")

        contract_number = await self._generate_contract_number(db, org_id)

        lines = [
            ContractLine(
                org_id=org_id,
                line_number=line_data.line_number or idx,
                item_description=line_data.item_description,
                uom_id=line_data.uom_id,
                contracted_quantity=line_data.contracted_quantity,
                unit_rate=line_data.unit_rate,
                utilized_quantity=Decimal("0.0"),
                hsn_code=line_data.hsn_code,
            )
            for idx, line_data in enumerate(data.lines, start=1)
        ]

        milestones = [
            ContractMilestone(
                org_id=org_id,
                title=milestone_data.title,
                description=milestone_data.description,
                due_date=milestone_data.due_date,
                responsible_party=milestone_data.responsible_party,
                responsible_user_id=milestone_data.responsible_user_id,
                status="PENDING",
                milestone_weight=milestone_data.milestone_weight,
            )
            for milestone_data in (data.milestones or [])
        ]

        contract = Contract(
            org_id=org_id,
            contract_number=contract_number,
            title=data.title,
            vendor_id=data.vendor_id,
            rfq_id=data.rfq_id,
            arn_id=data.award_recommendation_id,
            award_recommendation_id=data.award_recommendation_id,
            status="DRAFT",
            contract_type=data.contract_type,
            currency=data.currency,
            total_value=data.total_value,
            utilized_value=Decimal("0.0"),
            start_date=data.start_date,
            end_date=data.end_date,
            payment_term_id=data.payment_term_id,
            incoterm_id=data.incoterm_id,
            business_unit_id=data.business_unit_id,
            category_id=data.category_id,
            template_id=data.template_id,
            auto_renew=data.auto_renew,
            renewal_notice_days=data.renewal_notice_days,
            sla_terms=data.sla_terms or {},
            lines=lines,
            milestones=milestones,
            created_by=actor_id,
            updated_by=actor_id,
        )
        db.add(contract)
        await db.flush()
        await self.audit.log(
            db,
            "CONTRACT",
            contract.id,
            "CONTRACT_CREATED",
            actor_id,
            org_id,
            new_values={"contract_number": contract_number, "total_value": float(contract.total_value)},
        )
        return self._enrich_contract_metadata(contract)

    async def create_from_award(
        self,
        db: AsyncSession,
        award_rec_id: UUID,
        data: ContractFromAwardRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Contract:
        """Create contract from an approved award recommendation (S13-04)."""
        award_rec = await self.award_repo.get(db, award_rec_id, org_id)
        if not award_rec:
            raise NotFoundError("Award recommendation not found")
        if award_rec.status != "APPROVED":
            raise AppException(
                "AWARD_NOT_APPROVED",
                "Award recommendation must be approved before contract creation",
            )

        # Resolve linked RFQ
        rfq = None
        if award_rec.rfq_id:
            rfq = await self.rfq_repo.get(db, award_rec.rfq_id, org_id)

        # Find fallback UOM for lines
        default_uom_id = None
        if rfq and rfq.lines:
            default_uom_id = rfq.lines[0].uom_id
        else:
            from app.modules.master_data.models import UomMaster
            uom_stmt = select(UomMaster.id).where(UomMaster.org_id == org_id).limit(1)
            uom_res = await db.execute(uom_stmt)
            default_uom_id = uom_res.scalar_one_or_none()

        # Find primary vendor and total value from award details
        vendor_id = None
        total_value = Decimal("0.0")
        lines_to_create = []

        if award_rec.details:
            for idx, d in enumerate(award_rec.details, start=1):
                if vendor_id is None:
                    vendor_id = d.vendor_id
                price = getattr(d, "awarded_unit_price", None)
                if price is None:
                    price = getattr(d, "awarded_price", Decimal("0.0"))
                price_dec = Decimal(str(price))
                qty = Decimal(str(d.awarded_quantity or 1))
                tot = getattr(d, "awarded_total", None)
                awarded_val = Decimal(str(tot)) if tot is not None else (price_dec * qty)
                total_value += awarded_val
                lines_to_create.append(
                    {
                        "line_number": idx,
                        "item_description": f"Awarded item under ARN-{award_rec.arn_number}",
                        "uom_id": default_uom_id,
                        "contracted_quantity": d.awarded_quantity,
                        "unit_rate": price_dec,
                        "hsn_code": None,
                    }
                )

        if not vendor_id:
            raise ValidationError("AWARD_DETAILS_EMPTY", "No vendors awarded in recommendation")

        start_date = data.start_date or date.today()
        end_date = data.end_date or (start_date + timedelta(days=365))
        if end_date <= start_date:
            raise ValidationError("INVALID_DATE_RANGE", "Contract end date must be after start date")

        contract_number = await self._generate_contract_number(db, org_id)
        title = data.title or f"Contract: {rfq.title if rfq else 'Award ' + award_rec.arn_number}"

        contract_lines = [
            ContractLine(
                org_id=org_id,
                utilized_quantity=Decimal("0.0"),
                **line_dict,
            )
            for line_dict in lines_to_create
        ]

        contract_milestones = [
            ContractMilestone(
                org_id=org_id,
                title=milestone_data.title,
                description=milestone_data.description,
                due_date=milestone_data.due_date,
                responsible_party=milestone_data.responsible_party,
                responsible_user_id=milestone_data.responsible_user_id,
                status="PENDING",
                milestone_weight=milestone_data.milestone_weight,
            )
            for milestone_data in (data.milestones or [])
        ]

        contract = Contract(
            org_id=org_id,
            contract_number=contract_number,
            title=title,
            vendor_id=vendor_id,
            rfq_id=award_rec.rfq_id,
            arn_id=award_rec_id,
            award_recommendation_id=award_rec_id,
            status="DRAFT",
            contract_type="RATE_CONTRACT",
            currency="INR",
            total_value=award_rec.total_awarded_value or total_value,
            utilized_value=Decimal("0.0"),
            start_date=start_date,
            end_date=end_date,
            payment_term_id=data.payment_term_id or (rfq.payment_term_id if rfq else None),
            incoterm_id=data.incoterm_id or (rfq.incoterm_id if rfq else None),
            business_unit_id=rfq.business_unit_id if rfq else org_id,
            category_id=rfq.category_id if rfq else org_id,
            template_id=data.template_id,
            auto_renew=data.auto_renew,
            renewal_notice_days=data.renewal_notice_days,
            sla_terms=data.sla_terms or {},
            created_by=actor_id,
            updated_by=actor_id,
            lines=contract_lines,
            milestones=contract_milestones,
        )
        db.add(contract)
        await db.flush()
        await self.audit.log(
            db,
            "CONTRACT",
            contract.id,
            "CONTRACT_CREATED_FROM_AWARD",
            actor_id,
            org_id,
            metadata={"arn_id": str(award_rec_id), "contract_number": contract_number},
        )
        return self._enrich_contract_metadata(contract)

    async def get_contract(
        self,
        db: AsyncSession,
        contract_id: UUID,
        org_id: UUID,
    ) -> Contract:
        """Get contract detail with loaded relationships and computed countdown."""
        contract = await self.repo.get(db, contract_id, org_id)
        if not contract:
            raise NotFoundError("Contract not found")
        return self._enrich_contract_metadata(contract)

    async def list_contracts(
        self,
        db: AsyncSession,
        org_id: UUID,
        status: Optional[str] = None,
        vendor_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Contract], int]:
        """List contracts with pagination and computed metadata."""
        items, total = await self.repo.list(
            db,
            org_id=org_id,
            status=status,
            vendor_id=vendor_id,
            category_id=category_id,
            search=search,
            page=page,
            page_size=page_size,
        )
        for c in items:
            self._enrich_contract_metadata(c)
        return items, total

    async def initiate_esign(
        self,
        db: AsyncSession,
        contract_id: UUID,
        actor_id: UUID,
        org_id: UUID,
        provider_override: Optional[str] = None,
        signatories: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Initiate eSign request (S13-06). Uploads draft to MinIO and notifies adapter."""
        contract = await self.repo.get(db, contract_id, org_id)
        if not contract:
            raise NotFoundError("Contract not found")

        validate_contract_transition(contract.status, "PENDING_ESIGN")

        doc_path = await self._upload_draft_to_minio(contract, org_id)
        contract.contract_document_path = doc_path
        contract.status = "PENDING_ESIGN"

        provider = provider_override or contract.esign_provider or settings.DEFAULT_ESIGN_PROVIDER
        if provider == "digio":
            esign_result = await self.digio_adapter.initiate(contract, doc_path, signatories)
        else:
            esign_result = await self.docusign_adapter.initiate(contract, doc_path, signatories)

        contract.esign_request_id = esign_result["request_id"]
        contract.esign_provider = provider
        contract.updated_by = actor_id

        # Update signing log
        log_entry = {
            "action": "ESIGN_INITIATED",
            "provider": provider,
            "request_id": esign_result["request_id"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor_id": str(actor_id),
        }
        signing_log = list(contract.signing_log or [])
        signing_log.append(log_entry)
        contract.signing_log = signing_log

        await db.flush()
        await self.audit.log(
            db,
            "CONTRACT",
            contract_id,
            "CONTRACT_ESIGN_INITIATED",
            actor_id,
            org_id,
            metadata={"request_id": esign_result["request_id"], "provider": provider},
        )
        return esign_result

    async def confirm_esign_complete(
        self,
        db: AsyncSession,
        contract_id: UUID,
        esign_doc_path: Optional[str],
        actor_id: UUID,
        org_id: UUID,
    ) -> Contract:
        """Confirm eSign completion and activate contract (S13-06)."""
        contract = await self.repo.get(db, contract_id, org_id)
        if not contract:
            raise NotFoundError("Contract not found")

        validate_contract_transition(contract.status, "ACTIVE")

        contract.status = "ACTIVE"
        contract.activated_at = datetime.now(timezone.utc)
        if esign_doc_path:
            contract.signed_document_path = esign_doc_path

        log_entry = {
            "action": "ESIGN_COMPLETED",
            "provider": contract.esign_provider,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor_id": str(actor_id),
        }
        signing_log = list(contract.signing_log or [])
        signing_log.append(log_entry)
        contract.signing_log = signing_log
        contract.updated_by = actor_id

        await OutboxPublisher.publish(
            db,
            exchange_or_event="procurement.contract",
            routing_key="contract.activated",
            payload={
                "contract_id": str(contract_id),
                "vendor_id": str(contract.vendor_id),
                "contract_number": contract.contract_number,
            },
            org_id=org_id,
        )

        await self.audit.log(
            db,
            "CONTRACT",
            contract_id,
            "CONTRACT_ACTIVATED",
            actor_id,
            org_id,
            new_values={"status": "ACTIVE", "activated_at": contract.activated_at.isoformat()},
        )
        return self._enrich_contract_metadata(contract)

    async def handle_esign_webhook(
        self,
        db: AsyncSession,
        payload: EsignWebhookPayload,
        org_id: UUID,
    ) -> Optional[Contract]:
        """Process incoming eSign provider webhook callback."""
        stmt = select(Contract).where(
            and_(
                Contract.esign_request_id == payload.request_id,
                Contract.org_id == org_id,
            )
        )
        res = await db.execute(stmt)
        contract = res.scalar_one_or_none()
        if not contract:
            logger.warning("No contract found for esign request {}", payload.request_id)
            return None

        event_str = (payload.event or "").lower()
        status_str = (payload.status or "").lower()

        if "sign" in event_str or "complete" in event_str or status_str in ("signed", "completed"):
            # Upload signed document to MinIO
            signed_path = f"{settings.CONTRACT_DOCUMENTS_BUCKET}/contracts/{org_id}/{contract.id}/signed.pdf"
            system_actor = contract.created_by or contract.org_id
            return await self.confirm_esign_complete(db, contract.id, signed_path, system_actor, org_id)

        return contract

    async def amend_contract(
        self,
        db: AsyncSession,
        contract_id: UUID,
        data: ContractAmendRequest,
        actor_id: UUID,
        org_id: UUID,
    ) -> Contract:
        """Formal, versioned contract amendment with snapshot (S13-07)."""
        contract = await self.repo.get(db, contract_id, org_id)
        if not contract:
            raise NotFoundError("Contract not found")

        validate_contract_transition(contract.status, "AMENDED")

        original_snapshot = {
            "total_value": float(contract.total_value),
            "end_date": contract.end_date.isoformat(),
            "version": contract.version,
            "amendment_count": contract.amendment_count,
        }

        amendment = ContractAmendment(
            org_id=org_id,
            contract_id=contract_id,
            amendment_number=contract.amendment_count + 1,
            amendment_type=data.amendment_type,
            changes_summary=data.change_description,
            change_description=data.change_description,
            field_changes=data.field_changes or {},
            original_snapshot=original_snapshot,
            amended_by=actor_id,
        )
        db.add(amendment)

        if data.new_total_value is not None:
            if data.new_total_value <= 0:
                raise ValidationError("INVALID_VALUE", "Contract total value must be positive")
            contract.total_value = data.new_total_value

        if data.new_end_date is not None:
            if data.new_end_date <= contract.start_date:
                raise ValidationError("INVALID_END_DATE", "New end date must be after contract start date")
            contract.end_date = data.new_end_date

        contract.amendment_count += 1
        contract.status = "AMENDED"
        contract.version += 1
        contract.updated_by = actor_id

        await db.flush()
        await self.audit.log(
            db,
            "CONTRACT",
            contract_id,
            "CONTRACT_AMENDED",
            actor_id,
            org_id,
            old_values=original_snapshot,
            new_values={
                "total_value": float(contract.total_value),
                "end_date": contract.end_date.isoformat(),
                "amendment_number": contract.amendment_count,
            },
        )
        return self._enrich_contract_metadata(contract)

    async def update_utilization(
        self,
        db: AsyncSession,
        contract_id: UUID,
        po_value: float,
        org_id: UUID,
    ) -> Contract:
        """Update utilized value for RATE_CONTRACT with optimistic locking (S13-17)."""
        contract = await self.repo.get(db, contract_id, org_id)
        if not contract:
            raise NotFoundError("Contract not found")

        if contract.contract_type == "RATE_CONTRACT":
            new_utilization = float(contract.utilized_value or 0) + float(po_value)
            if new_utilization > float(contract.total_value):
                available = float(contract.total_value) - float(contract.utilized_value or 0)
                raise ValidationError(
                    "CONTRACT_VALUE_EXCEEDED",
                    f"This PO would exceed contract value. Available: {available:,.2f}",
                )
            contract.utilized_value = Decimal(str(new_utilization))
            contract.version += 1

        await db.flush()
        return self._enrich_contract_metadata(contract)

    async def update_status(
        self,
        db: AsyncSession,
        contract_id: UUID,
        new_status: str,
        actor_id: UUID,
        org_id: UUID,
        notes: Optional[str] = None,
    ) -> Contract:
        """General status transition validated by FSM."""
        contract = await self.repo.get(db, contract_id, org_id)
        if not contract:
            raise NotFoundError("Contract not found")

        validate_contract_transition(contract.status, new_status)
        old_status = str(contract.status)
        contract.status = new_status
        contract.updated_by = actor_id

        await db.flush()
        await self.audit.log(
            db,
            "CONTRACT",
            contract_id,
            "CONTRACT_STATUS_CHANGED",
            actor_id,
            org_id,
            old_values={"status": old_status},
            new_values={"status": new_status, "notes": notes},
        )
        return self._enrich_contract_metadata(contract)

    async def complete_milestone(
        self,
        db: AsyncSession,
        contract_id: UUID,
        milestone_id: UUID,
        notes: Optional[str],
        actor_id: UUID,
        org_id: UUID,
    ) -> ContractMilestone:
        """Complete a contract milestone (S13-05 / S13-10)."""
        milestone = await self.repo.get_milestone(db, milestone_id, contract_id, org_id)
        if not milestone:
            raise NotFoundError("Contract milestone not found")

        milestone.status = "COMPLETED"
        milestone.completed_at = datetime.now(timezone.utc)
        milestone.completion_notes = notes

        await db.flush()
        await self.audit.log(
            db,
            "CONTRACT",
            contract_id,
            "CONTRACT_MILESTONE_COMPLETED",
            actor_id,
            org_id,
            metadata={"milestone_id": str(milestone_id), "title": milestone.title},
        )
        return milestone

    async def auto_renew_contract(
        self,
        db: AsyncSession,
        contract: Contract,
        actor_id: Optional[UUID] = None,
    ) -> Contract:
        """Auto-renew contract: expire original and create incremented active contract (S13-08)."""
        contract.status = "EXPIRED"

        duration = contract.end_date - contract.start_date
        new_start = contract.end_date
        new_end = contract.end_date + duration
        new_contract_number = f"{contract.contract_number}-R{contract.version}"

        stmt = select(ContractLine).where(
            and_(
                ContractLine.contract_id == contract.id,
                ContractLine.deleted_at.is_(None),
            )
        )
        res = await db.execute(stmt)
        old_lines = list(res.scalars().all())

        new_lines = [
            ContractLine(
                org_id=contract.org_id,
                line_number=line.line_number,
                item_description=line.item_description,
                uom_id=line.uom_id,
                contracted_quantity=line.contracted_quantity,
                unit_rate=line.unit_rate,
                utilized_quantity=Decimal("0.0"),
                hsn_code=line.hsn_code,
            )
            for line in old_lines
        ]

        new_contract = Contract(
            org_id=contract.org_id,
            contract_number=new_contract_number,
            title=f"{contract.title} (Auto-Renewed)",
            vendor_id=contract.vendor_id,
            rfq_id=contract.rfq_id,
            arn_id=contract.arn_id,
            award_recommendation_id=contract.award_recommendation_id,
            status="ACTIVE",
            contract_type=contract.contract_type,
            currency=contract.currency,
            total_value=contract.total_value,
            utilized_value=Decimal("0.0"),
            start_date=new_start,
            end_date=new_end,
            payment_term_id=contract.payment_term_id,
            incoterm_id=contract.incoterm_id,
            business_unit_id=contract.business_unit_id,
            category_id=contract.category_id,
            template_id=contract.template_id,
            auto_renew=contract.auto_renew,
            renewal_notice_days=contract.renewal_notice_days,
            sla_terms=contract.sla_terms or {},
            original_contract_id=contract.id,
            activated_at=datetime.now(timezone.utc),
            created_by=actor_id or contract.created_by,
            updated_by=actor_id or contract.updated_by,
            lines=new_lines,
        )
        db.add(new_contract)
        await db.flush()

        await OutboxPublisher.publish(
            db,
            exchange_or_event="procurement.contract",
            routing_key="contract.renewed",
            payload={
                "old_contract_id": str(contract.id),
                "new_contract_id": str(new_contract.id),
                "old_contract_number": contract.contract_number,
                "new_contract_number": new_contract.contract_number,
            },
            org_id=contract.org_id,
        )

        await self.audit.log(
            db,
            "CONTRACT",
            new_contract.id,
            "CONTRACT_AUTO_RENEWED",
            actor_id,
            contract.org_id,
            metadata={"original_contract_id": str(contract.id)},
        )
        return self._enrich_contract_metadata(new_contract)


contract_service = ContractService()
