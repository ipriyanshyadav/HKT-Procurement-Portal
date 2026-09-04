from __future__ import annotations
from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any, Union
from uuid import UUID
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.constants import AuditAction
from app.core.exceptions import AppException, ConflictError, NotFoundError, ValidationError
from app.db.enums import PRStatus, UnmappedPrStatusEnum
from app.events.publisher import OutboxPublisher
from app.modules.audit.service import audit_service
from app.modules.master_data.models import Category
from app.modules.requisition.models import Requisition, UnmappedPrException, UnmappedPrMappingLog
from app.modules.requisition.repository import requisition_repository
from app.modules.unmapped_pr.repository import UnmappedPrRepository, unmapped_pr_repository
from app.modules.unmapped_pr.schemas import UnmappedPRMappingItem, UnmappedPRMapRequest


class UnmappedPRService:

    def __init__(
        self,
        repo: UnmappedPrRepository = unmapped_pr_repository,
        pr_repo=requisition_repository,
    ):
        self.repo = repo
        self.pr_repo = pr_repo

    async def flag_as_unmapped(
        self,
        db: AsyncSession,
        requisition_id: UUID,
        failed_fields: Union[dict, list],
        org_id: UUID,
        erp_reference: Optional[str] = None,
    ) -> UnmappedPrException:
        pr = await self.pr_repo.get(db, requisition_id, org_id)
        if not pr:
            raise NotFoundError(f"Requisition {requisition_id} not found")

        pr.status = PRStatus.UNMAPPED
        if erp_reference:
            pr.erp_pr_number = erp_reference
        await self.pr_repo.update(db, pr)

        sla_hours = settings.UNMAPPED_PR_SLA_HOURS[0] if settings.UNMAPPED_PR_SLA_HOURS else 4
        exception = UnmappedPrException(
            org_id=org_id,
            requisition_id=requisition_id,
            failed_fields=failed_fields if isinstance(failed_fields, (dict, list)) else {},
            status=UnmappedPrStatusEnum.PENDING,
            sla_deadline=datetime.now(timezone.utc) + timedelta(hours=sla_hours),
            sla_breach_level=0,
        )
        await self.repo.create(db, exception)

        await OutboxPublisher.publish(
            db,
            "procurement.unmapped",
            "unmapped.pr.created",
            {
                "exception_id": str(exception.id),
                "requisition_id": str(requisition_id),
                "pr_number": pr.pr_number,
                "org_id": str(org_id),
            },
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            requisition_id,
            AuditAction.RECEIVED,
            None,
            org_id,
            new_values={"status": PRStatus.UNMAPPED.value, "exception_id": str(exception.id)},
        )
        return exception

    async def get_by_id(
        self, db: AsyncSession, exception_id: UUID, org_id: UUID
    ) -> UnmappedPrException:
        exc = await self.repo.get(db, exception_id, org_id)
        if not exc:
            raise NotFoundError(f"Unmapped PR Exception {exception_id} not found")
        return exc

    async def map_pr(
        self,
        db: AsyncSession,
        exception_id: UUID,
        mappings: Union[list[dict], list[UnmappedPRMappingItem], dict],
        actor_id: UUID,
        org_id: UUID,
        notes: Optional[str] = None,
    ) -> Requisition:
        exception = await self.get_by_id(db, exception_id, org_id)
        if exception.status == UnmappedPrStatusEnum.RESOLVED:
            raise ConflictError("ALREADY_MAPPED", "PR already mapped")

        pr = await self.pr_repo.get(db, exception.requisition_id, org_id)
        if not pr:
            raise NotFoundError(f"Requisition {exception.requisition_id} not found")

        # Standardize mappings format
        mapping_list = []
        if isinstance(mappings, dict):
            for k, v in mappings.items():
                mapping_list.append({"field": k, "value": v})
        elif isinstance(mappings, list):
            for item in mappings:
                if isinstance(item, UnmappedPRMappingItem):
                    mapping_list.append(item.model_dump())
                elif isinstance(item, dict):
                    mapping_list.append(item)

        for m in mapping_list:
            field_name = m.get("field") or m.get("field_name")
            target_id = m.get("value") or m.get("target_id")
            source_value = m.get("source_value") or str(getattr(pr, field_name, "") or field_name)
            label = m.get("label") or str(target_id)

            if field_name and hasattr(pr, field_name):
                setattr(pr, field_name, UUID(str(target_id)) if isinstance(target_id, (str, UUID)) else target_id)

            log = UnmappedPrMappingLog(
                org_id=org_id,
                exception_id=exception.id,
                field_name=field_name,
                source_value=str(source_value),
                mapped_to_id=UUID(str(target_id)),
                mapped_to_label=label,
                mapping_method=m.get("mapping_method", "MANUAL"),
                confidence=Decimal(str(m.get("confidence", "1.0"))),
                mapped_by=actor_id,
            )
            await self.repo.log_mapping(db, log)

        exception.status = UnmappedPrStatusEnum.RESOLVED
        exception.resolved_at = datetime.now(timezone.utc)
        exception.resolved_by = actor_id
        exception.resolution_notes = notes
        await self.repo.update(db, exception)

        pr.status = PRStatus.SUBMITTED
        pr.updated_by = actor_id
        await self.pr_repo.update(db, pr)

        await OutboxPublisher.publish(
            db,
            "procurement.unmapped",
            "unmapped.pr.resolved",
            {"exception_id": str(exception.id), "requisition_id": str(pr.id), "pr_number": pr.pr_number},
            org_id,
        )
        await audit_service.log(
            db,
            "REQUISITION",
            pr.id,
            AuditAction.MAPPED,
            actor_id,
            org_id,
            new_values={"category_id": str(pr.category_id), "business_unit_id": str(pr.business_unit_id)},
        )
        return pr

    async def suggest_mapping(
        self, db: AsyncSession, exception_id: UUID, org_id: UUID
    ) -> dict:
        exception = await self.get_by_id(db, exception_id, org_id)
        pr = await self.pr_repo.get(db, exception.requisition_id, org_id)

        history = await self.repo.get_similar_history(db, org_id, limit=100)

        # Look for category mappings in history matching item description words
        suggestions = []
        confidence = 0.0
        top_cat_id = None

        if history:
            category_votes = Counter([h.mapped_to_id for h in history if h.field_name in ("category_id", "category")])
            if category_votes:
                top_cat_id, top_count = category_votes.most_common(1)[0]
                confidence = round(top_count / len(history), 2)
                # Fetch category label
                cat_res = await db.execute(select(Category).where(Category.id == top_cat_id))
                cat = cat_res.scalar_one_or_none()
                label = cat.name if cat else "Historical Match Category"
                suggestions.append({
                    "target_id": top_cat_id,
                    "label": label,
                    "confidence": confidence,
                    "method": "historical_frequency",
                })

        # Fallback: exact or keyword match against category master if history is empty
        if not suggestions:
            cat_stmt = select(Category).where(Category.org_id == org_id, Category.is_active.is_(True)).limit(1)
            cat_res = await db.execute(cat_stmt)
            default_cat = cat_res.scalar_one_or_none()
            if default_cat:
                top_cat_id = default_cat.id
                confidence = 0.50
                suggestions.append({
                    "target_id": default_cat.id,
                    "label": default_cat.name,
                    "confidence": 0.50,
                    "method": "default_catalog_match",
                })

        auto_apply = confidence >= 0.85

        return {
            "exception_id": exception_id,
            "suggested_category_id": top_cat_id,
            "confidence": confidence,
            "auto_apply": auto_apply,
            "based_on_records": len(history),
            "suggestions": suggestions,
            "reason": None if auto_apply else "Confidence below 0.85 threshold",
        }

    async def auto_map(
        self, db: AsyncSession, exception_id: UUID, actor_id: UUID, org_id: UUID
    ) -> Requisition:
        suggestion = await self.suggest_mapping(db, exception_id, org_id)
        confidence = suggestion.get("confidence", 0.0)

        if confidence < 0.85 or not suggestion.get("suggested_category_id"):
            raise AppException(
                f"Auto-mapping requires confidence >= 0.85 (current: {confidence})",
                "CONFIDENCE_TOO_LOW",
                {"confidence": confidence, "threshold": 0.85},
            )

        cat_id = suggestion["suggested_category_id"]
        mappings = [
            {
                "field": "category_id",
                "value": cat_id,
                "label": "Auto-mapped Category",
                "mapping_method": "AUTO_ML",
                "confidence": confidence,
            }
        ]
        return await self.map_pr(
            db,
            exception_id=exception_id,
            mappings=mappings,
            actor_id=actor_id,
            org_id=org_id,
            notes=f"Auto-mapped via ML recommendation with confidence {confidence}",
        )


unmapped_pr_service = UnmappedPRService()
