# IMPLEMENTATION PLAN — SPEC_24: Master Data Management
**Module:** 24 | **Phase:** Foundation | **Squad:** B
**Spec File:** SPEC_24_MASTER_DATA.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S24-01 | Category hierarchy (5 levels, per-org) | master_data/category/service.py | PLANNED |
| S24-02 | Category tree navigation (ancestors + descendants) | master_data/category/service.py | PLANNED |
| S24-03 | UOM master (base unit + conversions) | master_data/uom/service.py | PLANNED |
| S24-04 | Currency master + exchange rates | master_data/currency/service.py | PLANNED |
| S24-05 | Payment terms (net days + early discount) | master_data/payment_terms/service.py | PLANNED |
| S24-06 | Incoterms 2020 (20 standard codes) | scripts/seed_master_data.py | PLANNED |
| S24-07 | Tax codes (GST HSN/SAC, TDS) | master_data/tax/service.py | PLANNED |
| S24-08 | Delivery locations | master_data/location/service.py | PLANNED |
| S24-09 | Holiday master (per country, per year) | master_data/holiday/service.py | PLANNED |
| S24-10 | ERP material group mapping | master_data/erp_mapping/service.py | PLANNED |
| S24-11 | Approval workflow for master data changes | master_data/service.py + workflow | PLANNED |
| S24-12 | Master data versioning (effective_from/to) | All master_data models | PLANNED |
| S24-13 | Org-level defaults | master_data/service.py | PLANNED |
| S24-14 | Bulk import (CSV) | master_data/import_service.py | PLANNED |
| S24-15 | Exchange rate daily refresh (Celery task) | tasks/exchange_rates.py | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-24-1 | Category hierarchy stored as adjacency list (parent_id); 5-level max enforced at service layer; CTE used for tree traversal | SPEC Section 1 5-level hierarchy | MEDIUM | Squad B |
| A-24-2 | Exchange rates fetched from exchangeratesapi.io (or similar); stored in Redis with 24h TTL AND persisted to currency_master for historical reference | SPEC Section 4 exchange rates; API provider not specified | MEDIUM | Squad B |
| A-24-3 | Master data changes requiring approval (category tree, tax codes) use "MASTER_DATA_CHANGE" workflow template | SPEC Section 11 approval workflow | LOW | Squad B |
| A-24-4 | Bulk CSV import: max 5000 rows per import; async via Celery task; progress stored in integration_jobs table | SPEC Section 14 bulk import; size limit not specified | MEDIUM | Squad B |
| A-24-5 | Holiday master seeded with Indian national holidays for current + 1 year on startup; org can add custom holidays | SPEC Section 9 holiday master; seed data not defined | LOW | Squad B |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/master_data/category/service.py`
```python
class CategoryService:
    MAX_HIERARCHY_DEPTH = 5  # NOT from settings: structural limit, not business threshold

    async def create(self, db, data: CategoryCreateRequest, actor_id: UUID, org_id: UUID) -> Category:
        if data.parent_id:
            parent = await self.repo.get(db, data.parent_id, org_id)
            depth = await self._get_depth(db, parent.id, org_id)
            if depth >= self.MAX_HIERARCHY_DEPTH:
                raise ValidationError("MAX_DEPTH_EXCEEDED",
                    f"Category hierarchy cannot exceed {self.MAX_HIERARCHY_DEPTH} levels")
        category = Category(
            org_id=org_id, name=data.name, code=data.code,
            parent_id=data.parent_id, level=depth + 1 if data.parent_id else 1,
            hsn_sac_prefix=data.hsn_sac_prefix, is_active=True, created_by=actor_id
        )
        db.add(category)
        if data.parent_id:
            # Trigger approval workflow for category tree changes
            entity_context = {"change_type": "CATEGORY_ADD", "parent_id": str(data.parent_id)}
            rule = await self.rules_engine.find_matching_rule(db, "MASTER_DATA", entity_context, org_id)
            if rule:
                await self.workflow_engine.instantiate(db, rule.workflow_template_code,
                    "CATEGORY", category.id, entity_context, org_id, actor_id)
        await self.audit.log(db, "MASTER_DATA", category.id, "CATEGORY_CREATED", actor_id, org_id)
        return category

    async def get_tree(self, db, org_id: UUID, root_id: Optional[UUID] = None) -> list[dict]:
        """Returns full category tree using recursive CTE."""
        if root_id:
            cte_sql = text("""
                WITH RECURSIVE cat_tree AS (
                    SELECT id, name, code, parent_id, level, 0 as depth
                    FROM categories WHERE id = :root_id AND org_id = :org_id AND deleted_at IS NULL
                    UNION ALL
                    SELECT c.id, c.name, c.code, c.parent_id, c.level, ct.depth + 1
                    FROM categories c
                    INNER JOIN cat_tree ct ON c.parent_id = ct.id
                    WHERE c.org_id = :org_id AND c.deleted_at IS NULL
                )
                SELECT * FROM cat_tree ORDER BY level, name
            """)
            result = await db.execute(cte_sql, {"root_id": root_id, "org_id": org_id})
        else:
            cte_sql = text("""
                WITH RECURSIVE cat_tree AS (
                    SELECT id, name, code, parent_id, level, 0 as depth
                    FROM categories WHERE parent_id IS NULL AND org_id = :org_id AND deleted_at IS NULL
                    UNION ALL
                    SELECT c.id, c.name, c.code, c.parent_id, c.level, ct.depth + 1
                    FROM categories c
                    INNER JOIN cat_tree ct ON c.parent_id = ct.id
                    WHERE c.org_id = :org_id AND c.deleted_at IS NULL
                )
                SELECT * FROM cat_tree ORDER BY level, name
            """)
            result = await db.execute(cte_sql, {"org_id": org_id})
        rows = result.fetchall()
        return self._build_tree(rows)

    async def get_ancestors(self, db, category_id: UUID, org_id: UUID) -> list[dict]:
        sql = text("""
            WITH RECURSIVE ancestors AS (
                SELECT id, name, code, parent_id, level
                FROM categories WHERE id = :cat_id AND org_id = :org_id
                UNION ALL
                SELECT c.id, c.name, c.code, c.parent_id, c.level
                FROM categories c
                INNER JOIN ancestors a ON c.id = a.parent_id
                WHERE c.org_id = :org_id
            )
            SELECT * FROM ancestors ORDER BY level
        """)
        result = await db.execute(sql, {"cat_id": category_id, "org_id": org_id})
        return [dict(row) for row in result.fetchall()]
```

### 2.2 `app/tasks/exchange_rates.py`
```python
@celery_app.task(queue="celery.maintenance", name="refresh_exchange_rates")
def refresh_exchange_rates():
    asyncio.run(_async_refresh())

async def _async_refresh():
    """Fetch daily exchange rates; cache in Redis + persist to DB."""
    async with async_session_factory() as db:
        tenant_settings = await settings_repo.get_all_active_orgs(db)
        base_currencies = {ts.base_currency for ts in tenant_settings} | {"INR"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            for base in base_currencies:
                try:
                    resp = await client.get(
                        f"{settings.EXCHANGE_RATE_API_URL}/latest",
                        params={"base": base, "apikey": settings.EXCHANGE_RATE_API_KEY}
                    )
                    rates = resp.json()["rates"]
                    for target, rate in rates.items():
                        cache_key = RedisKeys.exchange_rate(base, target)
                        await redis.setex(cache_key, 86400, str(rate))
                        # Persist to DB for historical reference
                        await currency_repo.upsert_rate(db, base, target, rate)
                except Exception as e:
                    logger.error(f"Failed to fetch exchange rates for {base}: {e}")
        await db.commit()
```

### 2.3 `app/modules/master_data/import_service.py`
```python
class MasterDataImportService:

    async def import_categories_csv(self, db, file_bytes: bytes, actor_id: UUID, org_id: UUID) -> IntegrationJob:
        import csv, io
        rows = list(csv.DictReader(io.StringIO(file_bytes.decode("utf-8-sig"))))
        if len(rows) > 5000:
            raise ValidationError("IMPORT_TOO_LARGE", "Maximum 5000 rows per import")
        job = await self.job_repo.create(db, "CATEGORY_IMPORT", "MASTER_DATA", uuid4(),
            {"rows": rows, "actor_id": str(actor_id)}, org_id)
        from app.tasks.master_data_import import import_categories_task
        import_categories_task.delay(str(job.id), str(org_id))
        return job
```

### 2.4 Routers — Master Data (per entity type)
```
GET  /api/v1/master-data/categories           — list (with tree/flat toggle)
GET  /api/v1/master-data/categories/tree      — full hierarchy
POST /api/v1/master-data/categories           — create (with optional approval)
PUT  /api/v1/master-data/categories/{id}      — update
DEL  /api/v1/master-data/categories/{id}      — soft delete (if no active references)
GET  /api/v1/master-data/uom                  — list
GET  /api/v1/master-data/currencies           — list + current exchange rates
GET  /api/v1/master-data/payment-terms        — list
GET  /api/v1/master-data/incoterms            — list (read-only; seeded)
GET  /api/v1/master-data/tax-codes            — list
GET  /api/v1/master-data/delivery-locations   — list
POST /api/v1/master-data/delivery-locations   — create
GET  /api/v1/master-data/holidays/{year}      — list by year
POST /api/v1/master-data/holidays             — add custom holiday
POST /api/v1/master-data/import/categories    — CSV import
```

---
## STEP 3 — TEST
```python
async def test_category_max_depth_enforced(db, factory):
    """Creating category at level 6 raises MAX_DEPTH_EXCEEDED."""
    l5_cat = await create_nested_category(db, depth=5, org_id=org_id)
    with pytest.raises(ValidationError, match="MAX_DEPTH_EXCEEDED"):
        await cat_service.create(db, CategoryCreateRequest(parent_id=l5_cat.id, ...), actor, org_id)

async def test_category_tree_cte_correct(db, factory):
    """Tree CTE returns all descendants in correct order."""
    root = await create_category_tree(db, depth=3, org_id=org_id)
    tree = await cat_service.get_tree(db, org_id=org_id, root_id=root.id)
    assert len(tree) == 13  # 1 root + 3 L2 + 9 L3

async def test_exchange_rate_cached_in_redis(db, mock_exchange_api):
    """After refresh, Redis has rate for INR-USD."""
    await refresh_exchange_rates_async()
    rate = await redis.get(RedisKeys.exchange_rate("INR", "USD"))
    assert rate is not None

async def test_bulk_import_limit_enforced(db, factory):
    """6000-row CSV → ValidationError IMPORT_TOO_LARGE."""

async def test_category_tree_change_triggers_workflow(db, factory):
    """Adding sub-category creates WorkflowInstance with MASTER_DATA_CHANGE template."""
```
