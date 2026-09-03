# SPEC_19_FRONTEND.md

## Title
Enterprise S2P Procurement Portal — Frontend Architecture

## Purpose
Define the Next.js 14 App Router architecture, three-portal monorepo, component system, key screens, UX patterns, and performance targets.

## Scope
Covers Turborepo monorepo structure, auth implementation, buyer portal screens, supplier portal screens, RFQ wizard state management, CS viewer component, approval inbox, draft autosave, WebSocket notifications, performance targets, and accessibility.

## Dependencies
- SPEC_02_ARCHITECTURE.md (Kong CORS, API prefix)
- SPEC_04_AUTH_SECURITY.md (JWT, session management)
- SPEC_18_API_DESIGN.md (all API endpoints)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Monorepo Structure (Turborepo)

```
procurement-portal-frontend/
├── turbo.json
├── package.json
├── apps/
│   ├── buyer-portal/           # Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx        # Dashboard
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── mfa/page.tsx
│   │   │   ├── requisitions/
│   │   │   ├── rfqs/
│   │   │   ├── evaluations/
│   │   │   ├── contracts/
│   │   │   ├── purchase-orders/
│   │   │   ├── invoices/
│   │   │   ├── vendors/
│   │   │   ├── approvals/
│   │   │   └── settings/
│   │   ├── middleware.ts        # Auth route guard
│   │   └── next.config.ts
│   ├── supplier-portal/        # Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx        # Dashboard
│   │   │   ├── (auth)/
│   │   │   ├── register/
│   │   │   ├── invitations/
│   │   │   ├── bids/
│   │   │   ├── purchase-orders/
│   │   │   ├── invoices/
│   │   │   ├── payments/
│   │   │   └── profile/
│   │   └── middleware.ts
│   └── admin-portal/           # Next.js 14 App Router
│       ├── app/
│       │   ├── users/
│       │   ├── vendors/
│       │   ├── master-data/
│       │   ├── approval-rules/
│       │   ├── unmapped-prs/
│       │   ├── audit-logs/
│       │   ├── integrations/
│       │   ├── analytics/
│       │   └── settings/
│       └── middleware.ts
├── packages/
│   ├── ui/                     # Shared component library
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── data-table.tsx
│   │   │   ├── form-field.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── approval-badge.tsx
│   │   │   ├── sla-countdown.tsx
│   │   │   └── ...
│   │   └── tailwind.config.ts
│   ├── hooks/                  # Shared TanStack Query hooks
│   │   ├── src/
│   │   │   ├── use-requisitions.ts
│   │   │   ├── use-rfqs.ts
│   │   │   ├── use-vendors.ts
│   │   │   ├── use-approvals.ts
│   │   │   ├── use-notifications.ts
│   │   │   ├── use-autosave.ts
│   │   │   └── api-client.ts   # Axios/fetch wrapper with token refresh
│   ├── types/                  # TypeScript types (generated from Pydantic schemas)
│   │   ├── src/
│   │   │   ├── requisition.ts
│   │   │   ├── rfq.ts
│   │   │   ├── vendor.ts
│   │   │   ├── bid.ts
│   │   │   └── ...
│   └── utils/                  # Shared utilities
│       ├── src/
│       │   ├── format-currency.ts
│       │   ├── format-date.ts
│       │   ├── permissions.ts
│       │   └── ...
```

## 2. Auth Implementation

- `next-auth` with custom JWT provider
- Token refresh interceptor in API client: if 401 received → call `/auth/refresh` → retry original request
- Route guards as Next.js middleware: check JWT validity; redirect to `/login` if expired
- Role-based redirect on login: REQUESTOR → buyer portal, SUPPLIER_ADMIN → supplier portal, PROCUREMENT_ADMIN → admin portal

## 3. Buyer Portal Key Screens

**Dashboard:** PR aging widget, RFQ status pipeline, pending approvals count, KPI tiles (spend, savings, cycle time). TanStack Query with 30s background refetch.

**PR Create Form:** React Hook Form + Zod validation. Dynamic line items. Budget check on cost center selection (async API call). Category hierarchical selector (3-level).

**RFQ Wizard (9 steps):** Zustand store `useRFQWizard()` manages step data, validation state, and server-side draft persistence. Progress indicator shows completed/current/pending steps. Back/forward navigation without data loss. Server-side save on each step transition.

**Clarification Center:** Q&A board for RFQ clarifications. Buyer answers; publishes to all bidders. Threaded view.

**Bid Opening Console:** Table showing all submitted bids. Hash verification status per bid (green check/red X). Opening report PDF generation. Co-authorization flow (if required).

**Technical Evaluation Matrix:** Evaluator assigns scores per criterion per bid. Max score validation. Remarks field. Auto-calculate weighted total.

**CS Viewer:** Sticky header table with frozen first column (item description). Bidder columns. Color-coded rank: green=L1, yellow=L2, orange=L3. Hover tooltip: raw price → freight → tax → landed cost → NPV-adjusted breakdown. Export to Excel/PDF buttons.

**Approval Inbox:** Split layout (list left, detail right). Unified for all entity types. Filter chips: PR, RFQ, PO, Invoice, Vendor. SLA countdown badges (green >50%, amber 50-100%, red >100%). Bulk approve checkbox for low-risk items (configurable).

**Invoice Review:** Split view: invoice detail on left, 3-way match results on right. Color-coded match indicators. Dispute creation inline.

## 4. Supplier Portal Key Screens

**Registration Wizard:** Multi-step form: Company Info → Address → Tax Registration → Bank Details → Documents → Category Selection → Review & Submit. Progress bar. Server-side draft save.

**Invitation Inbox:** Cards showing open RFQ invitations. Countdown timer to bid deadline. Accept/Regret buttons. RFQ details expandable.

**Bid Form:** Commercial line-by-line pricing. Technical document upload (2-envelope). Draft autosave indicator. Preview before submit. Version history (if reopened).

**PO Acceptance:** PO PDF viewer. Acknowledge/Reject buttons. Reject requires comment.

**Invoice Submission:** Select eligible PO lines. Pre-filled quantities from GRN. Tax calculation. Document upload. Preview.

**Payment Tracking:** Table: invoice number, amount, due date, payment status, UTR. Filter by status. Raise dispute button for overdue.

## 5. RFQ Wizard State Management

```typescript
// packages/hooks/src/use-rfq-wizard.ts

interface RFQWizardState {
  rfqId: string | null;
  currentStep: number;
  stepData: Record<number, any>;
  stepValidation: Record<number, boolean>;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
}

const useRFQWizard = create<RFQWizardState>((set, get) => ({
  // Step validation before advance
  // Server-side draft save on each step via PATCH /rfqs/{id}/wizard/{step}
  // Progress indicator derived from stepValidation
  // Back/forward navigation preserves stepData
}));
```

## 6. Draft Autosave Hook

```typescript
function useAutosave<T>(entityId: string, data: T, saveFn: (data: T) => Promise<void>) {
  // Debounce 30s
  // Track dirty state
  // Show "Draft saved at HH:MM" in form header
  // Handle save errors gracefully (retry once, then show error toast)
}
```

## 7. WebSocket Notification Client

```typescript
function useNotifications(userId: string) {
  // Connect to /ws/notifications/{userId}?token={oneTimeToken}
  // Reconnect on disconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
  // On message: show toast notification, increment unread count
  // Notification bell component with unread badge (count from Redis)
}
```

## 8. Performance Targets

| Metric | Target |
|---|---|
| LCP (Largest Contentful Paint) | < 2.5 seconds |
| FID (First Input Delay) | < 100 milliseconds |
| CLS (Cumulative Layout Shift) | < 0.1 |

**Techniques:** Next.js image optimization, code splitting per route, TanStack Query background refetch, skeleton loaders for all data-fetching states, virtual scrolling for large tables (1000+ rows).

## 9. Accessibility

WCAG 2.1 AA compliance. Radix UI provides ARIA attributes. Keyboard navigation for all interactive elements. Screen reader tested. Color contrast ratios verified. Focus management in modals and wizards.
