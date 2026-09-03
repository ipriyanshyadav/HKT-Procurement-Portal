# SPEC_06_APPROVAL_RULES_ENGINE.md

## Title
Enterprise S2P Procurement Portal — Approval Rules Engine

## Purpose
Define the approval rules engine — rule builder, evaluation flow, priority resolution, dimension handling, simulation API, version management, in-flight protection, hardcoded controls, fallback handling, and rule testing.

## Scope
Covers rule evaluation flow, condition evaluation, priority and specificity resolution, approval step structure, complete sample approval matrices for all entity types, hardcoded non-configurable controls, rule versioning, rule change workflow, simulation API, fallback path, and rule testing requirements.

## Dependencies
- SPEC_03_DATABASE.md (approval_rules, approval_rule_versions, approval_groups tables)
- SPEC_05_WORKFLOW_ENGINE.md (workflow instantiation, template definitions)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Rule Evaluation Flow

```
Entity submitted → ApprovalRulesEngine.resolve_chain(transaction_type, entity_context)
  → Load all active rules for this transaction_type in this org_id
  → Filter rules: evaluate each rule's conditions against entity_context
  → Matching rules: all rules where ALL conditions are satisfied
  → Priority resolution: sort by priority ASC (lowest number = highest priority)
  → If single match: return that rule's approval_steps
  → If multiple matches at same priority: compare specificity (count of conditions)
  → If still tied: set entity to PENDING_RULE_RESOLUTION; alert admin
  → If no match: set entity to PENDING_RULE_RESOLUTION; alert admin
  → Return resolved approval steps → WorkflowEngine.instantiate() uses steps to create workflow
```

```python
# app/modules/approval_rules/service.py

class ApprovalRulesEngine:

    async def resolve_chain(
        self, db: AsyncSession, transaction_type: str,
        entity_context: dict, org_id: UUID
    ) -> dict:
        rules = await self.repo.get_active_rules(db, transaction_type, org_id)
        matching_rules = []
        for rule in rules:
            if self._evaluate_conditions(rule.conditions, entity_context):
                matching_rules.append(rule)

        if not matching_rules:
            return {"status": "PENDING_RULE_RESOLUTION", "reason": "No matching approval rule found"}

        matching_rules.sort(key=lambda r: (r.priority, -len(r.conditions)))
        top = matching_rules[0]
        same_priority = [r for r in matching_rules if r.priority == top.priority]

        if len(same_priority) > 1:
            by_specificity = sorted(same_priority, key=lambda r: -len(r.conditions))
            if len(by_specificity[0].conditions) == len(by_specificity[1].conditions):
                return {"status": "PENDING_RULE_RESOLUTION", "reason": "Tied rules at same priority and specificity"}
            top = by_specificity[0]

        version = await self.repo.get_current_version(db, top.id, org_id)
        return {
            "status": "RESOLVED",
            "rule_id": top.id,
            "rule_version_id": version.id,
            "approval_steps": version.approval_steps,
        }
```

---

## 2. Rule Condition Evaluation

Each rule's `conditions` is a JSONB array. All conditions are evaluated with **AND** logic (every condition must be satisfied for the rule to match).

### 2.1 Condition Structure

```json
[
  {"field": "amount", "operator": "gte", "value": 1000000},
  {"field": "procurement_type", "operator": "eq", "value": "CAPEX"},
  {"field": "bu_id", "operator": "in", "value": ["uuid-1", "uuid-2"]},
  {"field": "is_emergency", "operator": "eq", "value": false}
]
```

### 2.2 Supported Operators

| Operator | Meaning | Applicable Types |
|---|---|---|
| `eq` | Equal | string, number, boolean, UUID |
| `neq` | Not equal | string, number, boolean, UUID |
| `gt` | Greater than | number |
| `gte` | Greater than or equal | number |
| `lt` | Less than | number |
| `lte` | Less than or equal | number |
| `in` | Value in list | string, UUID |
| `not_in` | Value not in list | string, UUID |
| `contains` | String contains | string |
| `is_true` | Boolean true | boolean |
| `is_false` | Boolean false | boolean |

### 2.3 Supported Fields

| Field | Source | Type | Description |
|---|---|---|---|
| `amount` | Entity | decimal | PR estimated value, RFQ estimated value, PO total, invoice total, contract total, award total |
| `category_id` | Entity | UUID | Leaf category |
| `category_level1` | Entity (derived) | UUID | Top-level category |
| `bu_id` | Entity | UUID | Business unit |
| `plant_id` | Entity | UUID | Plant |
| `procurement_type` | Entity | string | CAPEX, OPEX, PROJECT, MRO, SERVICES |
| `rfq_type` | Entity | string | OPEN_TENDER, LIMITED_TENDER, etc. |
| `sourcing_type` | Entity | string | GOODS, SERVICES, WORKS, etc. |
| `bidder_count` | Entity | integer | Number of invited bidders |
| `vendor_type` | Entity | string | DOMESTIC, FOREIGN, MSME |
| `risk_class` | Entity | string | LOW, MEDIUM, HIGH |
| `is_strategic` | Entity | boolean | Strategic procurement flag |
| `is_emergency` | Entity | boolean | Emergency flag |
| `is_single_vendor` | Entity | boolean | Single vendor flag |
| `is_capex` | Entity | boolean | Capital expenditure flag |

### 2.4 Evaluation Function

```python
def _evaluate_conditions(self, conditions: list[dict], context: dict) -> bool:
    for condition in conditions:
        field = condition["field"]
        operator = condition["operator"]
        expected = condition["value"]
        actual = context.get(field)

        if actual is None:
            return False

        if operator == "eq" and actual != expected: return False
        if operator == "neq" and actual == expected: return False
        if operator == "gt" and not (actual > expected): return False
        if operator == "gte" and not (actual >= expected): return False
        if operator == "lt" and not (actual < expected): return False
        if operator == "lte" and not (actual <= expected): return False
        if operator == "in" and actual not in expected: return False
        if operator == "not_in" and actual in expected: return False
        if operator == "contains" and expected not in str(actual): return False
        if operator == "is_true" and actual is not True: return False
        if operator == "is_false" and actual is not False: return False

    return True
```

---

## 3. Approval Step Structure

The `approval_steps` JSONB follows the same schema as workflow template steps:

```json
{
  "steps": [
    {
      "step_number": 1,
      "step_type": "SEQUENTIAL",
      "resolver": "ROLE",
      "resolver_value": "SOURCING_MANAGER",
      "scope_filter": "same_bu",
      "sla_hours": 24,
      "backup_role": "PROCUREMENT_HEAD"
    },
    {
      "step_number": 2,
      "step_type": "SEQUENTIAL",
      "resolver": "ROLE",
      "resolver_value": "PROCUREMENT_HEAD",
      "scope_filter": null,
      "sla_hours": 48,
      "backup_role": "PROCUREMENT_ADMIN"
    }
  ]
}
```

---

## 4. Complete Sample Approval Matrices

### 4.1 Purchase Requisition Approval Matrix

**Dimensions:** Amount × Procurement Type

| Amount Band | OPEX | CAPEX | PROJECT | MRO | SERVICES |
|---|---|---|---|---|---|
| ≤ ₹50,000 | Buyer | Buyer | Buyer + PM | Buyer | Buyer |
| ₹50,001 – ₹2,00,000 | Buyer → Cat Mgr | Buyer → Cat Mgr | Buyer → PM → Cat Mgr | Buyer → Cat Mgr | Buyer → Cat Mgr |
| ₹2,00,001 – ₹10,00,000 | Buyer → Cat Mgr → SM | Buyer → Cat Mgr → SM → FC | Buyer → PM → Cat Mgr → SM | Buyer → Cat Mgr → SM | Buyer → Cat Mgr → SM |
| ₹10,00,001 – ₹50,00,000 | SM → Cat Mgr → PH | SM → Cat Mgr → PH → FC | SM → PM → Cat Mgr → PH → FC | SM → Cat Mgr → PH | SM → Cat Mgr → PH |
| > ₹50,00,000 | SM → Cat Mgr → PH → FC | SM → Cat Mgr → PH → FC → MD | SM → PM → PH → FC → MD | SM → Cat Mgr → PH → FC | SM → Cat Mgr → PH → FC |

**Legend:** SM = Sourcing Manager, Cat Mgr = Category Manager, PH = Procurement Head, FC = Finance Controller, PM = Project Manager, MD = Managing Director

### 4.2 RFQ Approval Matrix

**Dimensions:** Estimated Value × Sourcing Type

| Amount Band | GOODS | SERVICES | WORKS | GOODS_AND_SERVICES | TURNKEY | AMC |
|---|---|---|---|---|---|---|
| ≤ ₹5,00,000 | SM | SM | SM → PH | SM | SM → PH | SM |
| ₹5,00,001 – ₹25,00,000 | SM → Cat Mgr | SM → Cat Mgr | SM → Cat Mgr → PH | SM → Cat Mgr | SM → Cat Mgr → PH | SM → Cat Mgr |
| ₹25,00,001 – ₹1,00,00,000 | SM → Cat Mgr → PH | SM → Cat Mgr → PH | SM → Cat Mgr → PH → FC | SM → Cat Mgr → PH | SM → Cat Mgr → PH → FC | SM → Cat Mgr → PH |
| ₹1,00,00,001 – ₹5,00,00,000 | Cat Mgr → PH → FC | Cat Mgr → PH → FC | Cat Mgr → PH → FC → Legal | Cat Mgr → PH → FC | Cat Mgr → PH → FC → Legal | Cat Mgr → PH → FC |
| > ₹5,00,00,000 | PH → FC → Legal → MD | PH → FC → Legal → MD | PH → FC → Legal → MD | PH → FC → Legal → MD | PH → FC → Legal → MD | PH → FC → MD |
| Single Vendor (any) | +Compliance | +Compliance | +Compliance | +Compliance | +Compliance | +Compliance |

### 4.3 Purchase Order Approval Matrix

| Amount Band | Approval Chain |
|---|---|
| ≤ ₹2,00,000 | Auto-approval record (still creates audit entry; no human bypass) |
| ₹2,00,001 – ₹10,00,000 | Buyer → SM |
| ₹10,00,001 – ₹50,00,000 | Buyer → SM → PH |
| > ₹50,00,000 | SM → PH → FC |

### 4.4 Contract Approval Matrix

| Amount Band | Approval Chain |
|---|---|
| ≤ ₹10,00,000 | Buyer → Legal → SM |
| ₹10,00,001 – ₹50,00,000 | Buyer → Legal → SM → PH |
| ₹50,00,001 – ₹5,00,00,000 | Legal → SM → PH → FC → Legal Final |
| > ₹5,00,00,000 | Legal → SM → PH → FC → MD → Legal Final |

### 4.5 Invoice Approval Matrix

| Amount Band | Approval Chain |
|---|---|
| ≤ ₹5,00,000 | FC |
| ₹5,00,001 – ₹25,00,000 | FC → Finance Head |
| > ₹25,00,000 | FC → Finance Head → PH |

### 4.6 Vendor Approval Matrix

| Vendor Type | Approval Chain |
|---|---|
| Domestic (standard) | Vendor Admin → Cat Mgr |
| Domestic (strategic/high-risk) | Vendor Admin → Cat Mgr → Compliance → PH |
| Foreign | Vendor Admin → Cat Mgr → Compliance → PH → FC |
| MSME | Vendor Admin → Cat Mgr |

### 4.7 Master Data Change Matrix

| Change Type | Approval Chain |
|---|---|
| Category (create/update) | Procurement Admin |
| Tax Code (create/update) | Procurement Admin → FC |
| Payment Terms (create/update) | Procurement Admin → FC |
| All other master data | Procurement Admin |

---

## 5. Hardcoded Non-Configurable Controls

These controls are enforced in application code and cannot be changed via the rules data:

| Control | Enforcement Location | Description |
|---|---|---|
| Single-vendor extra level | `SourcingService.submit_rfq()` | If `rfq.is_single_vendor == True`, engine appends an additional Compliance Officer approval step regardless of what the rules data specifies |
| `rfq.view_bids_before_opening` always denied | `BidService.get_bid_details()` | Permission `rfq.view_bids_before_opening` is never assigned to any role; even if manually inserted into DB, the API endpoint checks `rfq.bids_opened_at IS NOT NULL` before returning bid data |
| Maker-checker always enforced | `WorkflowEngine.create_tasks_for_step()` | Entity creator/submitter can never be assigned as approver; no configuration flag can disable this |
| Blacklisting requires dual roles | `VendorService.confirm_blacklisting()` | Both COMPLIANCE_OFFICER and PROCUREMENT_HEAD must act; `blacklist_initiated_by != blacklist_confirmed_by` enforced at API and DB level |
| Audit log immutability | PostgreSQL trigger on `audit_logs` | DB trigger prevents UPDATE and DELETE regardless of application logic or user role |
| No auto-approve | All approval workflows | System never auto-approves any task regardless of SLA breach, rule configuration, or system setting; SLA breach → escalation to another human |

---

## 6. Rule Versioning

### 6.1 Version Management

```sql
-- On rule update:
-- 1. Create new approval_rule_versions record with incremented version_number
-- 2. Set effective_from = NOW() on new version
-- 3. Set effective_to = NOW() on previous version
-- 4. Update approval_rules.current_version_id to new version
```

### 6.2 In-Flight Transaction Protection

When a workflow instance is created, the `rule_version_id` used to generate the approval chain is captured in `workflow_instances.rule_version_id`. This version reference is immutable for the lifetime of that workflow instance. If the underlying rule is updated while a workflow is in-flight:

- The in-flight workflow continues using the captured version
- New transactions submitted after the rule change use the new version
- Admin can view which version each in-flight transaction is using via the workflow detail API

---

## 7. Rule Change Workflow

Changing an approval rule triggers a maker-checker workflow:

```
1. User with rules.update permission modifies rule → POST /api/v1/approval-rules/{id}/update
2. System runs impact assessment:
   a. Count in-flight workflow instances that used this rule's current version
   b. Return impact report: { "in_flight_count": 12, "entity_types": ["REQUISITION": 5, "RFQ": 7] }
3. User confirms change (acknowledging impact)
4. System creates MASTER_DATA_CHANGE workflow for the rule change
5. Procurement Admin approves the rule change
6. New version activated with effective_from = NOW()
7. Audit log entry: APPROVAL_RULE_CHANGED with old_version and new_version details
```

---

## 8. Simulation API

```
POST /api/v1/approval-rules/simulate
Authorization: Bearer {token}
Permission required: rules.simulate

Request body:
{
  "transaction_type": "RFQ_APPROVAL",
  "entity_context": {
    "amount": 2500000,
    "category_id": "uuid",
    "category_level1": "uuid",
    "bu_id": "uuid",
    "procurement_type": "CAPEX",
    "rfq_type": "LIMITED_TENDER",
    "sourcing_type": "GOODS",
    "bidder_count": 5,
    "is_emergency": false,
    "is_single_vendor": false,
    "is_capex": true,
    "is_strategic": false,
    "risk_class": "MEDIUM"
  }
}

Response (200):
{
  "status": "RESOLVED",
  "matched_rule": {
    "id": "rule-uuid",
    "name": "RFQ Approval - CAPEX - High Value",
    "priority": 10,
    "conditions_matched": 3
  },
  "approval_chain": [
    {
      "step_number": 1,
      "step_name": "Sourcing Manager Approval",
      "approvers": [
        {"id": "user-uuid", "name": "Rajesh Kumar", "role": "SOURCING_MANAGER", "bu": "BU-NORTH"}
      ],
      "sla_hours": 24,
      "condition_met": true
    },
    {
      "step_number": 2,
      "step_name": "Category Manager Approval",
      "approvers": [
        {"id": "user-uuid", "name": "Priya Sharma", "role": "CATEGORY_MANAGER"}
      ],
      "sla_hours": 24,
      "condition_met": true
    },
    {
      "step_number": 3,
      "step_name": "Procurement Head Approval",
      "approvers": [
        {"id": "user-uuid", "name": "Vikram Singh", "role": "PROCUREMENT_HEAD"}
      ],
      "sla_hours": 48,
      "condition_met": true,
      "condition_expression": "estimated_value > 2500000 or is_single_vendor == True"
    }
  ],
  "hardcoded_additions": [],
  "total_estimated_sla_hours": 96
}
```

No database records are created by the simulation endpoint. This is used by the Rule Testing UI and by buyers previewing the approval chain before submission.

---

## 9. Fallback Path

When `resolve_chain()` returns `PENDING_RULE_RESOLUTION`:

1. Entity status set to `PENDING_RULE_RESOLUTION` (a special workflow instance status)
2. Alert published to `procurement.alert` exchange with routing key `alert.rule_resolution_required`
3. Notification sent to all users with `rules.create` or `rules.update` permission
4. Admin can:
   a. Create a new rule that matches the entity context
   b. Manually assign an approval chain (one-time exception)
5. Manual assignment creates:
   - `workflow_instances` record with `rule_version_id = NULL` (indicating manual override)
   - Audit log entry: `MANUAL_RULE_OVERRIDE` with admin user, justification, and the manually assigned chain
6. Weekly compliance report includes all `PENDING_RULE_RESOLUTION` events and manual overrides

---

## 10. Rule Testing Before Go-Live

### 10.1 Required Test Matrix

Before activating a new or modified approval rule, the system enforces a test matrix of 20 representative transactions:

| # | Transaction Type | Amount | Category | BU | Procurement Type | Flags | Expected Chain |
|---|---|---|---|---|---|---|---|
| 1 | PR | ₹25,000 | Raw Materials | BU-NORTH | OPEX | — | Buyer |
| 2 | PR | ₹1,50,000 | Packaging | BU-SOUTH | OPEX | — | Buyer → Cat Mgr |
| 3 | PR | ₹5,00,000 | Machinery | BU-NORTH | CAPEX | is_capex | Buyer → Cat Mgr → SM → FC |
| 4 | PR | ₹25,00,000 | IT Services | BU-CENTRAL | SERVICES | — | SM → Cat Mgr → PH |
| 5 | RFQ | ₹3,00,000 | Chemicals | BU-NORTH | GOODS | — | SM |
| 6 | RFQ | ₹15,00,000 | Construction | BU-WEST | WORKS | — | SM → Cat Mgr → PH |
| 7 | RFQ | ₹2,00,00,000 | IT Infra | BU-CENTRAL | TURNKEY | — | Cat Mgr → PH → FC → Legal |
| 8 | RFQ | ₹50,000 | Office Supplies | BU-NORTH | GOODS | is_single_vendor | SM + Compliance |
| 9 | RFQ | ₹10,00,000 | Logistics | BU-SOUTH | SERVICES | is_emergency | SM → Cat Mgr (4h SLA) |
| 10 | PO | ₹1,50,000 | Raw Materials | BU-NORTH | OPEX | — | Auto-record |
| 11 | PO | ₹8,00,000 | Chemicals | BU-WEST | OPEX | — | Buyer → SM |
| 12 | PO | ₹30,00,000 | Machinery | BU-NORTH | CAPEX | — | Buyer → SM → PH |
| 13 | Contract | ₹5,00,000 | Packaging | BU-SOUTH | OPEX | — | Buyer → Legal → SM |
| 14 | Contract | ₹75,00,000 | IT Services | BU-CENTRAL | SERVICES | — | Legal → SM → PH → FC → Legal Final |
| 15 | Invoice | ₹3,00,000 | Raw Materials | BU-NORTH | OPEX | — | FC |
| 16 | Invoice | ₹15,00,000 | Construction | BU-WEST | WORKS | — | FC → Finance Head |
| 17 | Vendor | Domestic | Chemicals | — | — | standard | VA → Cat Mgr |
| 18 | Vendor | Foreign | IT Infra | — | — | — | VA → Cat Mgr → Compliance → PH → FC |
| 19 | Master Data | Category Change | — | — | — | — | Procurement Admin |
| 20 | Master Data | Tax Code Change | — | — | — | — | Procurement Admin → FC |

### 10.2 Test Execution

```
POST /api/v1/approval-rules/{rule_id}/test-matrix
Authorization: Bearer {token}

Request body:
{
  "test_cases": [ /* 20 test cases from above */ ]
}

Response:
{
  "total": 20,
  "passed": 19,
  "failed": 1,
  "results": [
    {
      "test_number": 1,
      "status": "PASSED",
      "expected_chain": "Buyer",
      "actual_chain": "Buyer"
    },
    {
      "test_number": 8,
      "status": "FAILED",
      "expected_chain": "SM + Compliance",
      "actual_chain": "SM",
      "failure_reason": "Hardcoded single-vendor control not reflected in rule output"
    }
  ]
}
```

All test results are stored in audit logs. Rule activation is blocked until all 20 tests pass. Sign-off by Procurement Admin is required before the rule goes live.
