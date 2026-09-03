# SPEC_24_MASTER_DATA.md

## Title
Enterprise S2P Procurement Portal — Master Data Management

## Purpose
Define all 12 master data entities, governance workflows, validation rules, ERP sync strategies, and impact assessment for changes.

## Scope
Covers all master entities with full detail, maker-checker for all changes, category hierarchy rules, ERP sync per entity, active/inactive/archive lifecycle, exchange rate management, and tax code compliance.

## Dependencies
- SPEC_03_DATABASE.md (all master data tables: categories, uom_master, currency_master, payment_terms, incoterms, tax_codes, delivery_locations, document_types, supplier_categories, holiday_master, erp_material_group_mapping)
- SPEC_05_WORKFLOW_ENGINE.md (MASTER_DATA_CHANGE template)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Master Data Entities

### 1.1 Category

**Structure:** Hierarchical, max 3 levels. Only leaf categories (level 3) selectable in PRs/RFQs.

**Fields:** code, name, parent_id, level, erp_material_group, gl_account_mapping, synonyms (text array for auto-suggestion), requires_quality_inspection (boolean).

**Versioned:** Yes — changes tracked in audit log with before/after values.

**ERP mapping:** `erp_material_group` links to ERP material group code; used by unmapped PR auto-suggestion.

**Synonym list:** Array of alternative names used by the unmapped PR suggestion engine for keyword matching (e.g., category "Raw Materials - Chemicals" might have synonyms ["chemicals", "raw chem", "chemical raw materials"]).

**Circular reference prevention:**
```python
async def _validate_no_circular_ref(self, db, category_id: UUID, parent_id: UUID, org_id: UUID):
    current = parent_id
    while current:
        if current == category_id:
            raise AppException("CIRCULAR_REFERENCE", "Category hierarchy contains circular reference")
        parent = await self.repo.get(db, current, org_id)
        current = parent.parent_id if parent else None
```

### 1.2 UOM (Unit of Measure)

**Fields:** code (e.g., "KG", "NOS", "MTR"), name, erp_uom_code, base_uom_id, conversion_factor.

**Conversion:** `quantity_in_target_uom = quantity_in_source_uom * source_uom.conversion_factor / target_uom.conversion_factor` (both relative to base UOM).

**ERP mapping:** `erp_uom_code` maps portal UOM to ERP UOM code.

### 1.3 Currency

**Fields:** code (ISO 4217), name, symbol, decimal_places, exchange_rate_to_base, rate_last_updated.

**Exchange rate refresh:** Daily Celery task `refresh_exchange_rates` fetches from configured provider (ECB, OANDA, or internal Treasury API). Staleness alert if rate > 3 business days old.

**Manual override:** Finance Head can override exchange rate via `PATCH /api/v1/master-data/currencies/{id}/exchange-rate` with approval (maker-checker).

**Base currency:** Defined at org level (`organizations.base_currency`), default INR.

### 1.4 Payment Terms

**Fields:** code, name, description, payment_days, advance_percentage, retention_percentage, discount_percentage, discount_days, npv_factor, erp_payment_term_code.

**NPV factor calculation:**
```python
npv_factor = 1 / (1 - (payment_days / 365) * cost_of_capital_rate)
```
Auto-calculated when payment_days or org cost_of_capital_rate changes.

**Advance/Retention/Discount:** 
- Advance: % paid upfront before delivery
- Retention: % withheld until final acceptance
- Discount: % discount if paid within discount_days

### 1.5 Incoterms

**Fields:** code (e.g., "FOB", "CIF", "EXW"), name, edition_year (2020), risk_transfer_point (text describing where risk transfers).

### 1.6 Business Units

**Fields:** code, name, legal_entity_id, erp_company_code, default_currency, is_active.

**ERP mapping:** `erp_company_code` used for PR import field mapping.

### 1.7 Plants

**Fields:** code, name, business_unit_id, plant_type (MANUFACTURING, WAREHOUSE, OFFICE, PROJECT_SITE), erp_plant_code, GPS coordinates (latitude, longitude), default_delivery_location_id.

### 1.8 Cost Centers

**Fields:** code, name, business_unit_id, gl_account, erp_cost_center_code, annual_budget, available_budget, budget_period_start/end.

**Budget integration:** `available_budget` decremented on PR submission (budget lock), released on PR rejection/withdrawal/PO creation.

### 1.9 Tax Codes

**Fields:** code, name, tax_type (CGST, SGST, IGST, UTGST, CESS, VAT, CUSTOMS_DUTY, EXEMPT), rate, hsn_code_range_start, hsn_code_range_end, effective_from, effective_to.

**Effective dates:** Rate changes use `effective_from`/`effective_to` dates. CS generation uses the rate active at the time of evaluation.

**Compliance:** Cannot delete if referenced in active invoice. All changes appear in compliance reports.

### 1.10 Delivery Locations

**Fields:** code, name, plant_id, full address, GPS coordinates.

### 1.11 Supplier Categories

**Fields:** code, name, qualification_checklist (JSONB array of required document types), evaluation_frequency_months.

**Checklist structure:**
```json
[
  {"document_type_code": "GST_REG", "mandatory": true},
  {"document_type_code": "PAN_CARD", "mandatory": true},
  {"document_type_code": "QUALITY_CERT", "mandatory": false},
  {"document_type_code": "INSURANCE", "mandatory": true, "min_coverage": 1000000}
]
```

### 1.12 Document Types

**Fields:** code, name, category (TENDER, BID, COMPLIANCE, etc.), is_mandatory, validity_period_days, allowed_extensions (text array), max_file_size_mb, ocr_enabled.

---

## 2. Maker-Checker for All Master Data Changes

Every master data create/update/deactivate operation requires maker-checker approval:

```
1. User submits change → POST/PATCH /api/v1/master-data/{entity}/{id}
2. System runs impact assessment:
   - Count active transactions referencing this record
   - If zero references: immediate apply (still requires checker for create/update)
   - If any references: warning with count displayed before confirmation
3. Change request creates MASTER_DATA_CHANGE workflow
4. Procurement Admin reviews and approves
5. Versioned change applied; audit log entry with before/after values
```

**Impact assessment query examples:**
- Category change: count PRs, RFQs, contracts, vendors mapped to this category
- Payment term change: count active RFQs and contracts using this term
- Tax code change: count active invoices using this code

## 3. Category Hierarchy Rules

- Maximum 3 levels
- Circular reference prevention (see algorithm above)
- Only leaf nodes (level 3) selectable for procurement (PRs, RFQs)
- Parent categories serve as grouping/reporting only
- Synonym management for auto-suggestion engine: admin can add/remove synonyms via `PATCH /api/v1/master-data/categories/{id}/synonyms`

## 4. ERP Sync Strategy Per Entity

| Entity | Direction | Frequency | Conflict Resolution | Failure Handling |
|---|---|---|---|---|
| Category | Portal → ERP | On create/update (event) | Portal is master; ERP receives | Retry queue; manual if max retries |
| UOM | Bidirectional | Nightly batch | ERP is master for codes; portal is master for display names | Log discrepancy |
| Currency | Portal ← External API | Daily | External rate source is truth | Use last known rate; staleness alert |
| Payment Terms | Portal → ERP | On create/update | Portal is master | Retry queue |
| Business Units | ERP → Portal | Nightly batch | ERP is master | Log new BUs; admin reviews |
| Plants | ERP → Portal | Nightly batch | ERP is master | Log new plants |
| Cost Centers | ERP → Portal | Nightly batch (budgets); Portal → ERP on budget reservation | ERP is master for amounts | Budget discrepancy alert |
| Tax Codes | Portal managed | Manual | Portal is master (regulatory compliance) | N/A |

## 5. Active/Inactive/Archive Lifecycle

**Category example:**

| State | Behavior |
|---|---|
| Active | Full use in PRs, RFQs, vendor mappings, reports |
| Inactive | Existing records maintained; no new PRs/RFQs can select this category; existing workflows continue |
| Archive | Hidden from all UI dropdowns; retrievable only for audit purposes; accessible via admin portal |

**Transition restrictions:**
- Active → Inactive: Requires maker-checker; impact assessment shown
- Inactive → Active: Requires maker-checker
- Inactive → Archive: Allowed only if zero active transactions reference this entity
- Archive → Active: Not allowed; must create new entity

## 6. Exchange Rate Management

```python
@celery_app.task(queue="celery.integration")
async def refresh_exchange_rates():
    """Daily at midnight UTC. Fetches latest exchange rates."""
    async with async_session_factory() as db:
        orgs = await org_repo.get_all_active(db)
        for org in orgs:
            provider = get_rate_provider(org)  # ECB, OANDA, or internal Treasury
            base = org.base_currency
            currencies = await currency_repo.get_active(db, org.id)
            for currency in currencies:
                if currency.code == base:
                    continue
                try:
                    rate = await provider.get_rate(base, currency.code)
                    currency.exchange_rate_to_base = rate
                    currency.rate_last_updated = datetime.utcnow()
                except Exception as e:
                    logger.warning(f"Failed to fetch rate for {currency.code}: {e}")
            # Staleness check
            stale = [c for c in currencies if c.rate_last_updated and
                     (datetime.utcnow() - c.rate_last_updated).days > 3]
            if stale:
                await publisher.publish("procurement.alert", "alert.exchange_rate_stale",
                    {"currencies": [c.code for c in stale]}, org.id)
        await db.commit()
```

## 7. Tax Code Compliance

- Heightened audit scrutiny: all tax code changes logged with special audit flag
- All changes appear in monthly compliance reports
- Cannot delete if referenced in active invoice
- Effective date management: new rate takes effect from `effective_from`; old rate remains for historical transactions
- HSN code range validation: tax code applies to items with HSN codes within the specified range
