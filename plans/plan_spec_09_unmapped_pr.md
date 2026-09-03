# IMPLEMENTATION PLAN — SPEC_09: Unmapped PR / Exception Handling
**Module:** 09 | **Phase:** Core | **Squad:** B
**Spec File:** SPEC_09_UNMAPPED_PR.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S09-01 | Unmapped PR detection (ERP-originated, no category/BU) | tasks/erp_pr_ingestion.py | PLANNED |
| S09-02 | Exception table (unmapped_pr_exceptions) | requisition/models.py | PLANNED |
| S09-03 | SLA tiers: 4h→8h→24h→48h escalation | tasks/unmapped_pr_sla.py | PLANNED |
| S09-04 | Mapping workflow (BUYER assigns category+BU) | unmapped_pr/service.py | PLANNED |
| S09-05 | Auto-complete (ML scoring ≥ 0.85, admin override) | unmapped_pr/service.py | PLANNED |
| S09-06 | Mapping log for analytics | unmapped_pr/service.py | PLANNED |
| S09-07 | Dashboard widget (count + SLA status) | unmapped_pr/router.py | PLANNED |
| S09-08 | ERP PR ingestion via integration job | integration/adapters/erp_pr.py | PLANNED |
| S09-09 | Manual PR creation fallback (when ERP down) | unmapped_pr/router.py | PLANNED |
| S09-10 | Escalation to PROCUREMENT_HEAD at 48h breach | tasks/unmapped_pr_sla.py | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-09-1 | "Unmapped" means ERP-originated PR with NULL category_id or NULL business_unit_id | SPEC_09 Section 2; ERP may not send enriched data | MEDIUM | Squad B |
| A-09-2 | ML auto-complete uses historical mapping data stored in unmapped_pr_mapping_log; minimum 100 records needed for ML; fewer than 100 → manual only | SPEC mentions ML scoring; no data requirement stated | MEDIUM | Squad B + E |
| A-09-3 | SLA clock starts at `created_at` of unmapped_pr_exceptions row; NOT at ERP ingestion time | SPEC_09 Section 3 — SLA from exception creation | LOW | Squad B |
| A-09-4 | Settings.UNMAPPED_PR_SLA_HOURS = [4, 8, 24, 48] in exact order | SPEC lists four SLA tiers | LOW | Squad B |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/unmapped_pr/service.py`
```python
class UnmappedPRService:

    async def flag_as_unmapped(self, db, requisition_id: UUID, erp_reference: str, org_id: UUID) -> UnmappedPRException:
        exception = UnmappedPRException(
            org_id=org_id, requisition_id=requisition_id,
            erp_reference=erp_reference, sla_status="TIER_1",
            sla_deadline=datetime.utcnow() + timedelta(hours=settings.UNMAPPED_PR_SLA_HOURS[0]),
        )
        db.add(exception)
        await self.publisher.publish("procurement.unmapped", "unmapped.pr.created", {
            "exception_id": str(exception.id), "requisition_id": str(requisition_id), "org_id": str(org_id)
        }, org_id)
        return exception

    async def map_pr(self, db, exception_id: UUID, category_id: UUID, business_unit_id: UUID,
                     actor_id: UUID, org_id: UUID) -> Requisition:
        exception = await self.repo.get(db, exception_id, org_id)
        if exception.status == "RESOLVED":
            raise ConflictError("ALREADY_MAPPED", "PR already mapped")
        pr = await self.pr_repo.get(db, exception.requisition_id, org_id)
        pr.category_id = category_id
        pr.business_unit_id = business_unit_id
        exception.status = "RESOLVED"
        exception.resolved_at = datetime.utcnow()
        exception.resolved_by = actor_id
        exception.resolution_time_hours = (exception.resolved_at - exception.created_at).total_seconds() / 3600
        log = UnmappedPRMappingLog(
            org_id=org_id, exception_id=exception_id, requisition_id=pr.id,
            mapped_category_id=category_id, mapped_bu_id=business_unit_id,
            mapped_by=actor_id, mapping_method="MANUAL", confidence_score=None,
        )
        db.add(log)
        await self.publisher.publish("procurement.unmapped", "unmapped.pr.resolved",
            {"exception_id": str(exception_id), "org_id": str(org_id)}, org_id)
        await self.audit.log(db, "UNMAPPED_PR", exception_id, "UNMAPPED_PR_MAPPED", actor_id, org_id,
            new_values={"category_id": str(category_id), "business_unit_id": str(business_unit_id)})
        return pr

    async def suggest_mapping(self, db, exception_id: UUID, org_id: UUID) -> dict:
        """ML-based suggestion using historical logs."""
        exception = await self.repo.get(db, exception_id, org_id)
        pr = await self.pr_repo.get(db, exception.requisition_id, org_id)
        history = await self.log_repo.get_similar(db, pr.description, org_id, limit=50)
        if len(history) < 100:
            return {"suggestion": None, "reason": "INSUFFICIENT_HISTORY", "min_records_needed": 100}
        category_votes = Counter([str(h.mapped_category_id) for h in history])
        top_cat, top_count = category_votes.most_common(1)[0]
        confidence = top_count / len(history)
        return {
            "suggested_category_id": top_cat,
            "confidence": confidence,
            "auto_apply": confidence >= 0.85,  # NOT from settings: this is ML threshold, always 0.85 per spec
            "based_on_records": len(history),
        }
```

### 2.2 SLA Timer Task
```python
@celery_app.task(queue="celery.sla_timers", name="check_unmapped_pr_sla")
def check_unmapped_pr_sla():
    asyncio.run(_async_check_unmapped_sla())

async def _async_check_unmapped_sla():
    async with async_session_factory() as db:
        now = datetime.utcnow()
        pending = await unmapped_repo.get_all_pending(db)
        sla_hours = settings.UNMAPPED_PR_SLA_HOURS  # [4, 8, 24, 48]
        for exc in pending:
            elapsed = (now - exc.created_at).total_seconds() / 3600
            if elapsed >= sla_hours[3] and exc.sla_status != "TIER_4":
                exc.sla_status = "TIER_4"
                exc.sla_deadline = exc.created_at + timedelta(hours=sla_hours[3])
                await publisher.publish("procurement.unmapped", "unmapped.pr.sla.tier4",
                    {"exception_id": str(exc.id), "elapsed_hours": elapsed}, exc.org_id)
                # Escalate to PROCUREMENT_HEAD
                await publisher.publish("procurement.notification", "notification.inapp.create",
                    {"recipient_role": "PROCUREMENT_HEAD", "org_id": str(exc.org_id),
                     "message": f"CRITICAL: Unmapped PR outstanding {elapsed:.1f}h"}, exc.org_id)
            elif elapsed >= sla_hours[2] and exc.sla_status not in ("TIER_3", "TIER_4"):
                exc.sla_status = "TIER_3"
                await publisher.publish("procurement.unmapped", "unmapped.pr.sla.tier3",
                    {"exception_id": str(exc.id), "elapsed_hours": elapsed}, exc.org_id)
            elif elapsed >= sla_hours[1] and exc.sla_status not in ("TIER_2", "TIER_3", "TIER_4"):
                exc.sla_status = "TIER_2"
                await publisher.publish("procurement.unmapped", "unmapped.pr.sla.tier2", {}, exc.org_id)
            elif elapsed >= sla_hours[0] and exc.sla_status == "TIER_1":
                exc.sla_status = "TIER_1_ALERTED"
                await publisher.publish("procurement.unmapped", "unmapped.pr.sla.tier1", {}, exc.org_id)
        await db.commit()
```

### 2.3 Router
- `GET /api/v1/unmapped-prs` — list pending exceptions with SLA status
- `GET /api/v1/unmapped-prs/dashboard` — counts by SLA tier
- `POST /api/v1/unmapped-prs/{id}/map` — manual mapping
- `GET /api/v1/unmapped-prs/{id}/suggest` — ML suggestion
- `POST /api/v1/unmapped-prs/{id}/auto-map` — apply ML suggestion (confidence ≥ 0.85 only)

---
## STEP 3 — TEST
```python
async def test_sla_tier_progression(db, factory):
    """Exception advances through TIER_1→TIER_4 as time progresses."""
async def test_auto_map_requires_confidence_threshold(db, factory):
    """auto-map with confidence < 0.85 returns 422."""
async def test_resolved_exception_cannot_be_remapped(db, factory):
    """Second map call on RESOLVED exception raises ConflictError."""
async def test_mapping_log_created_on_resolve(db, factory):
    """UnmappedPRMappingLog record exists after mapping."""
```
