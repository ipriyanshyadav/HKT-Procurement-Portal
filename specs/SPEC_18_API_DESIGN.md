# SPEC_18_API_DESIGN.md

## Title
Enterprise S2P Procurement Portal — API Design

## Purpose
Define REST API conventions, versioning, error handling, rate limiting, pagination, idempotency, and the complete API endpoint index.

## Scope
Covers API versioning, error response schema, pagination (cursor and offset), idempotency, request ID, rate limiting tiers, complete endpoint index by module, OpenAPI 3.1 generation, webhook endpoints, and health/operational endpoints.

## Dependencies
- SPEC_02_ARCHITECTURE.md (Kong configuration, FastAPI router registration)
- SPEC_04_AUTH_SECURITY.md (permission codes)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. API Versioning

URL path versioning: `/api/v1/...`

Future versions: `/api/v2/...` — old version supported for 6 months after new version release.

## 2. Error Response Schema

```json
{
  "error": {
    "code": "VENDOR_NOT_ACTIVE",
    "message": "Vendor must be in ACTIVE status to participate in RFQ",
    "details": {
      "vendor_id": "uuid",
      "current_status": "SUSPENDED"
    },
    "trace_id": "abc123def456",
    "timestamp": "2026-06-27T15:30:00.000Z"
  }
}
```

## 3. Pagination

**Offset-based** (default for normal lists):
```json
{"data": [...], "pagination": {"total": 1250, "page": 1, "per_page": 25, "total_pages": 50}}
```

**Cursor-based** (for large datasets: audit logs, notifications):
```json
{"data": [...], "pagination": {"next_cursor": "eyJ...", "has_more": true, "per_page": 50}}
```

## 4. Idempotency

`Idempotency-Key` header required for all state-changing POST/PATCH operations. Redis key: `idem:{key}`, TTL: 24h. Duplicate request returns cached response (200) without re-executing.

## 5. Request ID

`X-Request-ID` header generated at Kong if not present. Propagated through all log entries, error responses, and outbound service calls.

## 6. Rate Limiting

| Tier | Limit | Endpoints |
|---|---|---|
| Standard | 100 req/min per user | All CRUD endpoints |
| Search | 30 req/min per user | `/*/search`, Elasticsearch queries |
| File Upload | 10 req/min per user | `POST /documents/upload` |
| Auth | 5 req/min per IP | `POST /auth/login`, `POST /auth/mfa/verify` |
| Webhooks | Unlimited (IP allowlist) | `POST /webhooks/*` |

## 7. Complete API Endpoint Index

### Authentication (`/api/v1/auth`)

| Method | Path | Permission | Description | Idempotency | Rate Tier |
|---|---|---|---|---|---|
| POST | `/auth/login` | Public | Login with email/password | No | Auth |
| POST | `/auth/mfa/verify` | MFA token | Verify TOTP code | No | Auth |
| POST | `/auth/refresh` | Refresh cookie | Refresh access token | No | Standard |
| POST | `/auth/logout` | Authenticated | Logout and revoke session | No | Standard |
| GET | `/auth/sso/initiate` | Public | Initiate SSO flow | No | Auth |
| POST | `/auth/sso/callback` | Public | SSO callback handler | No | Auth |
| POST | `/auth/password/change` | Authenticated | Change password | Yes | Auth |

### Organizations (`/api/v1/organizations`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/organizations/current` | Authenticated | Get current org profile |
| PATCH | `/organizations/current` | `admin.manage_settings` | Update org settings |
| GET | `/organizations/business-units` | Authenticated | List BUs |
| GET | `/organizations/plants` | Authenticated | List plants |
| GET | `/organizations/cost-centers` | Authenticated | List cost centers |
| GET | `/organizations/departments` | Authenticated | List departments |

### Users (`/api/v1/users`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/users` | `user.view` | List users |
| POST | `/users` | `user.create` | Create user |
| GET | `/users/{id}` | `user.view` | Get user detail |
| PATCH | `/users/{id}` | `user.update` | Update user |
| POST | `/users/{id}/roles` | `user.assign_role` | Assign role |
| DELETE | `/users/{id}/roles/{role_id}` | `user.assign_role` | Remove role |
| POST | `/users/{id}/force-logout` | `user.force_logout` | Force logout user |
| GET | `/users/{id}/delegations` | `user.manage_delegation` | List delegations |
| POST | `/users/{id}/delegations` | `user.manage_delegation` | Create delegation |

### Master Data (`/api/v1/master-data`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/master-data/categories` | Authenticated | List categories |
| POST | `/master-data/categories` | `master.category.create` | Create category |
| PATCH | `/master-data/categories/{id}` | `master.category.update` | Update category |
| GET | `/master-data/uom` | Authenticated | List UOM |
| GET | `/master-data/currencies` | Authenticated | List currencies |
| GET | `/master-data/payment-terms` | Authenticated | List payment terms |
| GET | `/master-data/incoterms` | Authenticated | List incoterms |
| GET | `/master-data/tax-codes` | Authenticated | List tax codes |
| GET | `/master-data/delivery-locations` | Authenticated | List locations |
| GET | `/master-data/document-types` | Authenticated | List document types |

### Vendors (`/api/v1/vendors`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/vendors` | `vendor.view` | List vendors |
| POST | `/vendors/invite` | `vendor.invite` | Invite vendor |
| POST | `/vendors/register` | Public (token) | Register from invitation |
| GET | `/vendors/{id}` | `vendor.view` | Get vendor detail |
| PATCH | `/vendors/{id}/wizard/{step}` | Vendor (own) | Update onboarding step |
| POST | `/vendors/{id}/submit` | Vendor (own) | Submit for qualification |
| POST | `/vendors/{id}/activate` | `vendor.activate` | Activate vendor |
| POST | `/vendors/{id}/suspend` | `vendor.suspend` | Suspend vendor |
| POST | `/vendors/{id}/reinstate` | `vendor.reinstate` | Reinstate vendor |
| POST | `/vendors/{id}/blacklist/initiate` | `vendor.blacklist` | Initiate blacklisting |
| POST | `/vendors/{id}/blacklist/confirm` | `vendor.blacklist` | Confirm blacklisting |
| POST | `/vendors/bulk-import` | `vendor.invite` | Bulk CSV import |
| GET | `/vendors/{id}/scorecards` | `vendor.manage_scorecard` | Get scorecard history |
| POST | `/vendors/{id}/bank-accounts/{bank_id}/confirm-penny-test` | Vendor (own) | Confirm penny test |

### Purchase Requisitions (`/api/v1/requisitions`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/requisitions` | `pr.view_own` | List PRs |
| POST | `/requisitions` | `pr.create` | Create PR |
| GET | `/requisitions/{id}` | `pr.view_own` | Get PR detail |
| PATCH | `/requisitions/{id}` | `pr.update_own` | Update draft PR |
| POST | `/requisitions/{id}/submit` | `pr.submit` | Submit for approval |
| POST | `/requisitions/{id}/withdraw` | Owner | Withdraw PR |
| POST | `/requisitions/{id}/amend` | Owner | Amend approved PR |
| POST | `/requisitions/merge` | `pr.merge` | Merge PRs |
| POST | `/requisitions/{id}/split` | `pr.split` | Split PR |
| POST | `/requisitions/erp-import` | Service account | ERP import |

### Unmapped PRs (`/api/v1/unmapped-prs`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/unmapped-prs` | `pr.approve` | List unmapped PR queue |
| GET | `/unmapped-prs/{id}` | `pr.approve` | Get exception detail |
| POST | `/unmapped-prs/{id}/map` | `pr.approve` | Submit mapping |
| POST | `/unmapped-prs/bulk-map` | `pr.approve` | Bulk mapping |

### RFQ/Sourcing (`/api/v1/rfqs`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/rfqs` | `rfq.view_own` | List RFQs |
| POST | `/rfqs` | `rfq.create` | Create RFQ draft |
| GET | `/rfqs/{id}` | `rfq.view_own` | Get RFQ detail |
| PATCH | `/rfqs/{id}/wizard/{step}` | `rfq.update` | Update wizard step |
| POST | `/rfqs/{id}/submit` | `rfq.submit` | Submit for approval |
| POST | `/rfqs/{id}/publish` | `rfq.publish` | Publish to bidders |
| POST | `/rfqs/{id}/amend` | `rfq.amend` | Amend RFQ |
| POST | `/rfqs/{id}/cancel` | `rfq.cancel` | Cancel RFQ |
| POST | `/rfqs/{id}/bidders` | `rfq.add_bidders` | Add bidder |
| DELETE | `/rfqs/{id}/bidders/{vendor_id}` | `rfq.add_bidders` | Remove bidder |
| POST | `/rfqs/{id}/open-bids` | `rfq.open_bids` | Open bids |
| POST | `/rfqs/{id}/co-authorize-opening` | `rfq.co_authorize_opening` | Co-authorize |
| GET | `/rfqs/{id}/clarifications` | Authenticated | List clarifications |
| POST | `/rfqs/{id}/clarifications` | Authenticated | Submit question |
| PATCH | `/rfqs/{id}/clarifications/{cid}` | `rfq.manage_clarifications` | Answer question |

### Bids (`/api/v1/bids`)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/bids/{rfq_id}/accept` | Supplier | Accept invitation |
| POST | `/bids/{rfq_id}/regret` | Supplier | Regret invitation |
| PATCH | `/bids/{id}/draft` | Supplier (own) | Save draft |
| POST | `/bids/{id}/submit` | `bid.submit` | Submit bid |
| POST | `/bids/{id}/technical` | `bid.submit` | Submit technical bid |
| POST | `/bids/{id}/reopen` | `bid.reopen` | Reopen for editing |
| GET | `/bids/{id}` | `bid.view_own` | Get bid detail |

### Evaluations (`/api/v1/evaluations`)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/evaluations/rfq/{rfq_id}/technical-evaluators` | `eval.assign_evaluators` | Assign evaluators |
| POST | `/evaluations/{id}/scores` | `eval.submit_technical_scores` | Submit tech scores |
| POST | `/evaluations/rfq/{rfq_id}/finalize-technical` | `eval.assign_evaluators` | Finalize tech eval |
| POST | `/evaluations/rfq/{rfq_id}/generate-cs` | `eval.generate_cs` | Generate CS |
| POST | `/evaluations/cs/{cs_id}/submit` | `eval.generate_cs` | Submit CS for approval |
| GET | `/evaluations/cs/{cs_id}` | `eval.view_cs` | Get CS detail |

### Awards (`/api/v1/awards`)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/awards/from-cs/{cs_id}` | `award.create_arn` | Create ARN from CS |
| GET | `/awards/{id}` | `award.view_arn` | Get ARN detail |
| POST | `/awards/{id}/notify` | `award.notify_vendors` | Notify vendors |

### Contracts, POs, GRN, Invoices, Payments — follow same CRUD pattern with entity-specific endpoints as defined in their respective specs.

### Workflows (`/api/v1/workflows`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/workflows/tasks` | `workflow.view_own_tasks` | List my approval tasks |
| POST | `/workflows/tasks/{id}/action` | Per entity permission | Approve/Reject/Return |
| POST | `/workflows/{id}/force-advance` | `workflow.force_advance` | Admin force advance |
| POST | `/workflows/{id}/cancel` | `workflow.cancel` | Cancel workflow |
| GET | `/workflows/{id}` | `workflow.view_own_tasks` | Get workflow detail |

### Approval Rules (`/api/v1/approval-rules`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/approval-rules` | `rules.view` | List rules |
| POST | `/approval-rules` | `rules.create` | Create rule |
| PATCH | `/approval-rules/{id}` | `rules.update` | Update rule |
| POST | `/approval-rules/simulate` | `rules.simulate` | Simulate rule |
| POST | `/approval-rules/{id}/test-matrix` | `rules.update` | Run test matrix |

### Documents (`/api/v1/documents`)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/documents/upload` | `document.upload` | Upload document |
| GET | `/documents/{id}/download` | `document.download` | Get download URL |
| GET | `/documents/{id}/versions` | `document.view` | List versions |

### Notifications (`/api/v1/notifications`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/notifications` | Authenticated | List my notifications |
| PATCH | `/notifications/{id}/read` | Authenticated | Mark as read |
| GET | `/notifications/preferences` | Authenticated | Get preferences |
| PUT | `/notifications/preferences` | Authenticated | Update preferences |

### Analytics (`/api/v1/analytics`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/analytics/dashboards/{type}` | `analytics.view_dashboards` | Get dashboard data |
| POST | `/analytics/reports` | `analytics.create_reports` | Create custom report |
| GET | `/analytics/reports/{id}` | `analytics.view_dashboards` | Get report results |

### Admin (`/api/v1/admin`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/admin/feature-flags` | `admin.manage_feature_flags` | List feature flags |
| PATCH | `/admin/feature-flags/{key}` | `admin.manage_feature_flags` | Toggle flag |
| GET | `/admin/audit-logs` | `admin.view_audit_logs` | Query audit logs |
| GET | `/admin/system-info` | `admin.system_info` | System info |

## 8. Webhook Endpoints

| Path | Source | Auth | Processing |
|---|---|---|---|
| `POST /api/v1/webhooks/email/bounce` | SendGrid | Signature validation | Async via Celery |
| `POST /api/v1/webhooks/esign/callback` | Digio/DocuSign | Signature validation | Async via Celery |
| `POST /api/v1/webhooks/bank-validation/callback` | Razorpay | Signature validation | Async via Celery |
| `POST /api/v1/webhooks/erp/vendor` | ERP system | API key + IP allowlist | Async via Celery |
| `POST /api/v1/webhooks/erp/payment` | ERP system | API key + IP allowlist | Async via Celery |
| `POST /api/v1/webhooks/hrms/employee` | HRMS | API key + IP allowlist | Async via Celery |

## 9. Health and Operational Endpoints

`GET /health`, `GET /health/ready`, `GET /health/live`, `GET /metrics` (Prometheus)
