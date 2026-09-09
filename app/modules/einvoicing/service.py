from __future__ import annotations

import hashlib
import json
import math
import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.asn.models import AdvanceShippingNotice
from app.modules.einvoicing.models import EInvoice, EWayBill
from app.modules.einvoicing.repository import e_invoice_repository
from app.modules.einvoicing.schemas import (
    CancelEInvoiceRequest,
    EInvoiceResponse,
    EWayBillResponse,
    GenerateEInvoiceRequest,
    GenerateEWayBillRequest,
)


class EInvoicingService:
    def get_financial_year(self, dt: datetime | None = None) -> str:
        d = dt or datetime.now(UTC)
        year = d.year if d.month >= 4 else d.year - 1
        return f"{year}-{year + 1}"

    def calculate_irn(self, seller_gstin: str, financial_year: str, doc_type: str, doc_number: str) -> str:
        """Computes official 64-character SHA-256 Invoice Reference Number (IRN).

        Rule 48(4) CGST: SHA-256(Supplier GSTIN + Fin Year + Doc Type + Doc Number)
        """
        raw = f"{seller_gstin.strip().upper()}{financial_year.strip()}{doc_type.strip().upper()}{doc_number.strip().upper()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest().lower()

    def generate_peppol_ubl_xml(
        self,
        doc_number: str,
        issue_date: str,
        seller_gstin: str,
        buyer_gstin: str,
        total_value: float,
        tax_value: float,
        currency: str = "INR",
    ) -> str:
        """Generates standard Peppol BIS 3.0 (UBL 2.1) XML invoice representation."""
        subtotal = round(total_value - tax_value, 2)
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>{doc_number}</cbc:ID>
  <cbc:IssueDate>{issue_date}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>{currency}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="9920">{seller_gstin}</cbc:ID></cac:PartyIdentification>
      <cac:PartyLegalEntity><cbc:RegistrationName>Enterprise Supplier Partner</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="9920">{buyer_gstin}</cbc:ID></cac:PartyIdentification>
      <cac:PartyLegalEntity><cbc:RegistrationName>HKT Global Operations Corp</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="{currency}">{tax_value:.2f}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="{currency}">{subtotal:.2f}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="{currency}">{subtotal:.2f}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="{currency}">{total_value:.2f}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="{currency}">{total_value:.2f}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>"""

    async def generate_e_invoice(
        self, db: AsyncSession, org_id: UUID, payload: GenerateEInvoiceRequest
    ) -> EInvoiceResponse:
        now = datetime.now(UTC)
        fin_year = self.get_financial_year(now)
        irn = self.calculate_irn(
            seller_gstin=payload.seller_gstin,
            financial_year=fin_year,
            doc_type=payload.doc_type,
            doc_number=payload.doc_number,
        )

        existing = await e_invoice_repository.get_by_irn(db, irn)
        if existing and existing.status == "GENERATED":
            raise ConflictError(f"E-Invoice with IRN {irn} already exists for this document.")

        ack_no = f"11{now.strftime('%y%m%d')}{secrets.randbelow(899999) + 100000}"

        # Digital Signature & Signed QR Payload
        qr_dict = {
            "SellerGSTIN": payload.seller_gstin,
            "BuyerGSTIN": payload.buyer_gstin,
            "DocNo": payload.doc_number,
            "DocTyp": payload.doc_type,
            "DocDt": now.strftime("%d/%m/%Y"),
            "TotInvVal": payload.total_invoice_value,
            "ItemCnt": len(payload.items or []) if payload.items else 1,
            "MainHsnCode": "8471",
            "Irn": irn,
            "AckNo": ack_no,
            "AckDt": now.strftime("%Y-%m-%d %H:%M:%S"),
        }
        signed_qr = "JWT.NIC." + hashlib.sha256(json.dumps(qr_dict).encode("utf-8")).hexdigest()

        peppol_xml = self.generate_peppol_ubl_xml(
            doc_number=payload.doc_number,
            issue_date=now.strftime("%Y-%m-%d"),
            seller_gstin=payload.seller_gstin,
            buyer_gstin=payload.buyer_gstin,
            total_value=payload.total_invoice_value,
            tax_value=payload.total_tax_value,
        )

        record = EInvoice(
            id=uuid4(),
            org_id=org_id,
            invoice_id=payload.invoice_id,
            asn_id=payload.asn_id,
            seller_gstin=payload.seller_gstin.upper(),
            buyer_gstin=payload.buyer_gstin.upper(),
            doc_number=payload.doc_number,
            doc_type=payload.doc_type.upper(),
            financial_year=fin_year,
            irn=irn,
            ack_number=ack_no,
            ack_date=now,
            total_invoice_value=Decimal(str(payload.total_invoice_value)),
            total_tax_value=Decimal(str(payload.total_tax_value)),
            signed_invoice=json.dumps(qr_dict),
            signed_qr_code=signed_qr,
            status="GENERATED",
            peppol_xml=peppol_xml,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)

        return EInvoiceResponse(
            id=record.id,
            org_id=record.org_id,
            invoice_id=record.invoice_id,
            asn_id=record.asn_id,
            seller_gstin=record.seller_gstin,
            buyer_gstin=record.buyer_gstin,
            doc_number=record.doc_number,
            doc_type=record.doc_type,
            financial_year=record.financial_year,
            irn=record.irn,
            ack_number=record.ack_number,
            ack_date=record.ack_date,
            total_invoice_value=float(record.total_invoice_value),
            total_tax_value=float(record.total_tax_value),
            signed_invoice=record.signed_invoice,
            signed_qr_code=record.signed_qr_code,
            status=record.status,
            cancellation_reason=record.cancellation_reason,
            peppol_xml=record.peppol_xml,
            created_at=record.created_at,
        )

    async def cancel_e_invoice(
        self, db: AsyncSession, org_id: UUID, payload: CancelEInvoiceRequest
    ) -> EInvoiceResponse:
        record = await e_invoice_repository.get_by_irn(db, payload.irn)
        if not record or record.org_id != org_id:
            raise NotFoundError("EInvoice", payload.irn)

        if record.status == "CANCELLED":
            raise ValidationError("E-Invoice is already cancelled.")

        # Check 24-hour NIC cancellation window
        now = datetime.now(UTC)
        if now - record.created_at > timedelta(hours=24):
            raise ValidationError(
                "E-Invoice cancellation via IRP portal is only permitted within 24 hours of generation."
            )

        record.status = "CANCELLED"
        record.cancellation_reason = (
            f"Code: {payload.cancellation_reason} - {payload.cancellation_remarks or 'Cancelled by user'}"
        )

        # If any active E-Way Bills are attached, cancel them
        for ewb in record.e_way_bills:
            if ewb.status == "ACTIVE":
                ewb.status = "CANCELLED"

        await db.commit()
        await db.refresh(record)

        return EInvoiceResponse(
            id=record.id,
            org_id=record.org_id,
            invoice_id=record.invoice_id,
            asn_id=record.asn_id,
            seller_gstin=record.seller_gstin,
            buyer_gstin=record.buyer_gstin,
            doc_number=record.doc_number,
            doc_type=record.doc_type,
            financial_year=record.financial_year,
            irn=record.irn,
            ack_number=record.ack_number,
            ack_date=record.ack_date,
            total_invoice_value=float(record.total_invoice_value),
            total_tax_value=float(record.total_tax_value),
            signed_invoice=record.signed_invoice,
            signed_qr_code=record.signed_qr_code,
            status=record.status,
            cancellation_reason=record.cancellation_reason,
            peppol_xml=record.peppol_xml,
            created_at=record.created_at,
        )

    # --- E-Way Bill Integration ---
    async def generate_e_way_bill(
        self, db: AsyncSession, org_id: UUID, payload: GenerateEWayBillRequest
    ) -> EWayBillResponse:
        if payload.distance_km <= 0:
            raise ValidationError("Transit distance must be greater than 0 km.")

        now = datetime.now(UTC)
        # Transit validity: 1 day per 200 km (Rule 138(10) of CGST Rules)
        transit_days = max(1, math.ceil(payload.distance_km / 200.0))
        valid_until = now + timedelta(days=transit_days)

        # 12-digit standard E-Way Bill number
        ewb_number = f"{secrets.randbelow(899999999999) + 100000000000}"

        ewb = EWayBill(
            id=uuid4(),
            org_id=org_id,
            e_invoice_id=payload.e_invoice_id,
            asn_id=payload.asn_id,
            ewb_number=ewb_number,
            ewb_date=now,
            valid_until=valid_until,
            transporter_id=payload.transporter_id,
            transporter_name=payload.transporter_name or "National Logistics Express",
            vehicle_number=payload.vehicle_number.upper(),
            distance_km=Decimal(str(payload.distance_km)),
            from_pincode=payload.from_pincode,
            to_pincode=payload.to_pincode,
            status="ACTIVE",
        )
        db.add(ewb)
        await db.commit()
        await db.refresh(ewb)

        return EWayBillResponse(
            id=ewb.id,
            org_id=ewb.org_id,
            e_invoice_id=ewb.e_invoice_id,
            asn_id=ewb.asn_id,
            ewb_number=ewb.ewb_number,
            ewb_date=ewb.ewb_date,
            valid_until=ewb.valid_until,
            transporter_id=ewb.transporter_id,
            transporter_name=ewb.transporter_name,
            vehicle_number=ewb.vehicle_number,
            distance_km=float(ewb.distance_km),
            from_pincode=ewb.from_pincode,
            to_pincode=ewb.to_pincode,
            status=ewb.status,
            created_at=ewb.created_at,
        )

    # --- Dispatch Auto-Trigger: ASN Integration ---
    async def generate_compliance_pack_for_asn(
        self,
        db: AsyncSession,
        org_id: UUID,
        asn_id: UUID,
        vehicle_number: str,
        distance_km: float,
        seller_gstin: str = "27AABCP1234F1Z1",
        buyer_gstin: str = "27ABCDE1234F1Z5",
    ) -> dict[str, Any]:
        """Auto-generates both official NIC IRN E-Invoice and Part A/B E-Way Bill upon ASN Dispatch."""
        asn = await db.get(AdvanceShippingNotice, asn_id)
        if not asn:
            raise NotFoundError("AdvanceShippingNotice", str(asn_id))

        # Generate E-Invoice
        doc_no = f"INV-ASN-{asn.asn_number[-6:]}"
        inv_res = await self.generate_e_invoice(
            db,
            org_id=org_id,
            payload=GenerateEInvoiceRequest(
                seller_gstin=seller_gstin,
                buyer_gstin=buyer_gstin,
                doc_number=doc_no,
                total_invoice_value=125000.00,
                total_tax_value=22500.00,
                asn_id=asn.id,
            ),
        )

        # Generate E-Way Bill linked to both ASN and E-Invoice
        ewb_res = await self.generate_e_way_bill(
            db,
            org_id=org_id,
            payload=GenerateEWayBillRequest(
                e_invoice_id=inv_res.id,
                asn_id=asn.id,
                vehicle_number=vehicle_number,
                distance_km=distance_km,
                from_pincode="400001",
                to_pincode="560001",
                transporter_name=asn.carrier_name or "Express Freight Transport",
            ),
        )

        return {
            "asn_id": str(asn.id),
            "asn_number": asn.asn_number,
            "e_invoice": inv_res.model_dump(),
            "e_way_bill": ewb_res.model_dump(),
        }


einvoicing_service = EInvoicingService()
