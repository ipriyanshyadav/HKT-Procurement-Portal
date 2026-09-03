from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Numeric, Integer, Date, ForeignKey, Text, CHAR
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.sql import func
from app.db.base import BaseModel
from app.db.enums import (
    PrSourceEnum, PR_SOURCE_PG,
    PrStatusEnum, PR_STATUS_PG,
    ProcurementTypeEnum, PROCUREMENT_TYPE_PG,
    UnmappedPrStatusEnum, UNMAPPED_PR_STATUS_PG,
)

class Requisition(BaseModel):
    __tablename__ = "requisitions"

    pr_number: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[PrSourceEnum] = mapped_column(PR_SOURCE_PG, default=PrSourceEnum.MANUAL, nullable=False)
    status: Mapped[PrStatusEnum] = mapped_column(PR_STATUS_PG, default=PrStatusEnum.DRAFT, nullable=False)
    procurement_type: Mapped[ProcurementTypeEnum] = mapped_column(PROCUREMENT_TYPE_PG, default=ProcurementTypeEnum.OPEX, nullable=False)
    requestor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    business_unit_id: Mapped[UUID] = mapped_column(ForeignKey("business_units.id"), nullable=False)
    plant_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("plants.id"), nullable=True)
    department_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    cost_center_id: Mapped[UUID] = mapped_column(ForeignKey("cost_centers.id"), nullable=False)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), default="INR", nullable=False)
    estimated_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    budget_check_status: Mapped[str] = mapped_column(String(20), default="NOT_CHECKED", nullable=False)
    budget_reserved_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)
    is_emergency: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_capex: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    required_by_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    delivery_location_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("delivery_locations.id"), nullable=True)
    erp_pr_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    erp_sync_status: Mapped[str] = mapped_column(String(20), default="NOT_SYNCED", nullable=False)
    merged_from: Mapped[Optional[List[UUID]]] = mapped_column(ARRAY(ForeignKey("requisitions.id")), nullable=True)
    split_into: Mapped[Optional[List[UUID]]] = mapped_column(ARRAY(ForeignKey("requisitions.id")), nullable=True)
    split_from: Mapped[Optional[UUID]] = mapped_column(ForeignKey("requisitions.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    aging_alert_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

class RequisitionLine(BaseModel):
    __tablename__ = "requisition_lines"

    requisition_id: Mapped[UUID] = mapped_column(ForeignKey("requisitions.id"), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    item_description: Mapped[str] = mapped_column(String(500), nullable=False)
    item_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    uom_id: Mapped[UUID] = mapped_column(ForeignKey("uom_master.id"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    estimated_unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    estimated_total: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    specifications: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    required_by_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    delivery_location_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("delivery_locations.id"), nullable=True)

class UnmappedPrException(BaseModel):
    __tablename__ = "unmapped_pr_exceptions"

    requisition_id: Mapped[UUID] = mapped_column(ForeignKey("requisitions.id"), nullable=False)
    failed_fields: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    status: Mapped[UnmappedPrStatusEnum] = mapped_column(UNMAPPED_PR_STATUS_PG, default=UnmappedPrStatusEnum.PENDING, nullable=False)
    assigned_to: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    sla_deadline: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    sla_breach_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    proposed_mappings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    resolved_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    reprocessing_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_reprocessing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class UnmappedPrMappingLog(BaseModel):
    __tablename__ = "unmapped_pr_mapping_log"

    exception_id: Mapped[UUID] = mapped_column(ForeignKey("unmapped_pr_exceptions.id"), nullable=False)
    field_name: Mapped[str] = mapped_column(String(50), nullable=False)
    source_value: Mapped[str] = mapped_column(String(200), nullable=False)
    mapped_to_id: Mapped[UUID] = mapped_column(nullable=False)
    mapped_to_label: Mapped[str] = mapped_column(String(200), nullable=False)
    mapping_method: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), nullable=True)
    mapped_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    checked_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    checked_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
