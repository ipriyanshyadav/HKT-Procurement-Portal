# SPEC_23_TESTING.md

## Title
Enterprise S2P Procurement Portal — Testing Strategy

## Purpose
Define the complete testing strategy including unit, integration, workflow regression, performance, security, UAT, and audit validation testing.

## Scope
Covers testing framework, unit test targets and coverage, critical function test cases, integration test setup, API contract tests, workflow regression suite, performance test plan, security test checklist, audit validation, CI execution, and regression gates.

## Dependencies
- All previous spec files (testing covers all modules)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Testing Framework

| Component | Tool |
|---|---|
| Test runner | `pytest` 8+ |
| Async support | `pytest-asyncio` |
| HTTP client | `httpx.AsyncClient` (for FastAPI integration tests) |
| Test data | `factory_boy` + `pytest-factoryboy` |
| Test containers | `testcontainers-python` (PostgreSQL, Redis) |
| Coverage | `pytest-cov` |
| Mocking | `unittest.mock`, `pytest-mock` |
| Performance | K6 |
| Security scanning | Snyk (dependencies), Trivy (containers) |

## 2. Unit Test Targets

**Minimum coverage:** 80% for service layer overall.

**Critical function coverage (95%+):**
- `ApprovalRulesEngine.resolve_chain()` — all condition evaluation, priority resolution, specificity tiebreaking
- `WorkflowEngine` — instantiate, advance, parallel convergence, SLA escalation, maker-checker, delegation
- `BidService.compute_hash()` — hash determinism, sort order, field inclusion
- `EvaluationService.generate_cs()` — normalization formula, freight handling, NPV calculation, ranking
- `InvoiceService.run_three_way_match()` — all match/mismatch scenarios
- `VendorService.detect_duplicates()` — PAN exact, GSTIN exact, name fuzzy, bank fraud flag

## 3. Critical Function Test Cases

### ApprovalRulesEngine

| Test Case | Input | Expected |
|---|---|---|
| Single matching rule | PR ₹50K OPEX | Returns rule's approval_steps |
| No matching rule | PR with unknown category combo | Returns PENDING_RULE_RESOLUTION |
| Priority conflict — different priority | Two rules match, priority 10 vs 20 | Priority 10 wins |
| Priority conflict — same priority, different specificity | Two rules at priority 10; one has 3 conditions, other has 2 | 3-condition rule wins |
| Priority + specificity tie | Two rules identical priority and condition count | Returns PENDING_RULE_RESOLUTION |
| In-flight rule change | Rule updated while workflow active | In-flight uses captured version_id |
| All dimension combinations | PR CAPEX >50L + strategic + emergency | Correct chain resolved |
| Condition operators | gte, lte, in, not_in, is_true | Each evaluated correctly |

### WorkflowEngine

| Test Case | Input | Expected |
|---|---|---|
| Sequential happy path | 3-step sequential, all approve | Instance COMPLETED |
| Sequential rejection | Step 2 rejects | Instance FAILED at step 2 |
| Parallel ALL — all approve | 3 parallel tasks, all approve | Step completes, advances |
| Parallel ALL — one rejects | 3 parallel, 1 rejects | Instance FAILED, remaining cancelled |
| Parallel ANY — first approves | 3 parallel, first approves | Step completes, others cancelled |
| Parallel MAJORITY | 3 parallel, 2 approve | Step completes |
| SLA 50% | Task at 50% of SLA | sla_status = WARNING, reminder sent |
| SLA 100% | Task at 100% | sla_status = ESCALATED |
| SLA 150% — with delegation | Task at 150%, delegation exists | Reassigned to delegate |
| SLA 150% — no delegation | Task at 150%, no delegation | Assigned to Procurement Admin |
| Maker-checker block | Creator is only eligible approver | Escalation to next level |
| Delegation routing | Active delegation for primary approver | Task assigned to delegate |
| Emergency parallel approval | Emergency RFQ, parallel HOD + SM | Both tasks created simultaneously |
| Force-advance | Admin force-advances stuck task | Compliance exception created |
| Conditional skip | Step condition false | Step skipped, advances to next |
| Simulation (dry run) | Template + entity context | Returns chain with names, no DB writes |

### BidService

| Test Case | Input | Expected |
|---|---|---|
| Hash determinism | Same bid data, compute twice | Identical hash both times |
| Hash changes on data change | Modify one unit_price | Different hash |
| Late submission | Submit 1 second after deadline | 400 BID_WINDOW_CLOSED |
| Draft-to-sealed transition | Submit bid | Status SUBMITTED, hash stored, sealed_at set |
| Reopen before deadline | Reopen submitted bid | Version archived, status DRAFT, hash cleared |
| Reopen after deadline | Reopen after bid_close_at | 400 BID_WINDOW_CLOSED |
| Hash verification — valid | Open bid, verify hash | Returns True |
| Hash verification — tampered | Modify DB bid data after submission | INTEGRITY_FAIL status, alert published |

### CS Generation

| Test Case | Input | Expected |
|---|---|---|
| NPV formula correctness | 90-day payment, 12% CoC | `landed_cost / (1 - 90/365 * 0.12)` |
| Freight INCLUSIVE | Freight terms = INCLUSIVE | freight_per_unit = 0 |
| Freight EXTRA | Freight = ₹5000, qty = 100 | freight_per_unit = 50 |
| Tax normalization | HSN rate 18%, supplier declared 12% | Tax calculated at 18%, discrepancy flagged |
| Tie-breaking rule 1 | Same price, different lead times | Lower lead time wins |
| Tie-breaking rule 2 | Same price + lead time, different scores | Higher score wins |
| Tie-breaking rule 3 | All tied | Admin discretion flag |
| Savings calculation | Estimated ₹10L, L1 = ₹8L | savings = 20% |

### 3-Way Match

| Test Case | Input | Expected |
|---|---|---|
| Full match | Price within 0.5%, qty within GRN, PO valid | all_match = True |
| Price at exact tolerance | Price deviation = exactly 0.5% | Match (<=) |
| Price above tolerance | Price deviation = 0.6% | price_match = False |
| Quantity mismatch | Invoice qty > GRN accepted - previously invoiced | quantity_match = False |
| Partial match | 3 lines match, 1 price mismatch | PARTIALLY_MATCHED |
| Duplicate invoice | Same vendor + invoice number | 409 DUPLICATE_INVOICE |
| Tax discrepancy | Invoice tax differs from expected by >1% | tax_match = False |

## 4. Integration Test Setup

```python
# tests/conftest.py

@pytest.fixture(scope="session")
async def db_engine():
    container = PostgresContainer("postgres:16")
    container.start()
    engine = create_async_engine(container.get_connection_url().replace("postgresql://", "postgresql+asyncpg://"))
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield engine
    await engine.dispose()
    container.stop()

@pytest.fixture
async def db_session(db_engine):
    async with async_sessionmaker(db_engine)() as session:
        await session.begin()
        yield session
        await session.rollback()  # Isolation per test

@pytest.fixture
async def client(db_session):
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
```

MinIO mock: `moto` library for S3-compatible operations.
RabbitMQ mock: `aio-pika` in-memory exchange.

## 5. API Contract Tests

For every endpoint: happy path, 401 (no token), 403 (wrong role), 403 (wrong BU scope), 422 (validation error), 404 (not found), 409 (optimistic lock conflict).

## 6. Workflow Regression Suite

Full end-to-end workflow execution test for all 10 workflow template types. Each test asserts: correct task creation, correct escalation behavior, delegate routing, final instance state, and audit log entries created.

## 7. Performance Test Plan (K6)

| Scenario | VUs | Duration | Target |
|---|---|---|---|
| Buyer concurrent sessions | 500 | 15 min | p95 < 2s, error rate < 0.1% |
| Supplier bid submission peak | 1000 | 10 min | p95 < 3s, 0 data loss |
| CS generation (20 lines, 10 bidders) | 10 | 5 min | p95 < 5s |
| Bulk PR import (1000 PRs) | 1 | — | Complete < 5 min |
| Approval inbox load | 200 | 10 min | p95 < 1s |

## 8. Security Test Checklist

- IDOR: User A (org 1) attempting to access user B's data (org 2 or different BU)
- Bid access before opening: Admin token attempting `GET /bids/{id}` pre-opening → must return 403
- Permission boundary tests: Each role attempting each endpoint → correct 403 for unauthorized
- SQL injection: All text input fields tested with `'; DROP TABLE--` patterns
- File upload bypass: `.php` file with valid PDF magic bytes → must be rejected
- JWT manipulation: alg=none, expired token, wrong org_id, tampered payload

## 9. Audit Validation Test Suite

- Create entity → verify audit_log entry with correct entity_type, entity_id, action, actor
- Attempt `UPDATE` on audit_logs → verify PostgreSQL trigger blocks with error
- Bid submission → verify bid_hash stored in audit_logs
- Bid opening → verify hash verification result in audit_logs

## 10. CI Test Execution

| Suite | Trigger | Pipeline |
|---|---|---|
| Unit tests | Every push | `pytest tests/unit/` |
| Integration tests | PR to main | `pytest tests/integration/` |
| Workflow tests | PR to main | `pytest tests/workflow/` |
| Performance tests | Nightly on staging | K6 scripts |
| Security scan | Weekly | Snyk + Trivy |

## 11. Regression Gate

- 80% test automation rate
- Full regression suite < 30 minutes
- Any regression failure blocks production deploy
- Zero critical/high security vulnerabilities in production deploy
