# SPEC_07_VENDOR_MANAGEMENT.md

## Title
Enterprise S2P Procurement Portal — Vendor Management

## Purpose
Define the complete vendor lifecycle from invitation through blacklisting, including all validation rules, duplicate detection, external API verification, bank validation, ERP sync, compliance tracking, scorecard calculation, and the full vendor state machine.

## Scope
Covers all onboarding channels, duplicate detection algorithm, GST/PAN/CIN external verification, bank penny test, VendorService class, compliance document expiry monitoring, blacklisting dual-approval flow, vendor scorecard formula, ERP bidirectional sync, and the complete vendor state machine with all transitions.

## Dependencies
- SPEC_03_DATABASE.md (vendors, vendor_contacts, vendor_documents, vendor_bank_accounts, vendor_category_mappings, vendor_scorecards, vendor_erp_sync_log tables)
- SPEC_04_AUTH_SECURITY.md (supplier roles, field-level encryption)
- SPEC_05_WORKFLOW_ENGINE.md (VENDOR_ONBOARDING_APPROVAL, VENDOR_QUALIFICATION templates)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. Onboarding Channels

### 1.1 Invite-Based Onboarding

```
1. Buyer/Vendor Admin: POST /api/v1/vendors/invite
   Body: { "company_name", "primary_email", "primary_phone", "category_ids", "invited_note" }
2. System generates tokenized invitation link:
   - Token: 128-char secure random (secrets.token_urlsafe(96))
   - TTL: 7 days (stored in vendors.invitation_expires_at)
   - Link: https://supplier.procurement.example.com/register?token={token}
3. Email sent via NotificationService with invitation link
4. Vendor clicks link → token validated → registration wizard opens pre-filled with company_name and email
5. Vendor completes registration wizard (multi-step form)
6. On wizard completion → status transitions INVITED → REGISTRATION_IN_PROGRESS → SUBMITTED
```

### 1.2 Self-Registration (If Enabled)

```
1. Supplier navigates to https://supplier.procurement.example.com/register
2. Feature flag check: tenant_settings.allow_self_registration == true
3. Supplier fills registration wizard from scratch (no pre-fill)
4. On submission: vendor created with status = SUBMITTED
5. Additional validation: CAPTCHA required, email domain verification
6. Admin notification: "New self-registered vendor pending review"
```

### 1.3 Bulk CSV Import

```
1. Vendor Admin: POST /api/v1/vendors/bulk-import (multipart CSV upload)
2. CSV schema: company_name, legal_name, pan, gstin, primary_email, primary_phone, category_codes[], address fields
3. Celery task: process_vendor_bulk_import
   - Parse CSV; validate each row against Pydantic schema
   - Run duplicate detection per row
   - For each valid row: create vendor with status = SUBMITTED
   - For each invalid row: add to error report
4. Result: { "total": 150, "imported": 142, "errors": 8, "error_report_url": "..." }
5. Error report stored in MinIO audit-documents bucket
```

### 1.4 ERP Master Sync

```
1. Celery Beat or webhook trigger: ERP sends vendor master data
2. IntegrationService.process_erp_vendor_sync(payload)
3. Match by erp_vendor_code or PAN
4. If match found: update non-critical fields (address, phone, contact); flag critical field changes (bank, PAN) for manual review
5. If no match: create vendor with status = ACTIVE (pre-qualified by ERP); set erp_vendor_code
6. Publish vendor.erp_synced event
```

---

## 2. Duplicate Detection Algorithm

Executed at vendor creation (all channels) and before qualification approval.

```python
# app/modules/vendor/service.py

async def detect_duplicates(
    self, db: AsyncSession, org_id: UUID,
    pan: str, gstin: str, company_name: str,
    email: str, bank_account: str, ifsc: str
) -> DuplicateCheckResult:
    
    result = DuplicateCheckResult()

    # 1. PAN exact match — HARD BLOCK
    if pan:
        existing = await self.repo.find_by_pan(db, org_id, pan)
        if existing:
            result.add_hard_block("PAN_DUPLICATE", f"PAN {pan} already registered", existing.id)

    # 2. GSTIN uniqueness per state — HARD BLOCK
    if gstin:
        existing = await self.repo.find_by_gstin(db, org_id, gstin)
        if existing:
            result.add_hard_block("GSTIN_DUPLICATE", f"GSTIN {gstin} already registered", existing.id)

    # 3. Company name fuzzy match — SOFT WARNING
    if company_name:
        all_vendors = await self.repo.get_active_vendor_names(db, org_id)
        for v in all_vendors:
            similarity = levenshtein_ratio(company_name.lower(), v.company_name.lower())
            if similarity > 0.85:
                result.add_soft_warning(
                    "NAME_SIMILAR",
                    f"Company name '{company_name}' is {similarity:.0%} similar to '{v.company_name}'",
                    v.id
                )

    # 4. Email domain — SOFT WARNING
    if email:
        domain = email.split("@")[1] if "@" in email else None
        if domain:
            same_domain = await self.repo.find_by_email_domain(db, org_id, domain)
            if same_domain:
                result.add_soft_warning(
                    "EMAIL_DOMAIN_MATCH",
                    f"Email domain @{domain} matches existing vendor(s)",
                    same_domain[0].id
                )

    # 5. Bank account + IFSC exact match — FRAUD FLAG
    if bank_account and ifsc:
        existing = await self.repo.find_by_bank_ifsc(db, org_id, bank_account, ifsc)
        if existing:
            result.add_fraud_flag(
                "BANK_ACCOUNT_DUPLICATE",
                f"Bank account + IFSC combination matches existing vendor",
                existing.id
            )

    return result
```

**Levenshtein ratio:** Uses `python-Levenshtein` library's `ratio()` function. Threshold of 0.85 balances between catching genuine duplicates and avoiding false positives on common company name patterns.

**Duplicate check outcomes:**
- Hard block → Registration rejected; user shown existing vendor reference
- Soft warning → Registration continues; warning displayed to registering user and admin reviewer
- Fraud flag → Registration continues; alert sent to Compliance Officer and Vendor Admin; vendor flagged in admin dashboard

---

## 3. External API Integrations for Vendor Verification

### 3.1 GST Portal API (GSTIN Verification)

```python
# app/modules/vendor/verification.py

class GSTVerificationService:
    async def verify_gstin(self, gstin: str) -> GSTVerificationResult:
        cache_key = f"vendor_verify:gst:{gstin}"
        cached = await self.redis.get(cache_key)
        if cached:
            return GSTVerificationResult.from_cache(cached)

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{settings.GST_API_BASE_URL}/taxpayer/{gstin}",
                    headers={"Authorization": f"Bearer {settings.GST_API_KEY}"}
                )
                response.raise_for_status()
                data = response.json()

                result = GSTVerificationResult(
                    gstin=gstin,
                    is_valid=True,
                    legal_name=data["lgnm"],
                    trade_name=data["tradeNam"],
                    status=data["sts"],  # "Active" or "Cancelled"
                    state_code=data["stcd"],
                    registration_date=data["rgdt"],
                    last_filed_return=data.get("lstfiledDt"),
                    legal_name_match=self._fuzzy_match(data["lgnm"], vendor_legal_name),
                )
                await self.redis.setex(cache_key, 7776000, result.to_cache())  # 90-day cache
                return result

            except httpx.HTTPStatusError:
                return GSTVerificationResult(gstin=gstin, is_valid=False, error="API_ERROR", flag_for_manual_review=True)
            except httpx.TimeoutException:
                return GSTVerificationResult(gstin=gstin, is_valid=False, error="TIMEOUT", flag_for_manual_review=True)
```

**Checks performed:**
- GSTIN active status (must be "Active")
- Legal name match against vendor-declared legal name (fuzzy, >80%)
- Last filed return date (flag if >6 months stale)
- Failure handling: API failure or timeout → vendor flagged for manual review; onboarding not blocked

### 3.2 NSDL/Traces API (PAN Verification)

```python
class PANVerificationService:
    async def verify_pan(self, pan: str, name: str) -> PANVerificationResult:
        cache_key = f"vendor_verify:pan:{pan}"
        cached = await self.redis.get(cache_key)
        if cached:
            return PANVerificationResult.from_cache(cached)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.NSDL_API_BASE_URL}/verify",
                json={"pan": pan, "name": name},
                headers={"Authorization": f"Bearer {settings.NSDL_API_KEY}"}
            )
            data = response.json()
            result = PANVerificationResult(
                pan=pan, is_valid=data["valid"],
                name_on_pan=data.get("name"), name_match=data.get("name_match"),
                pan_status=data.get("status"),
            )
            await self.redis.setex(cache_key, 7776000, result.to_cache())
            return result
```

### 3.3 MCA21 API (CIN Verification)

For companies registered under Companies Act — verifies CIN, fetches company status, incorporation date, authorized capital.

### 3.4 D&B API (DUNS for Foreign Vendors)

For foreign vendors — fetches DUNS number verification, credit rating, company profile. Used in Phase 2+ for supplier risk scoring.

**Common patterns for all verification APIs:**
- Async HTTP calls via `httpx.AsyncClient`
- 90-day Redis cache per verification result
- Failure handling: flag for manual review; never block onboarding
- Retry: 3 attempts with exponential backoff (1s, 5s, 15s)
- Rate limiting: queue requests to avoid GST portal rate limits (max 10 req/min)

---

## 4. Bank Validation (Penny Test)

### 4.1 Flow

```
1. Vendor submits bank details: account_number, ifsc_code, account_holder_name, bank_name, branch
2. VendorService.initiate_penny_test(vendor_bank_id)
3. Call Razorpay IMPS penny test API:
   POST https://api.razorpay.com/v1/fund_accounts
   Body: { "contact_id", "account_type": "bank_account", "bank_account": { "ifsc": "...", "account_number": "..." } }
4. Razorpay sends ₹1 to the account
5. penny_test_status = PENNY_TEST_INITIATED; penny_test_reference stored
6. Vendor receives ₹1; confirms the amount in supplier portal
7. POST /api/v1/vendors/{vendor_id}/bank-accounts/{bank_id}/confirm-penny-test
   Body: { "amount_received": 1.00 }
8. If amount matches → penny_test_status = VALIDATED; penny_test_validated_at set
9. If amount mismatch → penny_test_status = FAILED; Finance team notified for manual review
```

### 4.2 Modes

| Mode | Behavior | Configuration |
|---|---|---|
| Strict | Bank account must pass penny test before vendor activation | `tenant_settings.bank_validation_mode = "strict"` |
| Permissive | Penny test initiated but vendor activation not blocked; Finance team validates separately | `tenant_settings.bank_validation_mode = "permissive"` |

### 4.3 Storage

Penny test validation certificate (Razorpay response) stored in MinIO `compliance-documents` bucket under `{org_id}/vendor/{vendor_id}/bank_validation/{uuid}/penny_test_certificate.json`.

---

## 5. VendorService Class

```python
# app/modules/vendor/service.py

class VendorService:

    async def invite_vendor(
        self, db: AsyncSession, data: VendorInviteRequest,
        actor: User, org_id: UUID
    ) -> Vendor:
        """Generate invitation token, create vendor record, send invitation email."""
        dup_check = await self.detect_duplicates(db, org_id, None, None, data.company_name, data.primary_email, None, None)
        if dup_check.has_hard_blocks:
            raise ConflictError("VENDOR_DUPLICATE", dup_check.hard_block_message)
        token = secrets.token_urlsafe(96)
        vendor = Vendor(
            org_id=org_id, company_name=data.company_name, primary_email=data.primary_email,
            status=VendorStatus.INVITED, invitation_token=token,
            invitation_expires_at=datetime.utcnow() + timedelta(days=7),
            invited_by=actor.id,
        )
        db.add(vendor)
        await db.flush()
        await self.publisher.publish("procurement.vendor", "vendor.invited", {"vendor_id": str(vendor.id), "email": data.primary_email}, org_id)
        await self._audit(db, vendor, "VENDOR_INVITED", actor, org_id)
        return vendor

    async def register_vendor(
        self, db: AsyncSession, token: str, data: VendorRegistrationRequest
    ) -> Vendor:
        """Complete vendor registration from invitation link."""
        vendor = await self.repo.get_by_invitation_token(db, token)
        if not vendor or vendor.invitation_expires_at < datetime.utcnow():
            raise AppException("INVALID_TOKEN", "Invitation expired or invalid", 400)
        dup_check = await self.detect_duplicates(db, vendor.org_id, data.pan, data.gstin, data.company_name, vendor.primary_email, None, None)
        if dup_check.has_hard_blocks:
            raise ConflictError("VENDOR_DUPLICATE", dup_check.hard_block_message)
        vendor.legal_name = data.legal_name
        vendor.pan = data.pan
        vendor.pan_encrypted = encrypt_field(data.pan) if data.pan else None
        vendor.gstin = data.gstin
        vendor.gstin_encrypted = encrypt_field(data.gstin) if data.gstin else None
        vendor.cin = data.cin
        vendor.address_line1 = data.address_line1
        vendor.city = data.city
        vendor.state = data.state
        vendor.postal_code = data.postal_code
        vendor.status = VendorStatus.REGISTRATION_IN_PROGRESS
        vendor.invitation_token = None
        return vendor

    async def update_onboarding_step(
        self, db: AsyncSession, vendor_id: UUID, step: int,
        data: dict, org_id: UUID
    ) -> Vendor:
        """Update vendor onboarding wizard step data."""
        vendor = await self.repo.get(db, vendor_id, org_id)
        vendor.onboarding_step = step
        # Step-specific data handling (contacts, documents, bank accounts, categories)
        return vendor

    async def submit_for_qualification(
        self, db: AsyncSession, vendor_id: UUID, org_id: UUID
    ) -> Vendor:
        """Vendor completes onboarding wizard and submits for qualification."""
        vendor = await self.repo.get(db, vendor_id, org_id)
        self._validate_onboarding_complete(vendor)
        vendor.status = VendorStatus.SUBMITTED
        vendor.submitted_at = datetime.utcnow()
        # Trigger external verifications (async)
        await self._trigger_verifications(db, vendor, org_id)
        # Instantiate qualification workflow
        await self.workflow_engine.instantiate(db, "VENDOR_ONBOARDING_APPROVAL", "VENDOR", vendor.id,
            {"vendor_id": str(vendor.id), "company_name": vendor.company_name, "created_by": str(vendor.invited_by)}, org_id, vendor.invited_by)
        await self.publisher.publish("procurement.vendor", "vendor.submitted", {"vendor_id": str(vendor.id)}, org_id)
        return vendor

    async def request_resubmission(
        self, db: AsyncSession, vendor_id: UUID, reason: str,
        actor: User, org_id: UUID
    ) -> Vendor:
        """Request vendor to resubmit documents/information."""
        vendor = await self.repo.get(db, vendor_id, org_id)
        vendor.status = VendorStatus.RESUBMISSION_REQUESTED
        await self.publisher.publish("procurement.vendor", "vendor.resubmission_requested",
            {"vendor_id": str(vendor.id), "reason": reason}, org_id)
        await self._audit(db, vendor, "VENDOR_RESUBMISSION_REQUESTED", actor, org_id)
        return vendor

    async def approve_qualification(
        self, db: AsyncSession, vendor_id: UUID, actor: User, org_id: UUID
    ) -> Vendor:
        """Approve vendor qualification after workflow completion."""
        vendor = await self.repo.get(db, vendor_id, org_id)
        vendor.status = VendorStatus.QUALIFIED
        vendor.qualified_at = datetime.utcnow()
        await self.publisher.publish("procurement.vendor", "vendor.qualified", {"vendor_id": str(vendor.id)}, org_id)
        await self._audit(db, vendor, "VENDOR_QUALIFIED", actor, org_id)
        return vendor

    async def reject_qualification(
        self, db: AsyncSession, vendor_id: UUID, reason: str,
        actor: User, org_id: UUID
    ) -> Vendor:
        """Reject vendor qualification."""
        vendor = await self.repo.get(db, vendor_id, org_id)
        vendor.status = VendorStatus.DEACTIVATED
        await self.publisher.publish("procurement.vendor", "vendor.rejected", {"vendor_id": str(vendor.id), "reason": reason}, org_id)
        await self._audit(db, vendor, "VENDOR_REJECTED", actor, org_id)
        return vendor

    async def activate_vendor(
        self, db: AsyncSession, vendor_id: UUID, actor: User, org_id: UUID
    ) -> Vendor:
        """Activate qualified vendor. Triggers ERP sync."""
        vendor = await self.repo.get(db, vendor_id, org_id)
        if vendor.status != VendorStatus.QUALIFIED:
            raise AppException("INVALID_STATE", "Vendor must be QUALIFIED to activate")
        vendor.status = VendorStatus.ACTIVE
        vendor.activated_at = datetime.utcnow()
        vendor.vendor_code = await self._generate_vendor_code(db, org_id)
        await self.publisher.publish("procurement.vendor", "vendor.activated", {"vendor_id": str(vendor.id)}, org_id)
        await self._audit(db, vendor, "VENDOR_ACTIVATED", actor, org_id)
        return vendor

    async def suspend_vendor(
        self, db: AsyncSession, vendor_id: UUID, reason: str,
        actor: User, org_id: UUID
    ) -> Vendor:
        """Suspend an active vendor."""
        vendor = await self.repo.get(db, vendor_id, org_id)
        vendor.status = VendorStatus.SUSPENDED
        vendor.suspension_reason = reason
        await self.publisher.publish("procurement.vendor", "vendor.suspended", {"vendor_id": str(vendor.id), "reason": reason}, org_id)
        await self._audit(db, vendor, "VENDOR_SUSPENDED", actor, org_id)
        return vendor

    async def reinstate_vendor(
        self, db: AsyncSession, vendor_id: UUID, actor: User, org_id: UUID
    ) -> Vendor:
        """Reinstate a suspended vendor."""
        vendor = await self.repo.get(db, vendor_id, org_id)
        if vendor.status != VendorStatus.SUSPENDED:
            raise AppException("INVALID_STATE", "Only SUSPENDED vendors can be reinstated")
        vendor.status = VendorStatus.ACTIVE
        vendor.suspension_reason = None
        await self.publisher.publish("procurement.vendor", "vendor.reinstated", {"vendor_id": str(vendor.id)}, org_id)
        await self._audit(db, vendor, "VENDOR_REINSTATED", actor, org_id)
        return vendor

    async def initiate_blacklisting(
        self, db: AsyncSession, vendor_id: UUID, reason: str,
        actor: User, org_id: UUID
    ) -> Vendor:
        """Compliance Officer initiates blacklisting. Requires second confirmation."""
        if not await self._user_has_role(db, actor.id, "COMPLIANCE_OFFICER", org_id):
            raise ForbiddenError("BLACKLIST_REQUIRES_COMPLIANCE_OFFICER")
        vendor = await self.repo.get(db, vendor_id, org_id)
        vendor.blacklist_reason = reason
        vendor.blacklist_initiated_by = actor.id
        await self.publisher.publish("procurement.vendor", "vendor.blacklist_initiated",
            {"vendor_id": str(vendor.id), "reason": reason}, org_id)
        await self._audit(db, vendor, "VENDOR_BLACKLIST_INITIATED", actor, org_id)
        return vendor

    async def confirm_blacklisting(
        self, db: AsyncSession, vendor_id: UUID, actor: User, org_id: UUID
    ) -> Vendor:
        """Procurement Head confirms blacklisting. Completes dual-approval."""
        if not await self._user_has_role(db, actor.id, "PROCUREMENT_HEAD", org_id):
            raise ForbiddenError("BLACKLIST_REQUIRES_PROCUREMENT_HEAD")
        vendor = await self.repo.get(db, vendor_id, org_id)
        if vendor.blacklist_initiated_by == actor.id:
            raise AppException("SOD_VIOLATION", "Initiator cannot confirm blacklisting")
        if not vendor.blacklist_initiated_by:
            raise AppException("INVALID_STATE", "Blacklisting not initiated")
        vendor.status = VendorStatus.BLACKLISTED
        vendor.blacklisted_at = datetime.utcnow()
        vendor.blacklist_confirmed_by = actor.id
        # Check active RFQs with this vendor
        affected_rfqs = await self.sourcing_repo.get_active_rfqs_for_vendor(db, vendor_id, org_id)
        for rfq in affected_rfqs:
            rfq.status = RFQStatus.COMPLIANCE_HOLD
        await self.publisher.publish("procurement.vendor", "vendor.blacklisted",
            {"vendor_id": str(vendor.id), "affected_rfq_count": len(affected_rfqs)}, org_id)
        await self._audit(db, vendor, "VENDOR_BLACKLISTED", actor, org_id)
        return vendor

    async def sync_to_erp(self, db: AsyncSession, vendor_id: UUID, org_id: UUID) -> None:
        """Push vendor data to ERP via IntegrationService."""
        vendor = await self.repo.get(db, vendor_id, org_id)
        await self.integration_service.push_vendor_to_erp(db, vendor, org_id)

    async def check_compliance_expiry(self, db: AsyncSession, org_id: UUID) -> None:
        """Celery Beat task: check all vendor document expiry dates."""
        # Implementation in Section 6

    async def update_scorecard(self, db: AsyncSession, vendor_id: UUID, org_id: UUID) -> VendorScorecard:
        """Calculate and store vendor scorecard."""
        # Implementation in Section 7
```

---

## 6. Compliance Document Expiry Check

```python
# app/tasks/vendor_compliance.py

@celery_app.task(queue="celery.integration")
async def check_vendor_compliance_expiry():
    """Runs daily at 02:00 UTC. Checks all vendor document expiry dates."""
    async with async_session_factory() as db:
        orgs = await org_repo.get_all_active(db)
        for org in orgs:
            vendors = await vendor_repo.get_active_vendors(db, org.id)
            for vendor in vendors:
                docs = await vendor_doc_repo.get_expiring_docs(db, vendor.id, org.id)
                for doc in docs:
                    days_until_expiry = (doc.expiry_date - date.today()).days

                    if days_until_expiry <= 0 and vendor.status != VendorStatus.COMPLIANCE_HOLD:
                        # Document expired — place vendor on compliance hold
                        vendor.status = VendorStatus.COMPLIANCE_HOLD
                        # Pause ERP sync
                        vendor.erp_sync_status = "PAUSED_COMPLIANCE_HOLD"
                        await publisher.publish("procurement.vendor", "vendor.compliance_hold",
                            {"vendor_id": str(vendor.id), "document": doc.document_type.name, "expired_on": str(doc.expiry_date)}, org.id)

                    elif days_until_expiry <= 30:
                        # 30-day warning — escalation
                        await publisher.publish("procurement.notification", "notification.vendor_compliance_escalation",
                            {"vendor_id": str(vendor.id), "document": doc.document_type.name, "days_remaining": days_until_expiry}, org.id)

                    elif days_until_expiry <= 90:
                        # 90-day warning
                        await publisher.publish("procurement.notification", "notification.vendor_compliance_warning",
                            {"vendor_id": str(vendor.id), "document": doc.document_type.name, "days_remaining": days_until_expiry}, org.id)

            await db.commit()
```

---

## 7. Vendor Scorecard Calculation

```python
# app/modules/vendor/scorecard.py

# Runs quarterly via Celery Beat task

async def calculate_vendor_scorecard(db: AsyncSession, vendor_id: UUID, org_id: UUID, period_start: date, period_end: date) -> VendorScorecard:

    # 1. On-Time Delivery Rate (weight: 0.40)
    pos = await po_repo.get_delivered_pos(db, vendor_id, org_id, period_start, period_end)
    on_time_count = sum(1 for po in pos if po.actual_delivery_date <= po.expected_delivery_date)
    on_time_delivery_rate = (on_time_count / len(pos) * 100) if pos else 100.0

    # 2. Quality Acceptance Rate (weight: 0.30)
    grns = await grn_repo.get_grns_for_vendor(db, vendor_id, org_id, period_start, period_end)
    total_received = sum(g.received_quantity for g in grns)
    total_accepted = sum(g.accepted_quantity for g in grns)
    quality_acceptance_rate = (total_accepted / total_received * 100) if total_received > 0 else 100.0

    # 3. Commercial Compliance Score (weight: 0.20)
    invoices = await invoice_repo.get_invoices_for_vendor(db, vendor_id, org_id, period_start, period_end)
    matched_invoices = sum(1 for inv in invoices if inv.match_status == "MATCHED")
    commercial_compliance = (matched_invoices / len(invoices) * 100) if invoices else 100.0

    # 4. Responsiveness Score (weight: 0.10)
    bids = await bid_repo.get_bids_for_vendor(db, vendor_id, org_id, period_start, period_end)
    accepted_invitations = sum(1 for b in bids if b.status not in ("INVITED", "REGRETTED"))
    responsiveness = (accepted_invitations / len(bids) * 100) if bids else 100.0

    # Weighted formula
    overall_score = (
        on_time_delivery_rate * 0.40 +
        quality_acceptance_rate * 0.30 +
        commercial_compliance * 0.20 +
        responsiveness * 0.10
    )

    scorecard = VendorScorecard(
        org_id=org_id, vendor_id=vendor_id,
        period_start=period_start, period_end=period_end,
        on_time_delivery_rate=round(on_time_delivery_rate, 2),
        quality_acceptance_rate=round(quality_acceptance_rate, 2),
        commercial_compliance_score=round(commercial_compliance, 2),
        responsiveness_score=round(responsiveness, 2),
        overall_score=round(overall_score, 2),
    )
    db.add(scorecard)

    # Update vendor profile
    vendor = await vendor_repo.get(db, vendor_id, org_id)
    vendor.performance_score = scorecard.overall_score
    vendor.last_scorecard_at = datetime.utcnow()

    # Advisory flag if score < 60
    if overall_score < 60:
        await publisher.publish("procurement.vendor", "vendor.low_performance",
            {"vendor_id": str(vendor_id), "score": overall_score}, org_id)

    return scorecard
```

---

## 8. ERP Sync Bidirectional Logic

### 8.1 Portal → ERP (Vendor Activation)

```
1. vendor.activated event published to procurement.vendor exchange
2. IntegrationService consumer receives event
3. IntegrationService.push_vendor_to_erp(vendor):
   a. Map portal vendor fields to ERP payload (adapter-specific)
   b. POST to ERP vendor creation API
   c. ERP returns ERP vendor code
   d. Store in vendor.erp_vendor_code
   e. Create vendor_erp_sync_log record (direction=OUTBOUND, status=COMPLETED)
   f. vendor.erp_sync_status = "SYNCED"
4. On ERP API failure:
   a. Create integration_jobs record (status=FAILED)
   b. vendor.erp_sync_status = "SYNC_FAILED"
   c. Retry via retry_failed_integration_jobs Celery task
```

### 8.2 ERP → Portal (Vendor Update)

```
1. ERP sends webhook or batch file with vendor updates
2. IntegrationService.process_erp_vendor_update(payload):
   a. Match by erp_vendor_code
   b. Non-critical fields (address, phone, contact name): auto-update
   c. Critical fields (bank account, PAN, tax registration): flag for manual review; create admin notification
   d. Create vendor_erp_sync_log record (direction=INBOUND)
3. Conflict resolution:
   - If portal field was updated more recently than ERP field: keep portal value; log conflict
   - If ERP field is more recent: update portal; log change
   - Critical fields: always require manual review regardless of timestamp
```

---

## 9. Vendor State Machine

### 9.1 All 11 States

| State | Description |
|---|---|
| `INVITED` | Invitation sent; awaiting vendor registration |
| `REGISTRATION_IN_PROGRESS` | Vendor has started registration wizard |
| `SUBMITTED` | Vendor completed registration; under review |
| `UNDER_REVIEW` | Qualification workflow in progress |
| `RESUBMISSION_REQUESTED` | Reviewer requested additional info from vendor |
| `QUALIFIED` | Qualification approved; ready for activation |
| `ACTIVE` | Fully active; can participate in RFQs |
| `SUSPENDED` | Temporarily suspended by admin |
| `COMPLIANCE_HOLD` | Compliance document expired; ERP sync paused |
| `BLACKLISTED` | Permanently blacklisted (dual approval) |
| `DEACTIVATED` | Permanently deactivated (rejected or voluntarily) |

### 9.2 All Valid Transitions

| From | To | Trigger | Actor | Required Data | Validations | Side Effects | Audit Event | RabbitMQ Event |
|---|---|---|---|---|---|---|---|---|
| `INVITED` | `REGISTRATION_IN_PROGRESS` | Vendor starts wizard | Vendor (via token) | Valid token | Token not expired | — | `VENDOR_REGISTRATION_STARTED` | `vendor.registration_started` |
| `INVITED` | `DEACTIVATED` | Invitation expired | System (Celery) | — | Token past TTL | — | `VENDOR_INVITATION_EXPIRED` | `vendor.invitation_expired` |
| `REGISTRATION_IN_PROGRESS` | `SUBMITTED` | Vendor completes wizard | Vendor | All mandatory fields | Onboarding steps complete; duplicate check passed | Trigger verifications; instantiate workflow | `VENDOR_SUBMITTED` | `vendor.submitted` |
| `SUBMITTED` | `UNDER_REVIEW` | Workflow task created | System | — | — | Notification to reviewer | `VENDOR_UNDER_REVIEW` | `vendor.under_review` |
| `UNDER_REVIEW` | `RESUBMISSION_REQUESTED` | Reviewer requests resubmission | Vendor Admin / Category Mgr | Reason text | — | Notification to vendor | `VENDOR_RESUBMISSION_REQUESTED` | `vendor.resubmission_requested` |
| `RESUBMISSION_REQUESTED` | `SUBMITTED` | Vendor resubmits | Vendor | Updated fields | — | Re-trigger verifications if needed | `VENDOR_RESUBMITTED` | `vendor.resubmitted` |
| `UNDER_REVIEW` | `QUALIFIED` | Qualification approved | Category Mgr (via workflow) | — | All qualification checks passed | — | `VENDOR_QUALIFIED` | `vendor.qualified` |
| `UNDER_REVIEW` | `DEACTIVATED` | Qualification rejected | Category Mgr (via workflow) | Rejection reason | — | Notification to vendor | `VENDOR_REJECTED` | `vendor.rejected` |
| `QUALIFIED` | `ACTIVE` | Vendor Admin activates | Vendor Admin | — | Bank validation (if strict mode) | Generate vendor_code; trigger ERP sync | `VENDOR_ACTIVATED` | `vendor.activated` |
| `ACTIVE` | `SUSPENDED` | Admin suspends | Procurement Head / Compliance | Suspension reason | — | Pause ERP sync; flag in active RFQs | `VENDOR_SUSPENDED` | `vendor.suspended` |
| `SUSPENDED` | `ACTIVE` | Admin reinstates | Procurement Head | — | Compliance docs valid | Resume ERP sync | `VENDOR_REINSTATED` | `vendor.reinstated` |
| `ACTIVE` | `COMPLIANCE_HOLD` | Document expired | System (Celery) | — | Expired document detected | Pause ERP sync; notify vendor + admin | `VENDOR_COMPLIANCE_HOLD` | `vendor.compliance_hold` |
| `COMPLIANCE_HOLD` | `ACTIVE` | Vendor uploads valid doc | Vendor Admin (after doc review) | New document | Document verified and valid | Resume ERP sync | `VENDOR_COMPLIANCE_RESTORED` | `vendor.compliance_restored` |
| `ACTIVE` | `BLACKLISTED` | Dual-approval blacklisting | Compliance + Proc Head | Reason; dual confirmation | Both roles acted; different users | Cancel active bids; hold affected RFQs; pause ERP | `VENDOR_BLACKLISTED` | `vendor.blacklisted` |
| `SUSPENDED` | `BLACKLISTED` | Dual-approval blacklisting | Compliance + Proc Head | Reason; dual confirmation | Both roles acted; different users | Same as above | `VENDOR_BLACKLISTED` | `vendor.blacklisted` |
| `ACTIVE` | `DEACTIVATED` | Voluntary deactivation | Vendor Admin / Proc Admin | Reason | No active POs with pending deliveries | Pause ERP sync | `VENDOR_DEACTIVATED` | `vendor.deactivated` |
| `SUSPENDED` | `DEACTIVATED` | Admin deactivates | Proc Admin | Reason | — | — | `VENDOR_DEACTIVATED` | `vendor.deactivated` |

### 9.3 Invalid Transitions (Explicitly Blocked)

- `BLACKLISTED` → any state (permanent; no reversal)
- `DEACTIVATED` → `ACTIVE` (must go through full re-onboarding)
- `INVITED` → `ACTIVE` (must complete registration + qualification)
- `COMPLIANCE_HOLD` → `BLACKLISTED` (must restore compliance first, then blacklist from ACTIVE if needed)
- Any state → `QUALIFIED` (only reachable from UNDER_REVIEW via workflow)
