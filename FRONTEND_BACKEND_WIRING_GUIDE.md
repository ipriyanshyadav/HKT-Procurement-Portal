# FRONTEND ↔ BACKEND WIRING MASTER GUIDE
# Read this before implementing ANY module. Violations here caused the previous project failure.

---

## ROOT CAUSE OF PREVIOUS FAILURE
Frontend was built independently: components assumed API shapes, used hardcoded mock data,
missed auth flows, ignored DB column names, and had no Docker networking. This guide prevents that.

---

## RULE 1: TYPES FIRST — ALWAYS

**Never write a frontend component before the backend API is deployed and its OpenAPI spec confirmed.**

Workflow for every module:
```bash
# Step A: Implement backend router + service (SPEC_XX backend steps)
# Step B: Start backend and confirm OpenAPI spec
curl http://localhost:8000/api/v1/openapi.json | jq '.paths | keys'

# Step C: Generate TypeScript types FROM the spec (not hand-written)
cd procurement-portal-frontend
pnpm generate:types  # runs: openapi-typescript http://localhost:8000/api/v1/openapi.json -o packages/types/src/api.ts

# Step D: ONLY THEN write frontend components using the generated types
```

**`packages/types/generate.ts`** — must be run before any frontend build:
```typescript
import { generateTypes } from 'openapi-typescript';
import { writeFileSync } from 'fs';

const spec = await fetch('http://localhost:8000/api/v1/openapi.json').then(r => r.json());
const types = await generateTypes(spec);
writeFileSync('./packages/types/src/api.ts', types);
```

---

## RULE 2: RESPONSE ENVELOPE MUST MATCH

Every API returns `{ data: T, meta?: PaginationMeta, links?: Links }`.
Frontend hooks MUST destructure `response.data.data` (not `response.data`):

```typescript
// CORRECT
const { data: response } = useQuery({ queryKey: ['prs'], queryFn: () => apiClient.get('/requisitions') });
const prs = response?.data.data;   // response.data = APIResponse, .data = the actual list

// WRONG (previous project bug)
const prs = response?.data;        // This is the envelope, not the list
```

All TanStack Query hooks in `packages/hooks/` MUST follow this pattern.

---

## RULE 3: DOCKER NETWORK — ALL SERVICES ON SAME NETWORK

`docker/docker-compose.yml` defines network `procurement_net`. ALL services join it:
```yaml
networks:
  procurement_net:
    driver: bridge

services:
  api:         { networks: [procurement_net] }
  buyer-portal:{ networks: [procurement_net] }
  supplier-portal: { networks: [procurement_net] }
  admin-portal:    { networks: [procurement_net] }
  postgres:    { networks: [procurement_net] }
  redis:       { networks: [procurement_net] }
  rabbitmq:    { networks: [procurement_net] }
  minio:       { networks: [procurement_net] }
  kong:        { networks: [procurement_net] }
```

Frontend containers use service names, NOT localhost:
```yaml
# apps/buyer-portal/Dockerfile
ENV NEXT_PUBLIC_API_URL=http://kong:8000     # Kong gateway (internal)
ENV NEXT_PUBLIC_WS_URL=ws://api:8000         # Direct to API for WebSocket

# docker-compose.yml buyer-portal service:
environment:
  NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}  # External for browser
  INTERNAL_API_URL: http://api:8000   # Internal for SSR
```

**CRITICAL**: Browser JavaScript uses `NEXT_PUBLIC_API_URL` (host machine address).
Next.js SSR uses `INTERNAL_API_URL` (Docker service name). These are DIFFERENT.

---

## RULE 4: ENVIRONMENT VARIABLE CONTRACT

Every new env var added to backend `app/config.py` MUST be:
1. Added to `.env.example` immediately
2. Added to `docker/docker-compose.yml` under the affected service
3. Added to `k8s/base/configmap.yaml` or `k8s/base/sealed-secrets/`
4. Frontend env vars prefixed `NEXT_PUBLIC_` for browser access

**Frontend `.env.example`** (maintained alongside backend `.env.example`):
```bash
# Browser-accessible (NEXT_PUBLIC_ prefix required by Next.js)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Server-side only (SSR / API routes)
INTERNAL_API_URL=http://api:8000
```

---

## RULE 5: AUTH FLOW — COOKIE + MEMORY TOKEN

This was the previous project's #1 integration bug.

**Backend sets**: `refresh_token` as httpOnly cookie, access_token in response body.
**Frontend stores**: access_token in Zustand memory (NOT localStorage, NOT sessionStorage).
**Every API call**: Axios interceptor attaches `Authorization: Bearer {accessToken}` from memory.
**On 401**: Axios interceptor calls `/auth/refresh` (cookie sent automatically via `withCredentials: true`),
            gets new access_token, updates Zustand, retries original request.

```typescript
// packages/stores/authStore.ts — THE SINGLE SOURCE OF TRUTH FOR AUTH STATE
import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  user: CurrentUser | null;
  permissions: string[];
  orgId: string | null;
  isAuthenticated: boolean;
  setAccessToken: (token: string) => void;
  setUser: (user: CurrentUser, permissions: string[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  permissions: [],
  orgId: null,
  isAuthenticated: false,
  setAccessToken: (token) => set({ accessToken: token, isAuthenticated: true }),
  setUser: (user, permissions) => set({ user, permissions, orgId: user.org_id }),
  logout: () => set({ accessToken: null, user: null, permissions: [], orgId: null, isAuthenticated: false }),
}));
```

**Next.js Middleware** (`apps/*/middleware.ts`) checks for `refresh_token` cookie to protect routes.
If no cookie → redirect to `/login`. Cookie is set by backend — frontend NEVER sets it.

---

## RULE 6: WEBSOCKET WIRING

WebSocket endpoint: `GET /ws/notifications?token={access_token}` (JWT in query param).

```typescript
// packages/hooks/useNotifications.ts
// Called in apps/buyer-portal/app/layout.tsx (root layout, runs once on mount)
// DO NOT call in individual pages — only in root layout

// WebSocket URL must use NEXT_PUBLIC_WS_URL (ws:// not http://)
const WS_URL = process.env.NEXT_PUBLIC_WS_URL?.replace('http', 'ws') ?? 'ws://localhost:8000';
```

Backend WebSocket registered in `app/main.py`:
```python
app.add_api_websocket_route("/ws/notifications", ws_manager.handle_connection)
```
Kong MUST pass WebSocket upgrades — configure Kong with `upgrade: websocket` on this route.

---

## RULE 7: DATABASE COLUMN NAMES → API FIELD NAMES → FRONTEND FIELD NAMES

The chain must be consistent. Example:
```
DB column:     business_unit_id     (snake_case, always)
Pydantic:      business_unit_id     (snake_case, matches DB)
API response:  business_unit_id     (FastAPI returns snake_case by default)
TypeScript:    business_unit_id     (generated from OpenAPI — do NOT rename)
```

**NEVER** add `model_config = ConfigDict(alias_generator=to_camel)` to Pydantic models
unless the API design spec explicitly requires camelCase. Keep snake_case end-to-end.
Previous project had a mismatch here that broke all form submissions.

---

## RULE 8: FORM SUBMISSION → API SHAPE MUST MATCH EXACTLY

For every form component:
1. Look at the backend Pydantic `CreateRequest` schema
2. React Hook Form field names must EXACTLY match request schema field names
3. Zod validation schema must enforce the SAME constraints as Pydantic

Example for PR creation:
```typescript
// Backend schema (requisition/schemas.py):
class PRCreateRequest(BaseModel):
    title: str  # min 3, max 200
    business_unit_id: UUID
    category_id: UUID
    is_capex: bool = False
    lines: list[PRLineCreateRequest]

// Frontend Zod schema (MUST match):
const prCreateSchema = z.object({
  title: z.string().min(3).max(200),
  business_unit_id: z.string().uuid(),
  category_id: z.string().uuid(),
  is_capex: z.boolean().default(false),
  lines: z.array(prLineSchema).min(1),
});
// Type inference from schema — NOT from hand-written interface
type PRCreateForm = z.infer<typeof prCreateSchema>;
```

---

## RULE 9: PAGINATION — STANDARD QUERY PARAMS

All list endpoints accept `page`, `page_size`, `sort_by`, `sort_dir`.
All TanStack Table instances must pass these as query params:

```typescript
// packages/hooks/useRequisitions.ts
export function useRequisitions(params: {
  page?: number; page_size?: number; status?: string; sort_by?: string; sort_dir?: 'asc'|'desc';
}) {
  return useQuery({
    queryKey: ['requisitions', params],
    queryFn: () => apiClient.get<APIResponse<PRResponse[]>>('/requisitions', { params }),
    select: (res) => ({
      data: res.data.data,
      meta: res.data.meta,
    }),
  });
}
```

---

## RULE 10: DOCKER-COMPOSE STARTUP ORDER

Services MUST start in correct dependency order:
```yaml
services:
  postgres:    { healthcheck: { test: ["CMD", "pg_isready"] } }
  redis:       { healthcheck: { test: ["CMD", "redis-cli", "ping"] } }
  rabbitmq:    { healthcheck: { test: ["CMD", "rabbitmq-diagnostics", "check_port_connectivity"] } }
  minio:       { healthcheck: { test: ["CMD", "mc", "ready", "local"] } }
  api:
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
      minio:    { condition: service_healthy }
  celery-worker:
    depends_on:
      api: { condition: service_started }  # API must run migrations first
  buyer-portal:
    depends_on:
      api: { condition: service_started }  # Needs OpenAPI spec for type generation
```

**API container entrypoint**: runs migrations THEN starts uvicorn:
```bash
# docker/entrypoint.sh
#!/bin/bash
set -e
echo "Running database migrations..."
alembic upgrade head
echo "Seeding master data..."
python scripts/seed_master_data.py
echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## RULE 11: MINIOPREVIEW URLS — PRESIGNED, NOT DIRECT

Frontend NEVER constructs MinIO URLs directly.
Always call `GET /api/v1/documents/{id}/presigned-url` → backend returns 15-min presigned URL.

```typescript
// CORRECT
const { data: urlData } = useQuery({
  queryKey: ['doc-url', documentId],
  queryFn: () => apiClient.get<{url: string}>(`/documents/${documentId}/presigned-url`),
  staleTime: 14 * 60 * 1000,  // 14 min — just under 15-min presigned TTL
});
<a href={urlData?.data.data.url}>Download</a>

// WRONG (previous bug — direct MinIO URL exposed)
<a href={`http://minio:9000/${bucket}/${path}`}>Download</a>
```

---

## RULE 12: PERMISSION GUARD ON EVERY PROTECTED UI ELEMENT

Every button, form, and action that calls a protected API MUST have a `PermissionGuard`:
```tsx
// If user lacks permission — button hidden, not just disabled
<PermissionGuard permission="pr.approve">
  <Button onClick={handleApprove}>Approve</Button>
</PermissionGuard>

// For whole pages — use Next.js middleware (not client-side check)
// apps/buyer-portal/middleware.ts checks required permissions per route
```

Permission list comes from JWT `permissions` field (loaded by `GET /api/v1/users/me/permissions`
on login, stored in Zustand, refreshed on token refresh).

---

## MODULE IMPLEMENTATION ORDER (STRICT — DEPENDENCY GRAPH)

```
Level 0: SPEC_01 (scaffolding) → SPEC_02 (arch) → SPEC_03 (DB) → SPEC_24 (master data)
Level 1: SPEC_04 (auth) → SPEC_05 (workflow) → SPEC_06 (rules)
Level 2: SPEC_07 (vendor) → SPEC_08 (PR) → SPEC_09 (unmapped PR)
Level 3: SPEC_10 (RFQ) → SPEC_11 (bids) → SPEC_12 (CS/evaluation)
Level 4: SPEC_13 (contract) → SPEC_14 (PO) → SPEC_15 (invoice/payment)
Level 5: SPEC_16 (notifications) → SPEC_17 (documents)
Level 6: SPEC_18 (API standards) — applied retroactively to all previous modules
Level 7: SPEC_19 (frontend) — implements UI FOR EACH MODULE in order above
Level 8: SPEC_20 (integration) → SPEC_21 (infra) → SPEC_22 (observability)
Level 9: SPEC_23 (testing) → SPEC_25 (analytics)
```

**SPEC_19 (Frontend) is implemented IN PARALLEL with each module at its level.**
For example: implement SPEC_07 backend → generate types → implement Vendor UI → move to SPEC_08.
Do NOT batch all frontend work to the end.

---

## FRONTEND DOCKER SERVICE DEFINITIONS

Add to `docker/docker-compose.yml` alongside backend services:

```yaml
  buyer-portal:
    build:
      context: ../procurement-portal-frontend
      dockerfile: apps/buyer-portal/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
        NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:8000}
    ports: ["3000:3000"]
    environment:
      INTERNAL_API_URL: http://api:8000
      NODE_ENV: production
    depends_on:
      api: { condition: service_started }
    networks: [procurement_net]

  supplier-portal:
    build:
      context: ../procurement-portal-frontend
      dockerfile: apps/supplier-portal/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
        NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:8000}
    ports: ["3001:3001"]
    environment:
      INTERNAL_API_URL: http://api:8000
      PORT: "3001"
    depends_on:
      api: { condition: service_started }
    networks: [procurement_net]

  admin-portal:
    build:
      context: ../procurement-portal-frontend
      dockerfile: apps/admin-portal/Dockerfile
    ports: ["3002:3002"]
    environment:
      INTERNAL_API_URL: http://api:8000
      PORT: "3002"
    depends_on:
      api: { condition: service_started }
    networks: [procurement_net]
```

## FRONTEND DOCKERFILES

```dockerfile
# apps/buyer-portal/Dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/buyer-portal/ ./apps/buyer-portal/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
# Generate TypeScript types from running backend BEFORE building
RUN pnpm --filter buyer-portal generate:types || echo "Skipping type gen in build"
RUN pnpm --filter buyer-portal build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/buyer-portal/.next/standalone ./
COPY --from=builder /app/apps/buyer-portal/.next/static ./apps/buyer-portal/.next/static
COPY --from=builder /app/apps/buyer-portal/public ./apps/buyer-portal/public
EXPOSE 3000
CMD ["node", "apps/buyer-portal/server.js"]
```
