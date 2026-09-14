# IMPLEMENTATION PROMPT 25 — Developer Platform (SPEC_28)

Execute the complete implementation for `plans/plan_spec_28_developer_platform.md`.
Follow ALL GEMINI.md ABSOLUTE RULES. Do not stop until Steps 2–6 are fully verified.

---
## MANDATORY PRE-FLIGHT
```bash
graphify check --before-change
alembic current  # Must show 0044 (SPEC_27 head)
pytest tests/ -v --tb=no -q  # Full suite green
# Verify API key management from SPEC_27 is working (developer platform depends on it)
curl -s http://localhost:8000/api/v1/api-keys -H "Authorization: Bearer ${ADMIN_TOKEN}" | python -c "import sys,json; d=json.load(sys.stdin); print('API keys endpoint OK:', 'data' in d)"
```

---
## STEP 2 — IMPLEMENT (exact order)

### Part A: Main DB Migrations
1. `0046_developer_accounts.py` — developer_accounts + sandbox_orgs tables
2. `0047_api_changelog.py` — api_changelog table
3. `0048_doc_pages.py` — doc_pages table
4. `0049_sdk_downloads.py` — sdk_downloads table
5. `0050_dev_indexes.py` — ALL CONCURRENTLY indexes for 4 new tables
```bash
alembic upgrade head && alembic current  # Must show 0050
```

### Part B: Developer Platform FastAPI App Structure
6. Create directory structure:
```bash
mkdir -p developer_platform/{auth,sandbox,changelog,docs,rate_limits,sdks}
touch developer_platform/__init__.py developer_platform/main.py developer_platform/config.py
touch developer_platform/auth/{__init__.py,jwt.py,service.py,router.py,schemas.py}
touch developer_platform/sandbox/{__init__.py,seed_data.py,service.py,router.py,schemas.py}
touch developer_platform/changelog/{__init__.py,models.py,service.py,router.py,schemas.py}
touch developer_platform/docs/{__init__.py,models.py,service.py,router.py,schemas.py}
touch developer_platform/rate_limits/{__init__.py,service.py,router.py,schemas.py}
touch developer_platform/sdks/{__init__.py,service.py,router.py,schemas.py}
```

7. **`developer_platform/config.py`** — all settings as Pydantic BaseSettings:
   - DEV_PORTAL_JWT_PRIVATE_KEY_PATH, DEV_PORTAL_JWT_PUBLIC_KEY_PATH
   - DEV_PORTAL_JWT_EXPIRE_HOURS: int = 24
   - SANDBOX_DATABASE_URL (separate PostgreSQL DB)
   - DEV_PORTAL_GOOGLE_CLIENT_ID, DEV_PORTAL_GOOGLE_CLIENT_SECRET
   - DEV_PORTAL_GITHUB_CLIENT_ID, DEV_PORTAL_GITHUB_CLIENT_SECRET
   - SDK_DOWNLOAD_BASE_URL, OPENAPI_SPEC_URL
   - CHANGELOG_RSS_TITLE, CHANGELOG_RSS_BASE_URL
   - ZERO hardcoded values — all from environment

8. **`developer_platform/auth/jwt.py`** — SEPARATE RS256 JWT functions:
   - `create_dev_token(developer_id, email, is_internal, sandbox_org_id)` — uses DEV_PORTAL_JWT_PRIVATE_KEY
   - `decode_dev_token(token)` — uses DEV_PORTAL_JWT_PUBLIC_KEY
   - `get_current_developer(token)` — FastAPI dependency
   - RULE: Dev tokens CANNOT be used on main procurement /api/v1/ endpoints
   - RULE: Main procurement tokens CANNOT be used on /dev/ endpoints
   - Generate separate RSA keypair: `python scripts/generate_dev_portal_keys.py`

9. **`developer_platform/auth/service.py`** — DevAuthService:
   - `signup(email, password, full_name, company)` → creates account + sandbox org + sends verification email
   - `verify_email(token)` → marks verified + seeds sandbox data
   - `login(email, password)` → validates + issues dev JWT
   - `google_oauth_callback(code)` → Google OIDC flow via authlib
   - `github_oauth_callback(code)` → GitHub OAuth flow via authlib
   - All methods: zero hardcoded values, all config from developer_platform/config.py

10. **`developer_platform/auth/router.py`** — 6 endpoints:
    - POST /dev/auth/signup
    - POST /dev/auth/verify-email
    - POST /dev/auth/login
    - GET  /dev/auth/google → redirect to Google OAuth
    - GET  /dev/auth/google/callback → handle Google OAuth callback
    - GET  /dev/auth/github/callback → handle GitHub callback
    - POST /dev/auth/resend-verification

11. **`developer_platform/sandbox/seed_data.py`** — SandboxSeeder using Faker:
    - `seed_sandbox(org_id: UUID)` — generates ALL seed data:
      - 5 Business Units with Indian division names
      - 20 Users across 10 different roles
      - 15 Vendors in various statuses (ACTIVE, QUALIFIED, SUSPENDED, COMPLIANCE_HOLD)
      - 50 PRs spread across all statuses and amounts
      - 10 RFQs (some PUBLISHED, some BID_OPEN, some AWARDED)
      - 20 Bids across the RFQs
      - 5 Contracts (ACTIVE, EXPIRING, EXPIRED)
      - 10 Purchase Orders
      - 10 Invoices (FULL_MATCH, DISCREPANCY, PAID states)
    - All email addresses redirect to /dev/null (no real emails)
    - RULE: Faker used for ALL fake data — zero hardcoded names/emails/GSTINs

12. **`developer_platform/sandbox/service.py`** — SandboxService:
    - `reset(db, sandbox_org_id, developer_id)` — truncates + reseeds, increments reset_count
    - `time_travel(sandbox_org_id, advance_by_days)` — stores offset in Redis (max 365 days)
    - `get_status(db, sandbox_org_id)` — entity counts per table
    - `run_scenario(db, scenario_id, sandbox_org_id)` — 5 pre-built scenarios
    - `_scenario_pr_to_po(db, org_id)` — executes full PR→RFQ→Bid→Award→PO flow in sandbox
    - `_scenario_vendor_blacklist(db, org_id)` — dual-approval blacklisting
    - `_scenario_invoice_discrepancy(db, org_id)` — 3-way match failure + dispute
    - `_scenario_sla_breach(db, org_id)` — advances time + checks workflow SLA
    - `_scenario_contract_expiry(db, org_id)` — contract expiry alert flow

13. **`developer_platform/changelog/models.py`** — APIChangelog SQLAlchemy model
14. **`developer_platform/changelog/service.py`** — ChangelogService:
    - `get_published(db, limit)` → list of published entries
    - `get_rss_feed(db)` → RSS 2.0 XML string using feedgen library
    - `get_atom_feed(db)` → Atom 1.0 XML using feedgen
    - `get_deprecation_headers(db, endpoint)` → dict of deprecation headers or None
    - `create(db, data, author)` → create draft entry
    - `publish(db, entry_id)` → set is_published=True, published_at=now()
    - RULE: RSS/Atom feeds use `settings.CHANGELOG_RSS_BASE_URL` — NOT hardcoded URL

15. **`developer_platform/changelog/router.py`** — 8 endpoints (4 public, 4 admin):
    - GET /dev/changelog (public, no auth)
    - GET /dev/changelog/{version} (public)
    - GET /dev/changelog/rss (public, Content-Type: application/rss+xml)
    - GET /dev/changelog/atom (public, Content-Type: application/atom+xml)
    - POST /dev/admin/changelog (requires dev admin auth)
    - PUT  /dev/admin/changelog/{id}
    - POST /dev/admin/changelog/{id}/publish
    - GET  /dev/admin/changelog/deprecations

16. **Wire deprecation headers into main API** — `app/core/deprecation.py`:
    - Update `add_deprecation_headers()` to fetch sunset dates from `api_changelog.deprecations` JSONB
    - NOT hardcoded dates: `sunset_date = await changelog_service.get_sunset_for_endpoint(db, endpoint)`
    - Cache result in Redis (key: `deprecation:{endpoint}`, TTL: 1 hour)

17. **`developer_platform/rate_limits/service.py`** — RateLimitDashboardService:
    - `get_current_quota(api_key_id, org_id)` — reads Redis rate limit counters (real-time)
    - `get_usage_timeseries(api_key_id, hours, bucket_minutes)` — queries api_key_usage_log (DB)
    - `get_throttle_events(api_key_id, days)` — queries api_key_usage_log WHERE status_code=429
    - `get_top_endpoints(api_key_id, limit)` — GROUP BY endpoint, ORDER BY COUNT DESC
    - `get_org_overview(org_id)` — aggregate across all org's API keys

18. **`developer_platform/docs/service.py`** — DocService:
    - `get_by_slug(db, slug)` → DocPage or 404
    - `get_by_category(db, category)` → list of pages in category
    - `create(db, data, author)` → create draft doc
    - `publish(db, page_id)` → publish
    - `get_platform_status()` → fetches uptime data from Prometheus healthcheck metrics

19. **`developer_platform/main.py`** — assemble all routers:
    - Separate FastAPI instance (NOT included in main procurement app)
    - CORS configured for developer portal domain
    - Own /openapi.json endpoint
    - Add Swagger UI at /api-explorer
    - Register all dev platform routers with /dev prefix

20. **Add to `docker/docker-compose.yml`**:
```yaml
  developer-platform-api:
    build:
      context: .
      dockerfile: docker/Dockerfile.dev-platform
    ports: ["8001:8001"]
    environment:
      DEV_PORTAL_JWT_PRIVATE_KEY_PATH: /run/secrets/dev_portal_jwt_private
      SANDBOX_DATABASE_URL: postgresql+asyncpg://postgres:password@sandbox-db:5432/procurement_sandbox
    depends_on:
      api: { condition: service_started }
      sandbox-db: { condition: service_healthy }
    networks: [procurement_net]

  sandbox-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: procurement_sandbox
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
    volumes:
      - sandbox_db_data:/var/lib/postgresql/data
    networks: [procurement_net]
```

### Part C: Developer Portal Frontend
21. Create Next.js app:
```bash
cd procurement-portal-frontend
pnpm create next-app apps/developer-portal --typescript --tailwind --app --no-src-dir
pnpm add -w swagger-ui-react shiki feedgen
pnpm add --filter developer-portal swagger-ui-react @/shiki next-mdx-remote
```

22. **`apps/developer-portal/app/(public)/page.tsx`** — Landing page:
    - Hero: "Build on ProcureOS API" + CTA buttons (Sign Up, View Docs)
    - Features grid: Sandbox, SDKs, Live API Reference, Changelog
    - Quick-start code snippet (3-tab: Python, Node.js, cURL)
    - Latest changelog entry preview

23. **`apps/developer-portal/app/(public)/changelog/page.tsx`** — Changelog timeline:
    - Fetch from GET /dev/changelog
    - Timeline: version badge (MAJOR=red, MINOR=blue, PATCH=gray), date, title
    - Expand/collapse per entry: breaking changes (red), new features (green), deprecations (amber)
    - "Subscribe RSS" copy button → copies RSS URL to clipboard
    - Breaking change count shown in version badge

24. **`apps/developer-portal/app/(public)/reference/page.tsx`** — API Reference:
    - Embeds swagger-ui-react pointing to `${NEXT_PUBLIC_API_URL}/api/v1/openapi.json`
    - Custom theme matching developer portal branding
    - "Try it out" button uses sandbox API key pre-filled from user's account

25. **`apps/developer-portal/app/(dashboard)/sandbox/page.tsx`** — Sandbox Console:
    - Status cards: entity counts (PRs, Vendors, RFQs, etc.)
    - Reset button with confirmation dialog
    - Time Travel: number input + "Advance by X days" button + current simulated date display
    - Scenarios grid: 5 scenario cards with name, description, "Run" button
    - Scenario output: step-by-step log rendered after run

26. **`apps/developer-portal/components/CodeSnippetExplorer.tsx`**:
    - Fetches OpenAPI spec on mount
    - Left panel: endpoint tree (grouped by tag)
    - Right panel: language tabs (Python, Node.js, cURL, Go)
    - Code generated from OpenAPI schema + shiki syntax highlighting
    - User's sandbox test API key auto-injected in examples
    - "Run in Sandbox" button: calls developer-platform API proxy to sandbox

27. **`apps/developer-portal/app/(dashboard)/rate-limits/page.tsx`**:
    - API key selector dropdown (if user has multiple keys)
    - Real-time quota gauge (circular progress, refreshes every 30s)
    - Request volume area chart (recharts, last 24h)
    - Throttle events table
    - Top endpoints table with avg response time + error rate

28. **`apps/developer-portal/Dockerfile`**:
```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/developer-portal/ ./apps/developer-portal/
RUN pnpm install --frozen-lockfile
FROM deps AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEV_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEV_API_URL=$NEXT_PUBLIC_DEV_API_URL
RUN pnpm --filter developer-portal build
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3003
COPY --from=builder /app/apps/developer-portal/.next/standalone ./
EXPOSE 3003
CMD ["node", "apps/developer-portal/server.js"]
```

### Part D: SDK Generation CI Job
29. **`.github/workflows/sdk_generation.yml`**:
```yaml
name: Generate SDKs
on:
  push:
    tags: ['v*.*.*']
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate Python SDK
        run: |
          docker run openapitools/openapi-generator-cli generate \
            -i ${API_URL}/api/v1/openapi.json \
            -g python -o sdks/procureos-python \
            --additional-properties=packageName=procureos,packageVersion=${VERSION}
      - name: Generate Node.js SDK
        run: |
          docker run openapitools/openapi-generator-cli generate \
            -i ${API_URL}/api/v1/openapi.json \
            -g typescript-fetch -o sdks/procureos-node
      - name: Create GitHub Release with SDKs
        uses: ncipollo/release-action@v1
        with:
          artifacts: "sdks/**/*.tar.gz"
```

30. **`scripts/generate_dev_portal_keys.py`**:
```python
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

def generate_dev_portal_keys():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with open("keys/dev_portal_private.pem", "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))
    with open("keys/dev_portal_public.pem", "wb") as f:
        f.write(private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))
    print("Developer portal RSA keypair generated: keys/dev_portal_*.pem")
```

---
## STEP 2.5 — SPEC AUDIT
Produce `reports/spec_28_audit.md`. All 5 modules (28-A through 28-E) must show DONE.
BLOCK on any PARTIAL or MISSING.

---
## STEP 3 — TEST
```bash
# Developer auth
pytest tests/unit/test_dev_auth_service.py -v
# Must pass:
# test_dev_signup_creates_sandbox_and_sends_verification
# test_dev_login_blocked_before_verification
# test_dev_jwt_cannot_auth_on_procurement_endpoints
# test_procurement_jwt_cannot_auth_on_dev_endpoints
# test_google_oauth_creates_account

# Sandbox
pytest tests/unit/test_sandbox_service.py -v
# Must pass:
# test_sandbox_reset_reseeds_all_entities
# test_time_travel_stored_in_redis
# test_time_travel_max_365_days_enforced
# test_scenario_pr_to_po_completes_all_steps
# test_sandbox_entities_not_visible_in_production

# Changelog
pytest tests/unit/test_changelog_service.py -v
# Must pass:
# test_rss_feed_valid_xml
# test_atom_feed_valid_xml
# test_only_published_in_feeds
# test_deprecation_headers_from_db_not_hardcoded

# Rate limits
pytest tests/unit/test_rate_limit_dashboard.py -v

# Integration
pytest tests/integration/test_developer_platform.py -v

# Frontend build
cd procurement-portal-frontend
pnpm build --filter=developer-portal
```

---
## STEP 4 — INTEGRATE
```bash
# Run migrations
alembic upgrade head  # 0046–0050
# Generate dev portal RSA keys
python scripts/generate_dev_portal_keys.py
# Set environment variables
echo "DEV_PORTAL_JWT_PRIVATE_KEY_PATH=keys/dev_portal_private.pem" >> .env
echo "DEV_PORTAL_JWT_PUBLIC_KEY_PATH=keys/dev_portal_public.pem" >> .env
echo "SANDBOX_DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5433/procurement_sandbox" >> .env
# Start developer platform
docker-compose up -d sandbox-db developer-platform-api developer-portal
# Verify
curl http://localhost:8001/dev/changelog | python -c "import sys,json; d=json.load(sys.stdin); print('Changelog OK:', 'data' in d)"
curl http://localhost:3003 | grep -q "ProcureOS Developer" && echo "Dev portal UI OK"
# Verify sandbox isolation — dev API key cannot hit production data
DEV_TOKEN=$(curl -s -X POST http://localhost:8001/dev/auth/login -H "Content-Type: application/json" -d '{"email":"test@dev.com","password":"Test@1234"}' | python -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
curl http://localhost:8000/api/v1/requisitions -H "Authorization: Bearer $DEV_TOKEN"
# Must return 401 INVALID_TOKEN (not procurement token format)
```

---
## STEP 5 — GRAPHIFY + STEP 6 — README + COMMIT
```bash
graphify update && graphify check --integrity
# Verify new nodes: DevAuthService, SandboxService, ChangelogService,
#                   RateLimitDashboardService, DeveloperPortalApp
graphify diff > graphify_diff_spec28_$(date +%Y%m%d_%H%M%S).txt
git add -A
git commit -m "[NON-BREAKING] feat: SPEC_28 — Developer Platform; Sandbox with Faker seed; Changelog RSS/Atom; Rate Limit Dashboard; API Docs Hub; Code Snippet Explorer; SDK generation CI"
```
