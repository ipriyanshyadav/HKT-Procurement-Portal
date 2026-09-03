# SPEC_09_UNMAPPED_PR.md

## Title
Enterprise S2P Procurement Portal — Unmapped PR Exception Management

## Purpose
Define the unmapped PR exception detection, queue management, auto-suggestion engine, maker-checker mapping, reprocessing pipeline, SLA escalation, downstream impact tracking, and root cause analytics.

## Scope
Covers detection triggers, unmapped_pr_exceptions schema, auto-suggestion engine (rule-based and ML), queue UI data, manual mapping API, reprocessing logic, SLA escalation, downstream blocking widget, and root cause analytics.

## Dependencies
- SPEC_03_DATABASE.md (unmapped_pr_exceptions, unmapped_pr_mapping_log, erp_material_group_mapping tables)
- SPEC_05_WORKFLOW_ENGINE.md (UNMAPPED_PR_MAPPING_APPROVAL template)
- SPEC_08_PURCHASE_REQUISITION.md (ERP import pipeline)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Detection Trigger

Unmapped PR exceptions are created exclusively by the ERP import pipeline (`process_erp_pr_import` Celery task). Detection occurs when any of the 5 mandatory fields fails to resolve from ERP source values to portal entity IDs.

**Mandatory fields and failure conditions:**

| Field | ERP Source | Mapping Method | Failure Condition |
|---|---|---|---|
| `category_id` | `material_group` | `erp_material_group_mapping` table lookup | No mapping row exists for `(org_id, erp_material_group)` |
| `business_unit_id` | `company_code` | `business_units.erp_company_code` lookup | No BU with matching `erp_company_code` |
| `plant_id` | `plant_code` | `plants.erp_plant_code` lookup | No plant with matching `erp_plant_code` |
| `cost_center_id` | `cost_center` | `cost_centers.erp_cost_center_code` lookup | No cost center with matching code |
| `requestor_id` (buyer) | Derived from category + BU | User with BUYER role + category scope + BU scope | No eligible buyer found |

When any field fails, the PR is created with `status = UNMAPPED` and an `unmapped_pr_exceptions` record is created with the `failed_fields` JSONB detailing each failure.

---

## 2. `unmapped_pr_exceptions` Record Structure

The `failed_fields` JSONB stores an array of failure objects, each containing the source value and auto-generated suggestions:

```json
[
  {
    "field": "category_id",
    "source_value": "RAW-MATERIAL-001",
    "source_description": "Raw Material Group 001 from SAP",
    "suggestions": [
      {
        "target_id": "550e8400-e29b-41d4-a716-446655440000",
        "label": "Raw Materials - Chemicals",
        "confidence": 0.92,
        "method": "keyword_match"
      },
      {
        "target_id": "660e8400-e29b-41d4-a716-446655440001",
        "label": "Raw Materials - Polymers",
        "confidence": 0.78,
        "method": "keyword_match"
      }
    ]
  },
  {
    "field": "plant_id",
    "source_value": "PLT-UNKNOWN-99",
    "source_description": "Plant code PLT-UNKNOWN-99",
    "suggestions": []
  }
]
```

---

## 3. Auto-Suggestion Engine

### 3.1 Phase 1: Rule-Based

```python
# app/modules/unmapped_pr/suggestion_engine.py

class SuggestionEngine:

    async def generate_suggestions(
        self, db: AsyncSession, field: str, source_value: str,
        item_description: str, org_id: UUID
    ) -> list[Suggestion]:
        suggestions = []

        if field == "category_id":
            # Method 1: Exact match table
            exact = await self.mapping_repo.find_exact(db, org_id, source_value)
            if exact:
                suggestions.append(Suggestion(
                    target_id=exact.category_id, label=exact.category_name,
                    confidence=1.0, method="exact_match"
                ))

            # Method 2: Keyword match on item description vs category synonyms
            categories = await self.category_repo.get_all_with_synonyms(db, org_id)
            for cat in categories:
                score = self._keyword_match_score(item_description, cat.name, cat.synonyms)
                if score > 0.5:
                    suggestions.append(Suggestion(
                        target_id=cat.id, label=cat.name,
                        confidence=round(score, 2), method="keyword_match"
                    ))

            # Method 3: Historical mapping log (same source_value mapped before)
            historical = await self.mapping_log_repo.find_previous_mapping(db, org_id, field, source_value)
            if historical:
                suggestions.append(Suggestion(
                    target_id=historical.mapped_to_id, label=historical.mapped_to_label,
                    confidence=0.90, method="historical_match"
                ))

        elif field in ("business_unit_id", "plant_id", "cost_center_id"):
            # Fuzzy match on code/name
            entities = await self._get_entities_for_field(db, org_id, field)
            for entity in entities:
                code_similarity = levenshtein_ratio(source_value.lower(), entity.code.lower())
                if code_similarity > 0.7:
                    suggestions.append(Suggestion(
                        target_id=entity.id, label=f"{entity.code} - {entity.name}",
                        confidence=round(code_similarity, 2), method="fuzzy_code_match"
                    ))

        # Sort by confidence descending; limit to top 5
        suggestions.sort(key=lambda s: s.confidence, reverse=True)
        return suggestions[:5]

    def _keyword_match_score(self, description: str, category_name: str, synonyms: list[str]) -> float:
        desc_words = set(description.lower().split())
        cat_words = set(category_name.lower().split())
        all_synonyms = set(s.lower() for s in synonyms)
        match_words = desc_words & (cat_words | all_synonyms)
        if not desc_words:
            return 0.0
        return len(match_words) / max(len(cat_words), 1)
```

### 3.2 Phase 2: Embedding-Based (Future)

Uses `sentence-transformers` to compute semantic similarity between item description and category names/synonyms. Cosine similarity threshold of 0.75. Runs as async Celery task to avoid blocking the import pipeline.

---

## 4. Queue UI Data Requirements

The unmapped PR queue in the admin portal displays:

**Columns:**
| Column | Source | Sortable | Filterable |
|---|---|---|---|
| PR Number | `requisitions.pr_number` | Yes | Yes (text search) |
| ERP PR Number | `requisitions.erp_pr_number` | Yes | Yes |
| Title | `requisitions.title` | Yes | Yes (text search) |
| Estimated Value | `requisitions.estimated_value` | Yes | Yes (range) |
| Failed Fields | `unmapped_pr_exceptions.failed_fields` (count + names) | No | Yes (field name) |
| Age | `NOW() - unmapped_pr_exceptions.created_at` | Yes (default DESC) | Yes (range) |
| SLA Status | Computed from age vs thresholds | Yes | Yes (Green/Amber/Red/Dark Red) |
| Assigned To | `unmapped_pr_exceptions.assigned_to` → user name | Yes | Yes |
| Status | `unmapped_pr_exceptions.status` | Yes | Yes |
| Source BU | From ERP payload | Yes | Yes |

**Color coding thresholds:**
| Age | Color | Indicator |
|---|---|---|
| 0–4 hours | Green | Within SLA |
| 4–8 hours | Amber | Approaching SLA |
| 8–24 hours | Red | SLA breached |
| > 24 hours | Dark Red | Critical SLA breach |

**Bulk action:** `POST /api/v1/unmapped-prs/bulk-map` — allows mapping the same category to multiple PRs with the same unmapped material group in one operation.

---

## 5. Manual Mapping API

```
POST /api/v1/unmapped-prs/{exception_id}/map
Authorization: Bearer {token}
Permission: pr.approve (or unmapped_pr.map)

Request body:
{
  "mappings": [
    {"field": "category_id", "value": "category-uuid"},
    {"field": "plant_id", "value": "plant-uuid"}
  ],
  "notes": "Mapped RAW-MATERIAL-001 to Chemicals category based on item description"
}

Response (200 — direct apply):
{
  "status": "MAPPED",
  "reprocessing_status": "QUEUED"
}

Response (200 — requires checker):
{
  "status": "CHECKER_PENDING",
  "workflow_task_id": "task-uuid",
  "message": "PR value exceeds threshold; checker approval required"
}
```

**Maker-checker threshold:** If `requisitions.estimated_value > tenant_settings.unmapped_pr_checker_threshold` (default ₹10,00,000), the mapping creates a `UNMAPPED_PR_MAPPING_APPROVAL` workflow task. Otherwise, the mapping is applied directly and reprocessing is triggered.

---

## 6. Reprocessing Logic

```python
async def reprocess_unmapped_pr(
    self, db: AsyncSession, exception_id: UUID, org_id: UUID
) -> ReprocessingResult:
    """Atomic reprocessing: apply resolved mappings and re-run PR pipeline."""
    exception = await self.repo.get(db, exception_id, org_id)
    pr = await self.pr_repo.get(db, exception.requisition_id, org_id)

    try:
        # Apply mappings from exception.proposed_mappings
        for mapping in exception.proposed_mappings:
            setattr(pr, mapping["field"], UUID(mapping["value"]))

        # Re-run validation
        await self._validate_pr_fields(db, pr, org_id)

        # Compute estimated value from lines
        lines = await self.line_repo.get_lines(db, pr.id, org_id)
        pr.estimated_value = sum(l.quantity * l.estimated_unit_price for l in lines)

        # Budget check
        budget_mode = await self._get_budget_mode(db, org_id, pr.category_id, pr.business_unit_id)
        await self._check_budget(db, pr.cost_center_id, pr.estimated_value, org_id, budget_mode)

        # Transition PR status
        target_status = await self._get_reprocessing_target_status(db, org_id)
        pr.status = target_status  # SUBMITTED or APPROVED (configurable)

        # Update exception
        exception.status = UnmappedPRStatus.RESOLVED
        exception.resolved_at = datetime.utcnow()

        # Trigger approval workflow if target is SUBMITTED
        if target_status == PRStatus.SUBMITTED:
            await self.workflow_engine.instantiate(...)

        # Log mapping for future auto-suggestion
        for mapping in exception.proposed_mappings:
            log = UnmappedPRMappingLog(
                org_id=org_id, exception_id=exception.id,
                field_name=mapping["field"],
                source_value=mapping["source_value"],
                mapped_to_id=UUID(mapping["value"]),
                mapped_to_label=mapping.get("label", ""),
                mapping_method="MANUAL",
                mapped_by=mapping["mapped_by"],
            )
            db.add(log)

        await self.publisher.publish("procurement.unmapped", "unmapped_pr.resolved",
            {"exception_id": str(exception.id), "pr_number": pr.pr_number}, org_id)

        return ReprocessingResult(status="SUCCESS", pr_status=target_status)

    except Exception as e:
        exception.reprocessing_attempts += 1
        exception.last_reprocessing_error = str(e)

        if exception.reprocessing_attempts >= 3:
            exception.status = UnmappedPRStatus.MANUAL_INTERVENTION_REQUIRED
            await self.publisher.publish("procurement.alert", "alert.unmapped_pr_max_retries",
                {"exception_id": str(exception.id)}, org_id)
        else:
            exception.status = UnmappedPRStatus.REPROCESSING_FAILED

        return ReprocessingResult(status="FAILED", error=str(e), attempt=exception.reprocessing_attempts)
```

---

## 7. SLA Escalation

```python
# app/tasks/unmapped_pr_sla.py

@celery_app.task(queue="celery.sla_timers")
async def check_unmapped_pr_sla():
    """Runs every 15 minutes. Checks unmapped PR SLA thresholds."""
    async with async_session_factory() as db:
        pending = await unmapped_repo.get_pending_exceptions(db)
        now = datetime.utcnow()

        for exc in pending:
            hours_elapsed = (now - exc.created_at).total_seconds() / 3600

            if hours_elapsed >= 48 and exc.sla_breach_level < 4:
                exc.sla_breach_level = 4
                await publisher.publish("procurement.alert", "alert.unmapped_pr_sla_critical",
                    {"exception_id": str(exc.id), "hours": 48, "target": "HOD"}, exc.org_id)

            elif hours_elapsed >= 24 and exc.sla_breach_level < 3:
                exc.sla_breach_level = 3
                await publisher.publish("procurement.alert", "alert.unmapped_pr_sla_breach",
                    {"exception_id": str(exc.id), "hours": 24, "target": "PROCUREMENT_HEAD"}, exc.org_id)

            elif hours_elapsed >= 8 and exc.sla_breach_level < 2:
                exc.sla_breach_level = 2
                await publisher.publish("procurement.alert", "alert.unmapped_pr_sla_escalation",
                    {"exception_id": str(exc.id), "hours": 8, "target": "CATEGORY_MANAGER"}, exc.org_id)

            elif hours_elapsed >= 4 and exc.sla_breach_level < 1:
                exc.sla_breach_level = 1
                await publisher.publish("procurement.notification", "notification.unmapped_pr_reminder",
                    {"exception_id": str(exc.id), "hours": 4, "target": "PROCUREMENT_ADMIN"}, exc.org_id)

        await db.commit()
```

---

## 8. Downstream Blocking Impact Widget

Real-time aggregation displayed on admin dashboard:

```python
# Cached in Redis, refreshed every 5 minutes by Celery task

async def compute_unmapped_pr_impact(db: AsyncSession, org_id: UUID) -> dict:
    result = await db.execute(
        select(
            func.count(UnmappedPRException.id).label("count"),
            func.sum(Requisition.estimated_value).label("total_value"),
        )
        .join(Requisition, UnmappedPRException.requisition_id == Requisition.id)
        .where(
            UnmappedPRException.org_id == org_id,
            UnmappedPRException.status.in_(["PENDING", "ASSIGNED", "CHECKER_PENDING"]),
        )
    )
    row = result.one()
    impact = {"count": row.count or 0, "total_value": float(row.total_value or 0)}
    await redis.setex(f"cache:unmapped_pr_value:{org_id}", 300, json.dumps(impact))
    return impact
```

---

## 9. Root Cause Analytics

Weekly Celery task (`analyze_unmapped_pr_root_causes`):

**Aggregations computed:**
- Unmapped volume by source ERP material group (top 20)
- Unmapped volume by plant/BU
- Average resolution time (hours) — overall and per field
- Auto-suggestion acceptance rate (suggestions accepted vs manual override)
- Recurrence rate (same material group appearing unmapped multiple times)
- Resolution method breakdown (exact_match vs keyword_match vs historical_match vs manual)

**Output:** Stored in `analytics.mv_unmapped_pr_realtime` materialized view; displayed in admin dashboard and included in weekly compliance report.
