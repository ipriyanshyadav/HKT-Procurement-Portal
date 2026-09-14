# SPEC_27 — Indentor Role
## Comprehensive Implementation Plan

> **Module**: Indentor Role (SPEC_27)  
> **Date**: 2026-09-13  
> **Author**: AI Implementation Plan (GEMINI.md-compliant)  
> **Status**: PLANNED  
> **Depends on**: SPEC_08 (PR), SPEC_24 (Master Data), SPEC_16 (Notifications), SPEC_04 (Auth), SPEC_05 (Workflow)

---

## Executive Summary

The **Indentor** (also spelled "Indenter") is a procurement role found in enterprise-grade S2P platforms such as SAP Ariba, Oracle Procurement Cloud, Coupa, and GEP Smart. The Indentor initiates purchase demand by:

1. **Searching** the internal catalog or external punchout marketplaces for needed items
2. **Building a cart** (the "indent") with required items and quantities
3. **Transferring the demand** to a designated Buyer for processing — they cannot place orders directly
4. **Acting as consignee** — receiving, inspecting and accepting delivered goods
5. **Tracking their requisitions** through notifications after hand-off

Unlike the current `REQUESTOR` role (which creates PRs directly via form), the Indentor has a **guided, catalog-first flow with a dedicated hand-off mechanism** to route demand to a specific buyer. This is the distinction between a _requestor who writes a PR_ and an _indentor who shops a cart and assigns a buyer_.

---

## Industry Research Findings

Based on analysis of SAP Ariba, Oracle iProcurement, Coupa, GEP Smart, and enterprise government procurement portals:

| Platform | Indentor Capabilities |
|---|---|
| **SAP Ariba** | Catalog search → Shopping cart → PR with buyer assignment → GRN by requisitioner |
| **Oracle iProcurement** | Requisition builder → Approver assignment → Receiving by requestor |
| **Coupa** | Catalog browse → Cart → Submit requisition → Track status → Receive goods |
| **GEP Smart** | Smart catalog → Demand generation → Buyer handoff → Receipt confirmation |
| **Government eProc** | Indent raise → Ministry/dept approval → GRN by initiating officer |

**Key differentiator**: The Indentor cannot finalize checkout, select vendors, or raise POs. Their authority ends at submitting the indent to a buyer.

---

## Assumptions Log

| ID | Assumption | Risk | Owner |
|---|---|---|---|
| A-27-1 | INDENTOR is a **distinct role** from REQUESTOR — both can create PRs, but INDENTOR has catalog-first flow + buyer assignment + consignee reception | MEDIUM | Product |
| A-27-2 | Indentor selects a **specific buyer** (from a filtered list of BUYER-role users in their BU/category scope) during cart transfer; if no buyer is selected, system auto-assigns using existing buyer assignment logic | LOW | Backend |
| A-27-3 | Indentor can view/track **only their own** PRs (scoped: `pr.view_own`) — no cross-team visibility | LOW | Product |
| A-27-4 | Indentor acts as **consignee** — after PO delivery, receives a GRN notification and can confirm receipt in the portal (thin wrapper over existing GRN module) | MEDIUM | Product |
| A-27-5 | Indentor **cannot** approve/reject PRs, access RFQs/bids, view financials, or manage vendors | LOW | Security |
| A-27-6 | Cart transfer creates a PR in `SUBMITTED` status with `assigned_buyer_id` set — bypasses DRAFT step | LOW | Backend |
| A-27-7 | The Indentor portal is **the Buyer Portal** (port 3000) with a filtered sidebar — no new Next.js app | LOW | Frontend |
| A-27-8 | Indentor notification for GRN delivery uses existing SPEC_16 notification engine | LOW | Backend |
| A-27-9 | Indentor can add **specifications and notes** per line item in the cart before transfer | LOW | Product |
| A-27-10 | DB migration adds `assigned_buyer_id` to `requisitions` table — non-breaking, nullable | LOW | DB |
| A-27-11 | `IndentCart` is a **logical view** over `user_carts` table — no new table needed | LOW | DB |
| A-27-12 | Indentor can initiate punchout sessions (existing feature) to external marketplaces | LOW | Product |

---

## Implementation Order

Following FRONTEND_BACKEND_WIRING_GUIDE.md Rule (SPEC_19 in parallel):

```
Level 0: Database migration (0054_indentor_role.py)
Level 1: Role seeding (seed_master_data.py update)
Level 2: Permission constants + role-permission mappings
Level 3: Backend service enhancements (catalog, requisition)
Level 4: New API endpoints (indent transfer, buyer list)
Level 5: Notification templates (indentor events)
Level 6: TypeScript type generation
Level 7: Frontend — Indentor sidebar + pages + hooks
Level 8: Seed demo user (indentor@procurement.com)
Level 9: Tests (unit + integration)
Level 10: Graphify update + README update
```

---

## Phase 1 — Database Migration

**File**: `alembic/versions/0054_indentor_role.py`

### 1.1 Schema Changes

```python
"""0054 — Add Indentor role and cart transfer support

Revision ID: 0054_indentor_role
Revises: 0053_early_payment_discounting
Create Date: 2026-09-13
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0054_indentor_role"
down_revision = "0053_early_payment_discounting"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add assigned_buyer_id to requisitions (nullable, non-breaking)
    op.add_column(
        "requisitions",
        sa.Column(
            "assigned_buyer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="Buyer explicitly assigned by Indentor at cart transfer time",
        ),
    )

    # 2. Add indent_notes to requisitions (nullable)
    op.add_column(
        "requisitions",
        sa.Column(
            "indent_notes",
            sa.Text(),
            nullable=True,
            comment="Notes from Indentor to Buyer during cart hand-off",
        ),
    )

    # 3. Add is_indent flag to distinguish indent-origin PRs
    op.add_column(
        "requisitions",
        sa.Column(
            "is_indent",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
            comment="True if PR originated from Indentor cart transfer flow",
        ),
    )

    # 4. Add indentor_id — original employee who raised the indent
    # requestor_id = the assigned buyer (who technically owns the PR in workflow)
    # indentor_id = the original employee who raised the indent
    op.add_column(
        "requisitions",
        sa.Column(
            "indentor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="Original indentor who raised the demand",
        ),
    )

    # 5. BTree index on is_indent for fast filtering
    op.create_index(
        "ix_requisitions_is_indent",
        "requisitions",
        ["is_indent", "org_id"],
        postgresql_using="btree",
    )

    # 6. Index on assigned_buyer_id for buyer workqueue queries
    op.create_index(
        "ix_requisitions_assigned_buyer_id",
        "requisitions",
        ["assigned_buyer_id", "org_id"],
    )

    # 7. Index on indentor_id for self-service tracking
    op.create_index(
        "ix_requisitions_indentor_id",
        "requisitions",
        ["indentor_id", "org_id"],
    )

    # 8. Extend PrSourceEnum
    op.execute(
        "ALTER TYPE pr_source ADD VALUE IF NOT EXISTS 'INDENT_CART'"
    )


def downgrade() -> None:
    op.drop_index("ix_requisitions_indentor_id", table_name="requisitions")
    op.drop_index("ix_requisitions_assigned_buyer_id", table_name="requisitions")
    op.drop_index("ix_requisitions_is_indent", table_name="requisitions")
    op.drop_column("requisitions", "indentor_id")
    op.drop_column("requisitions", "is_indent")
    op.drop_column("requisitions", "indent_notes")
    op.drop_column("requisitions", "assigned_buyer_id")
    # NOTE: PostgreSQL enum values cannot be removed. INDENT_CART enum value
    # remains after downgrade — this is acceptable per PostgreSQL constraints.
```

### 1.2 Model Updates

**File**: `app/modules/requisition/models.py` — Add to `Requisition` class:
```python
# Indentor flow fields (non-breaking, nullable)
is_indent: Mapped[bool] = mapped_column(Boolean, server_default=sa.false(), nullable=False)
indentor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
assigned_buyer_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
indent_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**File**: `app/db/enums.py` — Add `INDENT_CART = "INDENT_CART"` to `PrSourceEnum`.

---

## Phase 2 — Role & Permission Constants

### 2.1 Role Constant

**File**: `app/core/constants.py` — In `RoleCode`:

```python
INDENTOR = "INDENTOR"   # NEW — catalog-first demand raiser
```

### 2.2 Permission Constants

**File**: `app/core/constants.py` — In `PermissionCode`:

```python
    # Indentor (6)
    INDENT_CREATE = "indent.create"
    INDENT_VIEW_OWN = "indent.view_own"
    INDENT_TRANSFER = "indent.transfer"
    INDENT_WITHDRAW = "indent.withdraw"
    INDENT_RECEIVE_GRN = "indent.receive_grn"
    INDENT_VIEW_TRACKING = "indent.view_tracking"
```

### 2.3 Audit Actions

**File**: `app/core/constants.py` — In `AuditAction`:

```python
    # Indentor (4)
    INDENT_RAISED = "INDENT_RAISED"
    INDENT_TRANSFERRED = "INDENT_TRANSFERRED"
    INDENT_WITHDRAWN = "INDENT_WITHDRAWN"
    INDENT_RECEIVED = "INDENT_RECEIVED"
```

---

## Phase 3 — Role Seeding

### 3.1 seed_master_data.py

**Append to `ROLES` list**:
```python
{"code": "INDENTOR", "name": "Indentor", "is_system_role": True, "is_supplier_role": False},
```

**Append to role-permission mapping for `INDENTOR`**:
```python
"INDENTOR": [
    PermissionCode.MASTER_VIEW,
    PermissionCode.PR_CREATE,
    PermissionCode.PR_VIEW_OWN,
    PermissionCode.PR_SUBMIT,
    PermissionCode.INDENT_CREATE,
    PermissionCode.INDENT_VIEW_OWN,
    PermissionCode.INDENT_TRANSFER,
    PermissionCode.INDENT_WITHDRAW,
    PermissionCode.INDENT_RECEIVE_GRN,
    PermissionCode.INDENT_VIEW_TRACKING,
    PermissionCode.NOTIFICATION_VIEW_OWN,
    PermissionCode.DOCUMENT_UPLOAD,
    PermissionCode.DOCUMENT_VIEW_OWN,
    PermissionCode.TICKET_CREATE,
    PermissionCode.TICKET_VIEW_OWN,
],
```

---

## Phase 4 — Backend Schemas

**File**: `app/modules/requisition/schemas.py` — New schemas:

```python
class IndentTransferRequest(BaseModel):
    """Indentor submits their demand, transferring to a buyer."""
    title: str = Field(min_length=5, max_length=300)
    description: Optional[str] = Field(None, max_length=2000)
    business_unit_id: UUID
    cost_center_id: UUID
    plant_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    category_id: UUID
    procurement_type: str = Field(pattern="^(CAPEX|OPEX|PROJECT|MRO|SERVICES)$")
    currency: str = Field(default="INR", pattern="^[A-Z]{3}$")
    is_emergency: bool = False
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None
    indent_notes: Optional[str] = Field(None, max_length=2000,
        description="Contextual notes from Indentor to the assigned Buyer")
    assigned_buyer_id: Optional[UUID] = Field(None,
        description="Specific buyer to assign. If null, system auto-assigns.")
    lines: list[PRLineItemRequest] = Field(min_length=1, max_length=100)


class IndentTransferResponse(BaseModel):
    pr_id: UUID
    pr_number: str
    title: str
    status: str
    is_indent: bool
    indentor_id: UUID
    assigned_buyer_id: Optional[UUID]
    assigned_buyer_name: Optional[str]
    total_value: float
    currency: str
    line_count: int
    message: str


class IndentCartTransferRequest(BaseModel):
    """Transfer from existing UserCart directly as an indent."""
    title: str = Field(min_length=5, max_length=300)
    indent_notes: Optional[str] = Field(None, max_length=2000)
    assigned_buyer_id: Optional[UUID] = None
    business_unit_id: Optional[UUID] = None
    cost_center_id: Optional[UUID] = None
    plant_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    procurement_type: str = Field(default="OPEX", pattern="^(CAPEX|OPEX|PROJECT|MRO|SERVICES)$")
    currency: str = Field(default="INR", pattern="^[A-Z]{3}$")
    is_emergency: bool = False
    required_by_date: Optional[date] = None
    delivery_location_id: Optional[UUID] = None


class BuyerSelectionItem(BaseModel):
    """Buyer available for indentor selection."""
    id: UUID
    first_name: str
    last_name: str
    full_name: str
    email: str
    department: Optional[str] = None
    category_scopes: list[str] = []
    bu_scopes: list[str] = []


class IndentorTrackingResponse(BaseModel):
    """Indentor's own PR status tracking response."""
    pr_id: UUID
    pr_number: str
    title: str
    status: str
    is_indent: bool
    estimated_value: float
    currency: str
    created_at: datetime
    approved_at: Optional[datetime] = None
    assigned_buyer_name: Optional[str] = None
    workflow_step: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    po_number: Optional[str] = None
    grn_status: Optional[str] = None
```

---

## Phase 5 — Backend Service Layer

**File**: `app/modules/requisition/service.py` — Add 4 methods to `RequisitionService`:

### 5.1 `create_indent()`

Business rules:
1. Indentor must have `INDENT_CREATE` + `INDENT_TRANSFER` permissions
2. PR created in `SUBMITTED` status immediately (no DRAFT step)
3. `assigned_buyer_id` populated — if null, system auto-assigns by category+BU
4. `is_indent=True`, `indentor_id=actor.id`, `requestor_id=assigned_buyer_id` (buyer owns workflow steps)
5. Budget check in **soft mode** (warn only — buyer confirms)
6. Workflow instantiated immediately
7. RabbitMQ event published: `indent.transferred`
8. Audit logged: `INDENT_TRANSFERRED`

```python
async def create_indent(
    self,
    db: AsyncSession,
    data: IndentTransferRequest,
    actor: User,
    org_id: UUID,
) -> Requisition:
    pr_number = await self._generate_pr_number(db, org_id, data.business_unit_id)
    assigned_buyer_id = data.assigned_buyer_id
    if not assigned_buyer_id and settings.INDENT_AUTO_ASSIGN_BUYER:
        buyer = await self._assign_buyer(db, org_id, data.category_id, data.business_unit_id)
        assigned_buyer_id = buyer.id if buyer else None

    await self._check_budget(db, data.cost_center_id, data.estimated_value, org_id, "soft")

    pr = Requisition(
        org_id=org_id,
        pr_number=pr_number,
        title=data.title,
        description=data.description,
        source=PrSourceEnum.INDENT_CART,
        status=PrStatusEnum.SUBMITTED,
        procurement_type=ProcurementTypeEnum(data.procurement_type),
        requestor_id=assigned_buyer_id or actor.id,
        indentor_id=actor.id,
        assigned_buyer_id=assigned_buyer_id,
        business_unit_id=data.business_unit_id,
        plant_id=data.plant_id,
        department_id=data.department_id,
        cost_center_id=data.cost_center_id,
        category_id=data.category_id,
        currency=data.currency,
        is_emergency=data.is_emergency,
        is_indent=True,
        indent_notes=data.indent_notes,
        required_by_date=data.required_by_date,
        delivery_location_id=data.delivery_location_id,
        estimated_value=data.estimated_value,
    )
    db.add(pr)
    await db.flush()
    # Add lines, reserve budget, instantiate workflow, audit, publish event
    ...
    return pr
```

### 5.2 `create_indent_from_cart()`

Converts active `UserCart` items into an `IndentTransferRequest` then calls `create_indent()`. Marks cart as `CHECKED_OUT`. Raises `ValidationError` if cart is empty.

### 5.3 `get_available_buyers()`

Returns `BUYER`-role active users in org, optionally filtered by `category_id` + `business_unit_id` scopes. Queries `UserRoleAssignment`, `UserCategoryScope`, `UserBuScope`.

### 5.4 `get_indentor_tracking()`

Returns paginated `Requisition` list scoped to `indentor_id == actor.id`. Supports `status_filter`. Enriches with PO number and GRN status via JOINs.

---

## Phase 6 — API Endpoints

**File**: `app/modules/requisition/router.py` — Append 4 new endpoints:

```
GET  /api/v1/requisitions/indent/buyers       → list_available_buyers()
POST /api/v1/requisitions/indent              → transfer_indent()
POST /api/v1/requisitions/indent/from-cart    → transfer_cart_as_indent()
GET  /api/v1/requisitions/indent/tracking     → get_indent_tracking()
```

All protected by `require_any_permission([PermissionCode.INDENT_TRANSFER])` or `INDENT_VIEW_TRACKING`.

No new Kong routes needed — existing `/api/v1/requisitions` route covers all sub-paths.

---

## Phase 7 — Notification Templates

**File**: `scripts/seed_notification_templates.py` — Add 6 new templates:

| Template Code | Event | Recipients |
|---|---|---|
| `INDENT_TRANSFERRED` | Cart successfully transferred | Indentor |
| `INDENT_BUYER_ASSIGNED` | New indent received | Assigned Buyer |
| `INDENT_APPROVED` | Indent approved | Indentor |
| `INDENT_PO_PLACED` | PO placed for indent | Indentor |
| `INDENT_GOODS_DELIVERED` | GRN raised — confirmation needed | Indentor (consignee) |
| `INDENT_REJECTED` | Indent rejected | Indentor |

---

## Phase 8 — Celery Tasks

**File**: `app/tasks/indent_tasks.py` (new):

```python
@celery_app.task(queue="celery.sla_timers")
async def notify_indentor_on_grn_delivery(grn_id: str, org_id: str) -> None:
    """
    Triggered by GRN creation signal.
    Walks: GRN → PO → PR → checks is_indent + indentor_id.
    Dispatches INDENT_GOODS_DELIVERED notification to indentor.
    """
```

**File**: `app/config.py` — Add 3 new settings (from env vars, no hardcoding):
```python
INDENT_GRN_CONFIRMATION_SLA_HOURS: int = 48
INDENT_AUTO_ASSIGN_BUYER: bool = True
INDENT_MAX_CART_ITEMS: int = 50
```

**File**: `.env.example` — Add:
```dotenv
INDENT_GRN_CONFIRMATION_SLA_HOURS=48
INDENT_AUTO_ASSIGN_BUYER=true
INDENT_MAX_CART_ITEMS=50
```

---

## Phase 9 — Frontend Implementation

> Per FRONTEND_BACKEND_WIRING_GUIDE.md Rule 1: Backend deployed → pnpm generate:types → then write components.

### 9.1 Portal Assignment

Indentor uses **Buyer Portal** (port 3000). No new Next.js app.

### 9.2 New Pages (4 routes)

```
apps/buyer-portal/app/(main)/
└── indents/
    ├── page.tsx           → My Indents Dashboard
    ├── new/
    │   └── page.tsx       → Raise New Indent (3-step wizard)
    ├── [id]/
    │   └── page.tsx       → Indent Detail + Timeline
    └── tracking/
        └── page.tsx       → Delivery Tracking (Consignee)
```

### 9.3 Hook File

**File**: `packages/hooks/src/useIndents.ts`:

```typescript
// Per Wiring Guide Rule 2: always destructure response.data.data
export function useAvailableBuyers(categoryId?, businessUnitId?)
export function useTransferCartAsIndent()
export function useTransferIndent()
export function useIndentTracking(params)
```

### 9.4 Zod Schemas (matching backend exactly)

Per Wiring Guide Rule 8: field names and constraints match Pydantic schemas:

```typescript
const indentTransferSchema = z.object({
  title: z.string().min(5).max(300),
  indent_notes: z.string().max(2000).optional(),
  business_unit_id: z.string().uuid(),
  cost_center_id: z.string().uuid(),
  category_id: z.string().uuid(),
  procurement_type: z.enum(["CAPEX", "OPEX", "PROJECT", "MRO", "SERVICES"]),
  currency: z.string().length(3).default("INR"),
  is_emergency: z.boolean().default(false),
  assigned_buyer_id: z.string().uuid().optional(),
  required_by_date: z.string().optional(),
  delivery_location_id: z.string().uuid().optional(),
  lines: z.array(prLineSchema).min(1).max(100),
});
```

### 9.5 Key UI Components

**My Indents Dashboard (`indents/page.tsx`)**:
- Status filter tabs: All | Submitted | Approved | In Sourcing | Delivered
- Table: Indent # | Title | Items | Value | Assigned Buyer | Status | Required By | Actions
- `PermissionGuard permission="indent.create"` wraps "+ Raise New Indent" CTA
- Empty state with catalog CTA

**Raise New Indent (`indents/new/page.tsx`)** — 3-step wizard:
1. **Step 1 — Cart**: Link to `/marketplace`, show current cart summary
2. **Step 2 — Details**: Form (title, notes, BU, category, cost center, dates)
3. **Step 3 — Buyer Selection**: Filterable list with "Let system auto-assign" option → Review & Transfer

**Indent Detail (`indents/[id]/page.tsx`)**:
- Status timeline (raised → submitted → approved → in sourcing → PO placed → delivered)
- Line items table, buyer card, indent notes, document attachments
- Withdraw button: `PermissionGuard permission="indent.withdraw"` (only for SUBMITTED status)

**Delivery Tracking (`indents/tracking/page.tsx`)**:
- Active deliveries with PO number and expected dates
- Pending GRN confirmation with SLA countdown (using existing `TicketSLAIndicator` pattern)
- Confirm Receipt modal (quantity check + condition notes)

### 9.6 Marketplace Cart Enhancement

**File**: `apps/buyer-portal/app/(main)/marketplace/page.tsx`:

```tsx
{hasPermission("indent.transfer") && cartItems.length > 0 && (
  <PermissionGuard permission="indent.transfer">
    <Button variant="primary" onClick={() => router.push("/indents/new?step=2")}>
      Transfer as Indent ({cartItems.length} items)
    </Button>
  </PermissionGuard>
)}
```

### 9.7 Sidebar Layout

**File**: `apps/buyer-portal/app/(main)/layout.tsx`:

Add Indentor nav section (always visible per sidebar policy — `AccessRestrictedCard` shown on unauthorized access):

```typescript
{ label: "My Indents", href: "/indents", icon: ShoppingCartIcon },
{ label: "Track Deliveries", href: "/indents/tracking", icon: TruckIcon },
```

---

## Phase 10 — Demo User Seed

**File**: `scripts/seed_demo_user.py` — Add:

```python
# Indentor demo user
email="indentor@procurement.com"
first_name="Priya"
last_name="Mehta"
password="Indentor123!@#"  # meets settings.PASSWORD_MIN_LENGTH=12
roles=["INDENTOR"]
employee_id="EMP-IND-001"
```

**README portal table addition**:

| Portal | Local URL | Primary User | Demo Account | Password | Roles |
|---|---|---|---|---|---|
| **Buyer Portal (Indentor)** | http://localhost:3000 | Priya Mehta | `indentor@procurement.com` | `Indentor123!@#` | `INDENTOR` |

---

## Phase 11 — Tests

### 11.1 Unit Tests (`tests/unit/test_indentor_service.py`)

| Test | Assertion |
|---|---|
| `test_create_indent_assigns_buyer_and_submits` | PR status=SUBMITTED, is_indent=True, indentor_id set |
| `test_create_indent_auto_assigns_when_no_buyer_selected` | Buyer auto-assigned via category+BU |
| `test_create_indent_empty_lines_raises` | ValidationError on empty lines |
| `test_cart_transfer_empty_cart_raises` | ValidationError on empty cart |
| `test_get_available_buyers_filters_by_role` | Only BUYER-role users returned |
| `test_get_available_buyers_category_scoped` | Buyers filtered by category |
| `test_get_indentor_tracking_own_only` | Returns only own indents (not others') |
| `test_indentor_cannot_approve_pr` | 403 Forbidden on approve endpoint |

### 11.2 Integration Tests (`tests/integration/test_indentor_flow.py`)

**Three-Persona QA Flow**:
1. `[Indentor]` Browse catalog → Add 3 items
2. `[Indentor]` GET /indent/buyers → Verify buyer list
3. `[Indentor]` POST /indent/from-cart → PR SUBMITTED, is_indent=True
4. `[Buyer]` GET /requisitions → Indent appears in buyer workqueue
5. `[Approver]` POST /requisitions/{id}/approve → PR APPROVED
6. `[Indentor]` GET /indent/tracking → status=APPROVED
7. System GRN creation → INDENT_GOODS_DELIVERED notification fired
8. `[Indentor]` POST /goods-receipts/{id}/confirm → Receipt confirmed

**Additional scenarios**:
- Security: Indentor cannot access approve endpoint (403)
- Security: Indentor cannot see another user's indents (scoped)
- Happy path: Indentor withdraws SUBMITTED indent
- Concurrency: 10 concurrent indents to same cost center — budget reserved correctly

---

## Phase 12 — SPEC Audit Coverage

```
MODULE: SPEC_27 (Indentor Role) | DATE: 2026-09-13

IND.1  [PLAN] Role + 6 permissions                                    → constants.py, seed_master_data.py
IND.2  [PLAN] DB migration 0054 (4 columns, 3 indexes, 1 enum value)  → alembic/versions/0054_indentor_role.py
IND.3  [PLAN] Catalog search (reuses existing catalog module)          → catalog/service.py, router.py
IND.4  [PLAN] Cart management (reuses UserCart model)                 → catalog/service.py
IND.5  [PLAN] Indent transfer (new service method + endpoint)         → requisition/service.py, router.py
IND.6  [PLAN] Cart-to-indent transfer                                 → requisition/service.py, router.py
IND.7  [PLAN] Buyer selection list API                                → requisition/service.py, router.py
IND.8  [PLAN] Indentor tracking API                                   → requisition/service.py, router.py
IND.9  [PLAN] GRN consignee notification (Celery task)                → tasks/indent_tasks.py
IND.10 [PLAN] 6 notification templates                                → seed_notification_templates.py
IND.11 [PLAN] 3 new config settings (no hardcoding)                   → config.py, .env.example
IND.12 [PLAN] 4 Pydantic schemas                                      → requisition/schemas.py
IND.13 [PLAN] 4 frontend pages                                        → buyer-portal/app/(main)/indents/
IND.14 [PLAN] Marketplace cart panel enhancement                      → buyer-portal/marketplace/page.tsx
IND.15 [PLAN] useIndents.ts hook (4 functions)                        → packages/hooks/src/useIndents.ts
IND.16 [PLAN] Zod schemas matching backend constraints                → buyer-portal/indents/new/page.tsx
IND.17 [PLAN] Demo user (indentor@procurement.com)                    → scripts/seed_demo_user.py
IND.18 [PLAN] 8 unit tests                                            → tests/unit/test_indentor_service.py
IND.19 [PLAN] 5 integration tests (3-persona QA flow)                 → tests/integration/test_indentor_flow.py
IND.20 [PLAN] README: portal table, assumptions A-27-*, SPEC audit    → README.md

OVERALL: 0/20 (0%) PLANNED | BACKEND 0% | FRONTEND 0% | TESTS 0%
```

---

## Phase 13 — API Contract Impact Analysis

Per GEMINI.md: PROTOCOL: API CONTRACT CHANGES

**New endpoints** — purely additive, `[NON-BREAKING]`:
- `GET /api/v1/requisitions/indent/buyers`
- `POST /api/v1/requisitions/indent`
- `POST /api/v1/requisitions/indent/from-cart`
- `GET /api/v1/requisitions/indent/tracking`

**Modified schemas** — nullable fields only, `[NON-BREAKING]`:
- `PRDetailResponse` + `PRListResponse`: add `is_indent`, `indentor_id`, `assigned_buyer_id`, `indent_notes`

**Consumers requiring type regeneration**:
- `buyer-portal/requisitions/[id]/page.tsx` — show new fields
- `buyer-portal/requisitions/page.tsx` — show indent badge
- Run: `pnpm generate:types` after backend starts

**Kong**: No changes (existing requisitions route covers all sub-paths).

---

## Phase 14 — Migration Safety Checklist

Per GEMINI.md: PROTOCOL: MIGRATION SAFETY

- ✅ `downgrade()` fully reverses all 4 columns and 3 indexes
- ✅ No table locks — `ADD COLUMN` with nullable/server_default (non-blocking in PostgreSQL 11+)
- ✅ Enum value `INDENT_CART` cannot be reversed (documented in downgrade comment)
- ✅ No application code inside migration (pure DDL)
- ✅ Separate schema migration file (data migration not needed)

---

## Phase 15 — Implementation Checklist (Ordered)

| # | Task | File | Priority |
|---|---|---|---|
| 1 | DB migration `0054_indentor_role.py` | `alembic/versions/` | P0 |
| 2 | Update `Requisition` model (4 columns) | `requisition/models.py` | P0 |
| 3 | Add `INDENT_CART` to `PrSourceEnum` | `app/db/enums.py` | P0 |
| 4 | Add `INDENTOR` to `RoleCode` | `constants.py` | P0 |
| 5 | Add 6 indent permissions + 4 audit actions | `constants.py` | P0 |
| 6 | Update `seed_master_data.py` (role + permissions) | `scripts/` | P0 |
| 7 | Add 4 Pydantic schemas | `requisition/schemas.py` | P1 |
| 8 | Add `create_indent()` method | `requisition/service.py` | P1 |
| 9 | Add `create_indent_from_cart()` method | `requisition/service.py` | P1 |
| 10 | Add `get_available_buyers()` method | `requisition/service.py` | P1 |
| 11 | Add `get_indentor_tracking()` method | `requisition/service.py` | P1 |
| 12 | Add 4 endpoints to router | `requisition/router.py` | P1 |
| 13 | Add 3 config vars | `app/config.py` | P1 |
| 14 | Add 3 env vars to `.env.example` | `.env.example` | P1 |
| 15 | Create `tasks/indent_tasks.py` | `app/tasks/` | P2 |
| 16 | Register Celery task | `app/tasks/celery_app.py` | P2 |
| 17 | Add 6 notification templates | `seed_notification_templates.py` | P2 |
| 18 | `pnpm generate:types` | CLI | P3 |
| 19 | Create `useIndents.ts` hook | `packages/hooks/` | P3 |
| 20 | Create `indents/page.tsx` | `buyer-portal/indents/` | P3 |
| 21 | Create `indents/new/page.tsx` | `buyer-portal/indents/` | P3 |
| 22 | Create `indents/[id]/page.tsx` | `buyer-portal/indents/` | P3 |
| 23 | Create `indents/tracking/page.tsx` | `buyer-portal/indents/` | P3 |
| 24 | Update marketplace cart panel | `buyer-portal/marketplace/` | P3 |
| 25 | Update sidebar layout | `buyer-portal/layout.tsx` | P3 |
| 26 | Add indentor demo user | `seed_demo_user.py` | P4 |
| 27 | Write 8 unit tests | `tests/unit/` | P4 |
| 28 | Write 5 integration tests | `tests/integration/` | P4 |
| 29 | Run `graphify update .` | CLI | P5 |
| 30 | Update README (table, assumptions, SPEC audit) | `README.md` | P5 |

---

## Existing Code Reuse Summary

| Existing Feature | How Indentor Reuses It | Change Required |
|---|---|---|
| `UserCart` + `CartItem` models | Cart management | None |
| `CatalogService.search_catalog()` | Product search | None |
| `CatalogService.add_item_to_cart()` | Cart operations | None |
| `PunchoutSession` | External marketplace | None |
| `Requisition` + `RequisitionLine` | PR creation | +4 nullable columns |
| `WorkflowEngine.instantiate()` | Approval workflow | None |
| `NotificationDispatcher` | All notifications | None |
| `GoodsReceipt` (GRN) | Consignee confirmation | Celery hook added |
| `AuditService` | All audit logging | None |
| `PermissionGuard` (frontend) | All UI protection | None |

**Estimated new code**: ~800 backend LOC + ~600 frontend LOC = **~1,400 LOC total**

The implementation is primarily a **configuration-over-code** addition. All heavy-lifting infrastructure (catalog, cart, PR workflow, notifications, GRN, audit) is reused without modification.
