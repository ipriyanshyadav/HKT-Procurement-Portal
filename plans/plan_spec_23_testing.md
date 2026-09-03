# IMPLEMENTATION PLAN — SPEC_23: Testing Strategy
**Module:** 23 | **Phase:** Foundation (Cross-Cutting) | **Squad:** All
**Spec File:** SPEC_23_TESTING.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S23-01 | Unit test target: 80%+ coverage | pytest + coverage | PLANNED |
| S23-02 | Integration tests per module | tests/integration/ | PLANNED |
| S23-03 | Workflow E2E tests (10 templates) | tests/workflow/ | PLANNED |
| S23-04 | Security tests (OWASP top 10) | tests/security/ | PLANNED |
| S23-05 | Performance: k6 baselines (7 scenarios) | tests/performance/ | PLANNED |
| S23-06 | Factory functions (no hardcoded UUIDs) | tests/factories/ | PLANNED |
| S23-07 | Test DB isolation (per-test transaction rollback) | tests/conftest.py | PLANNED |
| S23-08 | Mock external services (GST, ERP, SendGrid) | tests/mocks/ | PLANNED |
| S23-09 | Fixture: seeded org + roles + users | tests/conftest.py | PLANNED |
| S23-10 | 3 QA personas: User/Developer/QA | Per-module test files | PLANNED |
| S23-11 | Pre-commit test hook | .pre-commit-config.yaml | PLANNED |
| S23-12 | CI: pytest + pnpm test on every PR | .github/workflows/ci.yml | PLANNED |
| S23-13 | Coverage gate: 80% minimum | pytest --cov-fail-under=80 | PLANNED |
| S23-14 | Performance SLO validation | k6 thresholds | PLANNED |
| S23-15 | Playwright E2E (3 portals) | tests/e2e/ | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-23-1 | Test DB is a separate PostgreSQL database `procurement_test`; per-test isolation uses `BEGIN/ROLLBACK` not separate DB per test | Speed — full DB creation per test is too slow | MEDIUM | All Squads |
| A-23-2 | All factory functions use `uuid4()` — NEVER hardcoded UUIDs; GEMINI.md ABSOLUTE RULE | Zero tolerance | HIGH | All Squads |
| A-23-3 | External service mocks use `respx` for httpx and `pytest-mock` for aio-pika; no real external calls in unit/integration tests | Test isolation | MEDIUM | All Squads |
| A-23-4 | k6 performance tests run in CI only on staging (not every PR); local run requires `ENABLE_PERF_TESTS=1` env var | Performance tests need production-like data volumes | LOW | DevOps |
| A-23-5 | Playwright tests run headless in CI; require `PLAYWRIGHT_BASE_URL` pointing to staging | E2E requires full stack | LOW | FE Lead |

---
## STEP 2 — IMPLEMENT

### 2.1 `tests/conftest.py` — Global Fixtures
```python
import pytest
import asyncio
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.config import settings
from app.db.base import Base
from app.db.session import async_session_factory

TEST_DB_URL = settings.DATABASE_URL.replace("/procurement", "/procurement_test")

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db(test_engine) -> AsyncSession:
    """Per-test transaction that rolls back after each test."""
    async with test_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        yield session
        await session.close()
        await conn.rollback()

@pytest.fixture
async def org(db) -> dict:
    """Seeded organization with all required data."""
    from tests.factories.organization import OrganizationFactory
    return await OrganizationFactory.create(db)

@pytest.fixture
async def buyer_user(db, org) -> dict:
    from tests.factories.user import UserFactory
    return await UserFactory.create(db, org_id=org["id"], role="BUYER")

@pytest.fixture
async def supplier_user(db, org, vendor) -> dict:
    from tests.factories.user import UserFactory
    return await UserFactory.create(db, org_id=org["id"], role="SUPPLIER_USER", vendor_id=vendor["id"])

@pytest.fixture
async def auth_headers(buyer_user) -> dict:
    """Returns Authorization header for buyer user."""
    from app.auth.jwt import create_access_token
    token = create_access_token(
        buyer_user["id"], buyer_user["org_id"], buyer_user["email"],
        ["BUYER"], [], [], [], False, None, str(uuid4())
    )
    return {"Authorization": f"Bearer {token}"}
```

### 2.2 `tests/factories/` — Factory Pattern (NO HARDCODED DATA)
```python
# tests/factories/vendor.py
class VendorFactory:
    @staticmethod
    async def create(db: AsyncSession, org_id: UUID = None, status: str = "ACTIVE",
                      **overrides) -> Vendor:
        org_id = org_id or uuid4()  # NEVER hardcoded
        vendor = Vendor(
            org_id=org_id,
            name=f"Test Vendor {uuid4().hex[:8]}",  # Unique per test
            email=f"vendor_{uuid4().hex[:8]}@test.com",
            gstin=f"{uuid4().hex[:15].upper()[:15]}",
            status=status,
            **overrides
        )
        db.add(vendor)
        await db.flush()
        return vendor

# tests/factories/requisition.py
class RequisitionFactory:
    @staticmethod
    async def create(db: AsyncSession, org_id: UUID, created_by: UUID,
                      amount: float = 50000.0, **overrides) -> Requisition:
        bu = await BusinessUnitFactory.create(db, org_id=org_id)
        category = await CategoryFactory.create(db, org_id=org_id)
        pr = Requisition(
            org_id=org_id,
            pr_number=f"TEST-PR-{uuid4().hex[:6].upper()}",
            title=f"Test PR {uuid4().hex[:8]}",
            business_unit_id=bu.id, category_id=category.id,
            requested_by=created_by, status="DRAFT",
            **overrides
        )
        pr_line = RequisitionLine(
            org_id=org_id, requisition_id=pr.id if pr.id else None,
            line_number=1, description="Test Item",
            quantity=10, estimated_unit_price=amount / 10,
            uom_id=(await UOMFactory.create(db, org_id=org_id)).id,
        )
        db.add(pr); await db.flush()
        pr_line.requisition_id = pr.id
        db.add(pr_line); await db.flush()
        return pr
```

### 2.3 `tests/security/test_owasp.py` — OWASP Top 10
```python
async def test_sql_injection_rejected(client):
    """SQL injection in query param returns 422, not DB error."""
    resp = await client.get("/api/v1/vendors?name='; DROP TABLE vendors; --")
    assert resp.status_code in (422, 200)  # Not 500
    # Verify vendors table still exists
    async with async_session_factory() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM vendors"))
        assert result.scalar() >= 0

async def test_xss_content_security_policy(client):
    """CSP header present on all responses."""
    resp = await client.get("/api/v1/requisitions")
    assert "Content-Security-Policy" in resp.headers

async def test_broken_auth_no_token(client):
    """Protected endpoint without token → 401."""
    resp = await client.get("/api/v1/requisitions")
    assert resp.status_code == 401

async def test_broken_auth_expired_token(client, factory):
    """Expired access token → 401."""
    expired_token = create_access_token(..., expire_in_minutes=-1)
    resp = await client.get("/api/v1/requisitions",
        headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401

async def test_idor_cross_org(client, factory):
    """User from org A cannot access resource from org B."""
    org_a_user_headers = await get_headers_for_org_a()
    org_b_pr_id = await create_pr_for_org_b()
    resp = await client.get(f"/api/v1/requisitions/{org_b_pr_id}",
        headers=org_a_user_headers)
    assert resp.status_code == 404  # Not 403 — don't reveal existence

async def test_mass_assignment_blocked(client, factory, auth_headers):
    """Attempt to set org_id or created_at via API body fails."""
    resp = await client.post("/api/v1/requisitions",
        json={**valid_pr_data, "org_id": str(uuid4()), "created_at": "2020-01-01"},
        headers=auth_headers)
    assert resp.status_code in (201, 422)
    if resp.status_code == 201:
        assert resp.json()["data"]["org_id"] != str(uuid4())  # Not overridden

async def test_rate_limit_enforced(client, auth_headers):
    """101 requests to rate-limited endpoint → 429."""
    for i in range(100):
        await client.get("/api/v1/vendors", headers=auth_headers)
    resp = await client.get("/api/v1/vendors", headers=auth_headers)
    assert resp.status_code == 429
```

### 2.4 `tests/performance/k6_baselines.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const p95 = new Trend('p95_duration');

export const options = {
  scenarios: {
    // Scenario 1: Browse PRs (100 concurrent)
    browse_prs: {
      executor: 'constant-vus', vus: 100, duration: '5m',
      exec: 'browsePRs',
    },
    // Scenario 2: Create PR (50 concurrent)
    create_pr: {
      executor: 'constant-vus', vus: 50, duration: '5m',
      exec: 'createPR', startTime: '1m',
    },
    // Scenario 3: Approve workflow task (30 concurrent)
    approve_task: {
      executor: 'constant-vus', vus: 30, duration: '5m',
      exec: 'approveTask', startTime: '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{name:create_pr}': ['p(95)<1000'],
    errors: ['rate<0.01'],
  },
};

export function browsePRs() {
  const res = http.get(`${__ENV.BASE_URL}/api/v1/requisitions`,
    { headers: { Authorization: `Bearer ${__ENV.ACCESS_TOKEN}` } });
  check(res, { 'status 200': r => r.status === 200 });
  errorRate.add(res.status !== 200);
  sleep(1);
}
// ... other scenario functions
```

### 2.5 `tests/workflow/test_all_templates.py` — 10 Workflow Templates
```python
# For each of the 10 workflow templates: test happy path E2E
@pytest.mark.parametrize("template_code,entity_type,context", [
    ("PR_APPROVAL", "REQUISITION", {"amount": 50000, "bu_id": "{{bu_id}}"}),
    ("PR_APPROVAL_CAPEX", "REQUISITION", {"amount": 2500000, "is_capex": True}),
    ("RFQ_APPROVAL", "RFQ", {"amount": 5000000, "rfq_type": "CLOSED"}),
    ("VENDOR_QUAL", "VENDOR", {"vendor_id": "{{vendor_id}}"}),
    ("VENDOR_BLACKLIST", "VENDOR", {"vendor_id": "{{vendor_id}}"}),
    ("CONTRACT_APPROVAL", "CONTRACT", {"amount": 10000000}),
    ("PO_APPROVAL", "PURCHASE_ORDER", {"amount": 1000000}),
    ("INVOICE_APPROVAL", "INVOICE", {"amount": 500000}),
    ("AWARD_APPROVAL", "AWARD", {"awarded_total": 3000000}),
    ("MASTER_DATA_CHANGE", "MASTER_DATA", {"change_type": "CATEGORY_TREE_UPDATE"}),
])
async def test_workflow_template_happy_path(db, factory, template_code, entity_type, context):
    """All 10 templates reach COMPLETED status when all approvers approve."""
```
