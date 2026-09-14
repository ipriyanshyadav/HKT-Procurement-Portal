# IMPLEMENTATION PLAN — SPEC_28: Developer Platform (Standalone App)
**Module:** 28 | **Phase:** Enhancement | **Squad:** A (Platform)
**Plan Date:** 2026-08-04 | **App Port:** 3003

---
## SESSION BOOTSTRAP
- [x] GEMINI.md read; all ABSOLUTE RULES apply
- [x] Graphify loaded; SPEC_01–27 implemented
- [x] SPEC_28 fully analyzed (5 modules: Sandbox, SDK, Changelog, Rate Limit Dashboard, API Docs Hub)

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-28-1 | Sandbox uses a separate lightweight PostgreSQL database (`procurement_sandbox`) not a schema — provides stronger isolation and independent reset capability | Schema-level isolation still shares DB locks and connection pool | MEDIUM | DevOps |
| A-28-2 | Developer account auth uses a separate RS256 keypair from the main procurement JWT keypair. `settings.DEV_PORTAL_JWT_PRIVATE_KEY_PATH` + `settings.DEV_PORTAL_JWT_PUBLIC_KEY_PATH` | Prevents developer JWT from working on production procurement endpoints | HIGH | Squad A |
| A-28-3 | SDK generation runs in CI/CD pipeline (GitHub Actions) on every API version tag; not on-demand per user request | On-demand generation would be expensive and slow | LOW | DevOps |
| A-28-4 | Changelog entries authored via admin API (not a CMS UI in Phase 1); markdown content edited via API or direct DB; Phase 2 adds rich editor | MVP approach | LOW | Squad A |
| A-28-5 | Rate limit data sourced from both Redis real-time counters AND `api_key_usage_log` table; Redis for current-window data, DB for historical trends | Two sources needed for real-time + history | LOW | Squad A |
| A-28-6 | Developer portal Next.js app uses its own `.env.local` with `DEV_PORTAL_API_URL` pointing to the developer platform FastAPI app (separate port or path prefix `/dev-api/`) | Developer platform has its own FastAPI router prefix | LOW | FE Lead |
| A-28-7 | Sandbox time-travel: `advance_by_days` sets a `sandbox_time_offset_days` in Redis for the sandbox org; all sandbox timestamp operations add this offset | Real system clock manipulation is too disruptive | MEDIUM | Squad A |
| A-28-8 | `doc_pages` table and `api_changelog` table live in the main procurement database (not sandbox); developer portal reads from these via API | Shared content database; developer portal is a read client | LOW | Squad A |

---
## STEP 2 — IMPLEMENT

### 2.1 Settings Additions (`app/config.py`)
```python
# Developer Platform
DEV_PORTAL_JWT_PRIVATE_KEY_PATH: str = ""
DEV_PORTAL_JWT_PUBLIC_KEY_PATH: str = ""
DEV_PORTAL_JWT_EXPIRE_HOURS: int = 24
SANDBOX_DATABASE_URL: str = ""   # postgresql+asyncpg://user:pass@host:5432/procurement_sandbox
DEV_PORTAL_GOOGLE_CLIENT_ID: str = ""
DEV_PORTAL_GOOGLE_CLIENT_SECRET: str = ""
DEV_PORTAL_GITHUB_CLIENT_ID: str = ""
DEV_PORTAL_GITHUB_CLIENT_SECRET: str = ""
SDK_DOWNLOAD_BASE_URL: str = "https://github.com/procureos/sdks/releases"
OPENAPI_SPEC_URL: str = "http://api:8000/api/v1/openapi.json"
CHANGELOG_RSS_TITLE: str = "ProcureOS API Changelog"
CHANGELOG_RSS_BASE_URL: str = "https://developer.procureos.com"
```

### 2.2 New Migrations in Main DB
```
0046_developer_accounts.py  → developer_accounts, sandbox_orgs tables
0047_api_changelog.py       → api_changelog table
0048_doc_pages.py           → doc_pages table
0049_sdk_downloads.py       → sdk_downloads analytics table
0050_dev_indexes.py         → all CONCURRENTLY indexes for new tables
```

**`alembic/versions/0046_developer_accounts.py`:**
```python
def upgrade():
    op.create_table('developer_accounts',
        sa.Column('id', PGUUID(as_uuid=True), primary_key=True, default=uuid4),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('full_name', sa.String(255)),
        sa.Column('company', sa.String(255)),
        sa.Column('password_hash', sa.String(255)),
        sa.Column('auth_provider', sa.String(20), default='EMAIL'),
        sa.Column('auth_provider_id', sa.String(255)),
        sa.Column('is_verified', sa.Boolean, default=False, nullable=False),
        sa.Column('is_internal', sa.Boolean, default=False, nullable=False),
        sa.Column('sandbox_org_id', PGUUID(as_uuid=True)),
        sa.Column('api_keys_count', sa.Integer, default=0),
        sa.Column('last_login_at', sa.DateTime(timezone=True)),
        sa.Column('email_verification_token', sa.String(100)),
        sa.Column('email_verification_expires_at', sa.DateTime(timezone=True)),
        sa.Column('version', sa.Integer, default=1, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime(timezone=True), default=datetime.utcnow),
        sa.Column('deleted_at', sa.DateTime(timezone=True)),
    )
    op.create_table('sandbox_orgs',
        sa.Column('id', PGUUID(as_uuid=True), primary_key=True, default=uuid4),
        sa.Column('developer_id', PGUUID(as_uuid=True), sa.ForeignKey('developer_accounts.id'), nullable=False),
        sa.Column('org_name', sa.String(200), default='My Sandbox Org'),
        sa.Column('sandbox_org_id', PGUUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('api_key_test', sa.String(100)),
        sa.Column('reset_count', sa.Integer, default=0),
        sa.Column('last_reset_at', sa.DateTime(timezone=True)),
        sa.Column('version', sa.Integer, default=1, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime(timezone=True), default=datetime.utcnow),
    )

def downgrade():
    op.drop_table('sandbox_orgs')
    op.drop_table('developer_accounts')
```

### 2.3 Developer Platform FastAPI App (separate from main app)
**File:** `developer_platform/main.py` — separate FastAPI application:
```python
from fastapi import FastAPI
from developer_platform.routers import (
    auth_router, sandbox_router, changelog_router,
    docs_router, rate_limit_router, sdk_router, status_router
)

def create_dev_app() -> FastAPI:
    app = FastAPI(title="ProcureOS Developer Platform", version="1.0.0",
                  docs_url="/api-explorer", redoc_url="/api-reference")
    app.include_router(auth_router, prefix="/dev/auth")
    app.include_router(sandbox_router, prefix="/dev/sandbox")
    app.include_router(changelog_router, prefix="/dev/changelog")
    app.include_router(docs_router, prefix="/dev/docs")
    app.include_router(rate_limit_router, prefix="/dev/rate-limits")
    app.include_router(sdk_router, prefix="/dev/sdks")
    app.include_router(status_router, prefix="/dev/status")
    return app

app = create_dev_app()
```

**Directory structure:**
```
developer_platform/
├── main.py
├── config.py              → Dev-specific settings
├── auth/
│   ├── jwt.py             → Separate JWT using DEV_PORTAL_JWT_PRIVATE_KEY
│   ├── service.py         → signup, login, email verify, Google/GitHub OAuth
│   └── router.py
├── sandbox/
│   ├── seed_data.py       → Fake data generators (Faker library)
│   ├── service.py         → reset, time_travel, scenario runner
│   └── router.py
├── changelog/
│   ├── models.py          → APIChangelog SQLAlchemy model
│   ├── service.py         → CRUD + RSS/Atom feed generation
│   └── router.py
├── docs/
│   ├── models.py          → DocPage SQLAlchemy model
│   ├── service.py         → page CRUD + search
│   └── router.py
├── rate_limits/
│   ├── service.py         → Redis + DB queries for usage data
│   └── router.py
└── sdks/
    ├── service.py         → SDK download links + analytics
    └── router.py
```

### 2.4 Developer Auth Service
```python
# developer_platform/auth/service.py

class DevAuthService:

    async def signup(self, db, email: str, password: str, full_name: str, company: str) -> DeveloperAccount:
        existing = await self.repo.find_by_email(db, email)
        if existing:
            raise ConflictError("DEV_EMAIL_EXISTS", "An account with this email already exists")
        token = secrets.token_urlsafe(32)
        account = DeveloperAccount(
            email=email, full_name=full_name, company=company,
            password_hash=hash_password(password),
            auth_provider="EMAIL", is_verified=False,
            email_verification_token=hashlib.sha256(token.encode()).hexdigest(),
            email_verification_expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        db.add(account)
        await db.flush()
        # Create sandbox org automatically
        sandbox_org_id = uuid4()
        test_key = f"prc_test_{''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789') for _ in range(32))}"
        sandbox = SandboxOrg(developer_id=account.id, sandbox_org_id=sandbox_org_id, api_key_test=test_key)
        db.add(sandbox)
        # Send verification email
        await self.mailer.send_dev_verification(email, token)
        return account

    async def verify_email(self, db, token: str) -> DeveloperAccount:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        account = await self.repo.find_by_verification_token(db, token_hash)
        if not account:
            raise AppException("INVALID_VERIFICATION_TOKEN", "Invalid or expired verification link", 400)
        if account.email_verification_expires_at < datetime.utcnow():
            raise AppException("VERIFICATION_TOKEN_EXPIRED", "Verification link expired. Request a new one.", 400)
        account.is_verified = True
        account.email_verification_token = None
        account.email_verification_expires_at = None
        # Seed sandbox with fake data
        from developer_platform.sandbox.seed_data import seed_sandbox
        await seed_sandbox(account.sandbox_org_id)
        return account

    async def login(self, db, email: str, password: str) -> str:
        account = await self.repo.find_by_email(db, email)
        if not account or not verify_password(password, account.password_hash or ""):
            raise AppException("INVALID_CREDENTIALS", "Invalid email or password", 401)
        if not account.is_verified:
            raise AppException("EMAIL_NOT_VERIFIED", "Please verify your email before logging in", 401)
        account.last_login_at = datetime.utcnow()
        return self._issue_dev_jwt(account)

    def _issue_dev_jwt(self, account: DeveloperAccount) -> str:
        from developer_platform.auth.jwt import create_dev_token
        return create_dev_token(account.id, account.email, account.is_internal,
                                account.sandbox_org_id)
```

### 2.5 Sandbox Service
```python
# developer_platform/sandbox/service.py
from faker import Faker

fake = Faker(['en_IN'])

class SandboxService:

    SCENARIOS = {
        "pr_to_po": "Complete PR creation → approval → RFQ → bid → award → PO flow",
        "vendor_blacklist": "Vendor dual-approval blacklisting flow",
        "invoice_discrepancy": "Invoice 3-way match discrepancy and dispute flow",
        "sla_breach": "Workflow task SLA breach and auto-escalation",
        "contract_expiry": "Contract expiry alert and renewal flow",
    }

    async def reset(self, db, sandbox_org_id: UUID, developer_id: UUID) -> dict:
        """Truncate all sandbox data for this org and re-seed."""
        sandbox_db_url = settings.SANDBOX_DATABASE_URL
        async with create_sandbox_engine(sandbox_db_url) as sandbox_engine:
            async with AsyncSession(sandbox_engine) as sandbox_db:
                # Truncate all tables for this org
                tables = ["invoices","purchase_orders","bids","rfqs","requisitions",
                          "vendors","users","business_units","legal_entities"]
                for table in tables:
                    await sandbox_db.execute(text(
                        f"DELETE FROM {table} WHERE org_id = :org_id"), {"org_id": sandbox_org_id})
                await sandbox_db.commit()
                # Re-seed
                await self._seed_org(sandbox_db, sandbox_org_id)
        # Increment reset count
        sandbox = await self.repo.get_by_org(db, sandbox_org_id)
        sandbox.reset_count += 1
        sandbox.last_reset_at = datetime.utcnow()
        # Clear time travel offset
        await self.redis.delete(f"sandbox_time_offset:{sandbox_org_id}")
        return {"message": "Sandbox reset complete", "reset_count": sandbox.reset_count}

    async def time_travel(self, sandbox_org_id: UUID, advance_by_days: int) -> dict:
        """Advance sandbox clock for testing SLA breaches, contract expiry, etc."""
        if advance_by_days < 0 or advance_by_days > 365:
            raise ValidationError("INVALID_TIME_ADVANCE",
                "advance_by_days must be between 0 and 365")
        key = f"sandbox_time_offset:{sandbox_org_id}"
        current = int(await self.redis.get(key) or 0)
        new_offset = current + advance_by_days
        await self.redis.set(key, new_offset, ex=86400)
        return {"current_offset_days": new_offset,
                "simulated_date": (datetime.utcnow() + timedelta(days=new_offset)).date().isoformat()}

    async def _seed_org(self, sandbox_db, org_id: UUID):
        """Seed realistic fake data using Faker."""
        # 5 Business Units
        bus = [BusinessUnit(org_id=org_id, name=fake.company_suffix() + " Division",
               code=fake.lexify("??").upper(), default_currency="INR") for _ in range(5)]
        sandbox_db.add_all(bus)
        # 20 Users with different roles
        roles = ["BUYER","REQUESTOR","APPROVER","FINANCE_CONTROLLER","SOURCING_MANAGER",
                 "PROCUREMENT_HEAD","VENDOR_ADMIN","SUPPLIER_USER","REQUESTOR","BUYER"] * 2
        for i, role in enumerate(roles):
            user = User(org_id=org_id, email=f"sandbox.user{i+1}@example.com",
                       first_name=fake.first_name(), last_name=fake.last_name(),
                       status="ACTIVE", is_supplier_user=(role == "SUPPLIER_USER"))
            sandbox_db.add(user)
        # 15 Vendors in various statuses
        statuses = ["ACTIVE"]*8 + ["QUALIFIED"]*3 + ["SUSPENDED","INVITED","COMPLIANCE_HOLD","UNDER_REVIEW"]
        for status in statuses:
            vendor = Vendor(org_id=org_id, name=fake.company(),
                          email=fake.company_email(), status=status,
                          gstin=fake.bothify("??#????#####?#Z?").upper()[:15])
            sandbox_db.add(vendor)
        # 50 PRs in various states, 10 RFQs, 20 Bids, 5 Contracts, 10 POs, 10 Invoices
        # (abbreviated — full seed generates realistic data per entity)
        await sandbox_db.commit()

    async def run_scenario(self, sandbox_db, scenario_id: str, sandbox_org_id: UUID) -> dict:
        if scenario_id not in self.SCENARIOS:
            raise ValidationError("UNKNOWN_SCENARIO", f"Unknown scenario: {scenario_id}",
                {"available": list(self.SCENARIOS.keys())})
        # Execute the scenario step by step
        scenario_runner = getattr(self, f"_scenario_{scenario_id}")
        return await scenario_runner(sandbox_db, sandbox_org_id)
```

### 2.6 Changelog Service (RSS/Atom Feed)
```python
# developer_platform/changelog/service.py
from feedgen.feed import FeedGenerator

class ChangelogService:

    async def get_rss_feed(self, db) -> str:
        entries = await self.repo.get_published(db, limit=20)
        fg = FeedGenerator()
        fg.id(f"{settings.CHANGELOG_RSS_BASE_URL}/changelog")
        fg.title(settings.CHANGELOG_RSS_TITLE)
        fg.link(href=f"{settings.CHANGELOG_RSS_BASE_URL}/changelog", rel="alternate")
        fg.description("ProcureOS API version history and release notes")
        for entry in entries:
            fe = fg.add_entry()
            fe.id(f"{settings.CHANGELOG_RSS_BASE_URL}/changelog/{entry.version}")
            fe.title(f"v{entry.version} — {entry.title}")
            fe.link(href=f"{settings.CHANGELOG_RSS_BASE_URL}/changelog/{entry.version}")
            fe.published(entry.published_at)
            fe.content(entry.description, type="html")
        return fg.rss_str(pretty=True)

    async def get_deprecation_headers_for_endpoint(self, db, endpoint: str) -> Optional[dict]:
        """Called by main API deprecation middleware."""
        all_deprecations = await self.repo.get_active_deprecations(db)
        for dep in all_deprecations:
            for d in dep:
                if d.get("endpoint") == endpoint:
                    return {
                        "Deprecation": "true",
                        "Sunset": d["sunset_date"],
                        "Link": f'<{settings.CHANGELOG_RSS_BASE_URL}/changelog/{dep.version}>; rel="successor-version"'
                    }
        return None
```

### 2.7 Developer Platform Frontend (apps/developer-portal/)
```
procurement-portal-frontend/
└── apps/
    └── developer-portal/           ← New Next.js 14 app (port 3003)
        ├── app/
        │   ├── (public)/           ← No auth required
        │   │   ├── page.tsx        ← Landing page
        │   │   ├── changelog/
        │   │   ├── status/
        │   │   └── docs/[...slug]/ ← MDX article renderer
        │   ├── (auth)/             ← Developer auth
        │   │   ├── login/
        │   │   ├── signup/
        │   │   └── verify-email/
        │   └── (dashboard)/        ← Authenticated dev dashboard
        │       ├── sandbox/        ← Sandbox console
        │       ├── keys/           ← API key management
        │       ├── rate-limits/    ← Usage dashboard
        │       └── reference/      ← Swagger UI embed
        ├── components/
        │   ├── CodeSnippetExplorer.tsx  ← Endpoint browser + language tabs
        │   ├── SandboxConsole.tsx       ← Reset, time-travel, scenario runner
        │   ├── ChangelogTimeline.tsx    ← Version history timeline
        │   ├── RateLimitGauge.tsx       ← Real-time quota widget
        │   └── SwaggerEmbed.tsx         ← Wraps swagger-ui-react
        └── Dockerfile                   ← Separate Docker build
```

**Key Frontend Components:**

**`CodeSnippetExplorer.tsx`:**
```tsx
// Fetches openapi.json, renders endpoint tree in left panel
// Right panel: language selector tabs (Python | Node | cURL | Go | PHP)
// Code example generated client-side from OpenAPI operation schema
// User's sandbox test API key pre-populated in examples
// "Run in Sandbox" button: fires actual request to /sandbox/api/v1/*, shows response JSON
// Syntax highlighting: shiki library
```

**`SandboxConsole.tsx`:**
```tsx
// Three sections:
// 1. Status: entity counts (PRs: 50, Vendors: 15, ...)
// 2. Controls: "Reset Sandbox" (with confirmation), "Time Travel" (days input + apply)
// 3. Scenarios: card grid, each scenario shows name + description + "Run" button
// Real-time output: after running scenario, shows step-by-step log
```

**`ChangelogTimeline.tsx`:**
```tsx
// Vertical timeline, newest at top
// Each entry: version badge (MAJOR=red, MINOR=blue, PATCH=gray), date, title
// Expanded view: breaking changes (red section), new features (green), deprecations (amber), bug fixes
// "Subscribe RSS" copy button
// Breaking change warnings highlighted prominently with migration guide link
```

**`RateLimitGauge.tsx`:**
```tsx
// Per API key: circular gauge showing requests used vs limit
// Time series chart: Area chart last 24h (recharts)
// Color: green < 50%, amber 50-80%, red > 80%
// "Request a limit increase" link if consistently > 80%
```

---
## STEP 3 — TEST

### Unit Tests
```python
# Developer Auth
test_dev_signup_creates_sandbox_org()
test_dev_signup_sends_verification_email()
test_dev_login_requires_email_verification()
test_dev_jwt_cannot_auth_on_procurement_endpoints()

# Sandbox
test_sandbox_reset_clears_and_reseeds_data()
test_time_travel_stores_offset_in_redis()
test_time_travel_max_365_days()
test_scenario_pr_to_po_completes_all_steps()

# Changelog
test_rss_feed_valid_xml()
test_atom_feed_valid_xml()
test_published_only_in_rss()
test_deprecation_headers_returned_for_deprecated_endpoint()

# Rate Limits
test_rate_limit_status_from_redis()
test_usage_timeseries_from_db()
test_throttle_events_last_30_days()
```

### QA Tests
```
- Sign up → receive verification email → verify → sandbox auto-created
- Sandbox has 50 PRs, 15 vendors, 20 users after signup
- Reset sandbox → entity counts back to seed values
- Time travel +30 days → contracts with 30-day expiry now show as expiring
- Run "sla_breach" scenario → workflow task SLA breached in sandbox
- Code snippet: copy Python example, run locally → hits sandbox, returns 200
- Changelog RSS feed valid XML parseable by RSS reader
- Rate limit gauge shows correct current window usage
- Deprecation header present on /api/v1/requisitions if that endpoint is deprecated in changelog
```

---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# New nodes: DevAuthService, SandboxService, ChangelogService, RateLimitDashboardService,
#            SDKDownloadService, DeveloperPortalApp (Next.js app at port 3003),
#            CodeSnippetExplorer, SandboxConsole
# New tables: developer_accounts, sandbox_orgs, api_changelog, doc_pages, sdk_downloads
graphify check --integrity
```
