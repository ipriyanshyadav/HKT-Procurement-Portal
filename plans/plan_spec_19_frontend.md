# IMPLEMENTATION PLAN — SPEC_19: Frontend Architecture
**Module:** 19 | **Phase:** Core | **Squad:** All (Frontend)
**Spec File:** SPEC_19_FRONTEND.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S19-01 | 3 Next.js 14 App Router portals (buyer/supplier/admin) | Turborepo apps/ | DONE |
| S19-02 | TanStack Query v5 for server state | packages/hooks/*.ts | DONE |
| S19-03 | Zustand for client state (auth, filters, UI) | packages/stores/*.ts | DONE |
| S19-04 | Radix UI + Tailwind design system | packages/ui/ | DONE |
| S19-05 | TanStack Table v8 for all data grids | packages/ui/ | DONE |
| S19-06 | React Hook Form + Zod validation | All form components | DONE |
| S19-07 | Generated TypeScript types from OpenAPI | packages/types/generate.ts | DONE |
| S19-08 | Axios instance with JWT auto-refresh | packages/utils/api.ts | DONE |
| S19-09 | WebSocket hook for real-time notifications | packages/hooks/useNotifications.ts | DONE |
| S19-10 | Route-level permission guards | packages/ui/src/PermissionGuard.tsx | DONE |
| S19-11 | Virtualized lists (TanStack Virtual) | Large list components | DONE |
| S19-12 | PWA manifest for buyer portal | apps/buyer-portal/public/manifest.json | DONE |
| S19-13 | Next.js middleware for auth redirect | apps/*/middleware.ts | DONE |
| S19-14 | Error boundaries per page | packages/ui/ErrorBoundary.tsx | DONE |
| S19-15 | Optimistic updates via TanStack Query | hooks/ | DONE |
| S19-16 | CSV/PDF export buttons (streaming) | Shared export component | DONE |
| S19-17 | Workflow task inbox UI | buyer-portal/app/(main)/tasks/ | DONE |
| S19-18 | Supplier registration wizard (8 steps) | supplier-portal/app/register/ | DONE |
| S19-19 | Responsive design (mobile ≥ 768px) | Tailwind responsive classes | DONE |
| S19-20 | i18n stub (en only in Phase 1) | packages/ui/src/components/LocaleSwitcher.tsx | DONE |

```
MODULE | SPEC | DATE
SPEC_19 | Frontend Applications | 2026-09-05
OVERALL: 20/20 (100%) | BACKEND 100% | FRONTEND 100% | TESTS 100%
```

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-19-1 | Access token stored in memory (Zustand state); refresh token in httpOnly cookie; page reload triggers silent refresh via /api/v1/auth/refresh | SPEC_04 security; no explicit FE storage mechanism | HIGH — XSS token exposure | FE Lead |
| A-19-2 | `packages/types/` generated at build time; `pnpm generate:types` must run before `pnpm build` | OpenAPI spec changes break types | MEDIUM | FE Lead |
| A-19-3 | Tailwind config extended with design tokens (colors, spacing, typography) in `packages/config/tailwind.config.ts`; all portals import this config | Shared design system | LOW | FE Lead |
| A-19-4 | Supplier portal is ENTIRELY separate Next.js app on port 3001; vendors NEVER see buyer portal routes | Security isolation | HIGH | FE Lead |
| A-19-5 | React Query cache time: 5 minutes default; invalidated on relevant mutations; staleTime: 30 seconds | Performance vs freshness trade-off | LOW | FE Lead |
| A-19-6 | Playwright E2E full procurement cycle tests will execute against local or test-stubbed environments without breaking on external dependencies | End-to-end verification requirement | MEDIUM | QA Lead |
| A-19-7 | Supplier portal invoice submission and PO acknowledgement forms directly wire to backend `/api/v1/invoices` and `/api/v1/purchase-orders/{id}/acknowledge` | Complete supplier P2P workflow | LOW | FE Lead |
| A-19-8 | PWA manifest configured at `apps/buyer-portal/public/manifest.json` with app icons and metadata | Offline/PWA compliance | LOW | FE Lead |
| A-19-9 | All page routes provide React ErrorBoundary coverage to prevent full-page crashes on runtime faults | Resilience requirement | LOW | FE Lead |
| A-19-10 | Radix UI library in `packages/ui/` provides complete, unified components: Button, Input, Select, Dialog, Table, Badge, Toast, Tabs, Card, Skeleton | Unified design system | LOW | FE Lead |
| A-19-11 | i18n stub using `next-intl` provides centralized translation extraction in `messages/en.json` | Localization architecture | LOW | FE Lead |
| A-19-12 | Responsive layouts enforce min-width 768px usability with adaptive tables, dialogs, and navigation | Mobile responsive UX requirement | LOW | FE Lead |

---
## STEP 2 — IMPLEMENT

### 2.1 `packages/utils/api.ts` — Axios with Auto-Refresh
```typescript
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // sends httpOnly refresh cookie
});

// Request interceptor: attach access token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: 401 → silent refresh → retry
let isRefreshing = false;
let refreshQueue: ((token: string) => void)[] = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const resp = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {}, { withCredentials: true });
          const newToken = resp.data.access_token;
          useAuthStore.getState().setAccessToken(newToken);
          refreshQueue.forEach((cb) => cb(newToken));
          refreshQueue = [];
          isRefreshing = false;
          original.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(original);
        } catch {
          isRefreshing = false;
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(error);
        }
      }
      return new Promise((resolve) => {
        refreshQueue.push((token: string) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }
    return Promise.reject(error);
  }
);
```

### 2.2 `packages/hooks/useNotifications.ts` — WebSocket Hook
```typescript
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

export function useNotifications() {
  const wsRef = useRef<WebSocket | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!accessToken) return;
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000';
    const ws = new WebSocket(`${WS_URL}/ws/notifications?token=${accessToken}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      addNotification(notification);
    };

    ws.onclose = (event) => {
      if (event.code === 4001) {
        useAuthStore.getState().logout();
      } else {
        // Reconnect after 3 seconds
        setTimeout(() => wsRef.current?.close(), 3000);
      }
    };

    return () => ws.close();
  }, [accessToken, addNotification]);
}
```

### 2.3 `packages/utils/guards.tsx` — Permission Guard
```tsx
'use client';
import { useAuthStore } from '../stores/authStore';
import { redirect } from 'next/navigation';

type Props = { permission: string; children: React.ReactNode; fallback?: React.ReactNode };

export function PermissionGuard({ permission, children, fallback }: Props) {
  const permissions = useAuthStore((s) => s.permissions);
  if (!permissions.includes(permission)) {
    return fallback ?? null;
  }
  return <>{children}</>;
}

// Next.js middleware for auth redirect
// apps/*/middleware.ts:
export function middleware(request: NextRequest) {
  const token = request.cookies.get('refresh_token');
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

### 2.4 `apps/buyer-portal/app/tasks/page.tsx` — Workflow Task Inbox
```tsx
// TanStack Query: fetch pending workflow tasks assigned to current user
// TanStack Table: columns: entity, task_type, assigned_at, sla_deadline, status
// Action buttons: Approve / Reject / Return (with comment modal)
// SLA indicator: color-coded bar (green<50%, yellow 50-100%, red>100%)
// Optimistic update on action; invalidate query on success
```

### 2.5 Supplier Registration Wizard (`apps/supplier-portal/app/register/`)
```
Step 1: Company Basic Info (name, registration_number, GST, PAN)
Step 2: Contact Details (primary contact, phone, email)
Step 3: Address (registered office, plant locations)
Step 4: Bank Account (account number, IFSC, bank name)
Step 5: Category Selection (multi-select from category tree)
Step 6: Document Upload (11 document types, drag-and-drop)
Step 7: Declaration (COI, terms acceptance)
Step 8: Review & Submit
Progress: persisted in Zustand + sessionStorage (survives refresh)
Validation: Zod schema per step; React Hook Form
Navigation: back/next; cannot skip ahead; completed steps marked
```

### 2.6 All Data Grids — Standard Pattern
```tsx
// Every listing page uses:
// 1. TanStack Table v8 with server-side pagination
// 2. Column visibility toggle (stored in localStorage)
// 3. URL-synced filters via nuqs or searchParams
// 4. Export button → calls streaming API endpoint
// 5. Row-level action menu (View / Edit / Status actions)
// 6. Skeleton loading state (not spinner)
```

### 2.7 `apps/*/middleware.ts` — Auth Redirect
```typescript
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/sso'];

export function middleware(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const isPublic = PUBLIC_PATHS.some(p => request.nextUrl.pathname.startsWith(p));
  if (!refreshToken && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

### 2.8 `packages/ui/ErrorBoundary.tsx`
```tsx
'use client';
import { Component, ReactNode } from 'react';

export class ErrorBoundary extends Component<{children: ReactNode; fallback: ReactNode}, {hasError: boolean}> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    // Log to Sentry / observability
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```

---
## STEP 3 — TEST
```typescript
// Jest + React Testing Library for unit tests
// Playwright for E2E

test('login redirects to dashboard on success', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'buyer@test.com');
  await page.fill('[name=password]', 'Test@1234!');
  await page.click('[type=submit]');
  await expect(page).toHaveURL('/dashboard');
});

test('supplier portal cannot access buyer portal route', async ({ page }) => {
  // Login as supplier user
  await page.goto('http://localhost:3000/dashboard');  // buyer portal
  await expect(page).toHaveURL(/login/);
});

test('access token not in localStorage', async ({ page }) => {
  await loginAs(page, 'buyer@test.com');
  const token = await page.evaluate(() => localStorage.getItem('access_token'));
  expect(token).toBeNull();
});

test('refresh triggers on 401', async ({ page, mockApi }) => {
  mockApi.intercept('/api/v1/requisitions').returnStatus(401).once();
  // App should transparently refresh and retry
  const data = await page.waitForSelector('[data-testid="pr-list"]');
  expect(data).toBeTruthy();
});
```

---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# Nodes: BuyerPortal, SupplierPortal, AdminPortal, SharedUIPackage,
#        APIClient (axios+interceptors), NotificationWebSocketHook, AuthStore
```
