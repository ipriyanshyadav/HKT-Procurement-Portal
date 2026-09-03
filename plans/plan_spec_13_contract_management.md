# IMPLEMENTATION PLAN — SPEC_13: Contract Management
**Module:** 13 | **Phase:** Core | **Squad:** D
**Spec File:** SPEC_13_CONTRACT_MANAGEMENT.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S13-01 | Contract types (FIXED_PRICE, RATE_CONTRACT, FRAMEWORK, SERVICE_LEVEL, AMC) | contract/models.py | PLANNED |
| S13-02 | 10-status lifecycle FSM | contract/fsm.py | PLANNED |
| S13-03 | Contract number auto-generation | contract/service.py | PLANNED |
| S13-04 | Contract creation from award recommendation | contract/service.py | PLANNED |
| S13-05 | Milestone tracking | contract/models.py | PLANNED |
| S13-06 | eSign integration (Digio / DocuSign) | contract/service.py + integration | PLANNED |
| S13-07 | Contract amendment (formal, versioned) | contract/service.py | PLANNED |
| S13-08 | Auto-renewal logic | contract/service.py + tasks | PLANNED |
| S13-09 | Contract expiry alerts (90/60/30/0 days) | tasks/contract_expiry.py | PLANNED |
| S13-10 | SLA monitoring (contract_milestones) | contract/service.py | PLANNED |
| S13-11 | Contract templates (standard + custom) | contract/service.py | PLANNED |
| S13-12 | Contract approval workflow | contract/service.py + rules_engine | PLANNED |
| S13-13 | Contract storage in MinIO (contract-documents) | contract/service.py | PLANNED |
| S13-14 | PO generation from contract | contract/service.py | PLANNED |
| S13-15 | 14 audit events | contract/service.py | PLANNED |
| S13-16 | Contract performance scoring | contract/service.py | PLANNED |
| S13-17 | Value utilization tracking (for rate contracts) | contract/service.py | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-13-1 | eSign uses Digio as primary provider (Indian market); DocuSign as fallback; provider selected via `tenant_settings.esign_provider` | SPEC Section 6 lists both; no default | MEDIUM | Squad D |
| A-13-2 | Contract expiry at midnight UTC of `end_date`; all timezone conversions handled at display layer | SPEC uses DATE type for end_date | LOW | Squad D |
| A-13-3 | Auto-renewal creates a NEW contract with version incremented; original contract status → EXPIRED; new contract status → ACTIVE (no workflow needed for auto-renewal, only alert) | SPEC Section 8 auto-renewal | MEDIUM | Squad D |
| A-13-4 | Rate contract `utilized_value` updated on every PO generation from this contract; concurrency handled by optimistic lock on contract version | SPEC Section 17 utilization | LOW | Squad D |
| A-13-5 | Contract amendment increments `amendment_number`; all amendments stored in `contract_amendments` table with full snapshot | SPEC Section 7 versioning | LOW | Squad D |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/contract/fsm.py`
```python
CONTRACT_FSM = {
    "DRAFT":           ["PENDING_REVIEW", "CANCELLED"],
    "PENDING_REVIEW":  ["PENDING_ESIGN", "RETURNED"],
    "RETURNED":        ["PENDING_REVIEW", "CANCELLED"],
    "PENDING_ESIGN":   ["ACTIVE", "CANCELLED"],
    "ACTIVE":          ["SUSPENDED", "TERMINATION_NOTICE", "EXPIRED", "AMENDED"],
    "AMENDED":         ["ACTIVE"],
    "SUSPENDED":       ["ACTIVE", "TERMINATED"],
    "TERMINATION_NOTICE": ["TERMINATED"],
    "TERMINATED":      [],
    "EXPIRED":         [],
    "CANCELLED":       [],
}
```

### 2.2 `app/modules/contract/service.py`
```python
class ContractService:

    async def create_from_award(self, db, award_rec_id: UUID, data: ContractCreateRequest,
                                 actor_id: UUID, org_id: UUID) -> Contract:
        award_rec = await self.award_repo.get(db, award_rec_id, org_id)
        if award_rec.status != "APPROVED":
            raise AppException("AWARD_NOT_APPROVED", "Award recommendation must be approved before contract creation")
        contract_number = await self._generate_contract_number(db, org_id)
        contract = Contract(
            org_id=org_id, contract_number=contract_number,
            award_recommendation_id=award_rec_id,
            vendor_id=data.primary_vendor_id, contract_type=data.contract_type,
            title=data.title, start_date=data.start_date, end_date=data.end_date,
            total_value=data.total_value, currency=data.currency,
            auto_renewal=data.auto_renewal, renewal_notice_days=data.renewal_notice_days,
            sla_terms=data.sla_terms or {}, status="DRAFT", created_by=actor_id,
        )
        db.add(contract)
        await db.flush()
        for line_data in data.lines:
            line = ContractLine(org_id=org_id, contract_id=contract.id, **line_data.model_dump())
            db.add(line)
        for milestone_data in data.milestones or []:
            milestone = ContractMilestone(org_id=org_id, contract_id=contract.id, **milestone_data.model_dump())
            db.add(milestone)
        await self.audit.log(db, "CONTRACT", contract.id, "CONTRACT_CREATED", actor_id, org_id)
        return contract

    async def initiate_esign(self, db, contract_id: UUID, actor_id: UUID, org_id: UUID) -> dict:
        contract = await self.repo.get(db, contract_id, org_id)
        validate_contract_transition(contract.status, "PENDING_ESIGN")
        # Upload draft to MinIO
        doc_path = await self._upload_draft_to_minio(contract, org_id)
        contract.status = "PENDING_ESIGN"
        contract.contract_document_path = doc_path
        # Call eSign adapter
        provider = await self.tenant_repo.get_setting(db, org_id, "esign_provider") or "digio"
        if provider == "digio":
            esign_result = await self.digio_adapter.initiate(contract, doc_path)
        else:
            esign_result = await self.docusign_adapter.initiate(contract, doc_path)
        contract.esign_request_id = esign_result["request_id"]
        contract.esign_provider = provider
        await self.audit.log(db, "CONTRACT", contract_id, "CONTRACT_ESIGN_INITIATED", actor_id, org_id)
        return esign_result

    async def confirm_esign_complete(self, db, contract_id: UUID, esign_doc_path: str,
                                      actor_id: UUID, org_id: UUID) -> Contract:
        contract = await self.repo.get(db, contract_id, org_id)
        validate_contract_transition(contract.status, "ACTIVE")
        contract.status = "ACTIVE"
        contract.activated_at = datetime.utcnow()
        contract.signed_document_path = esign_doc_path
        await self.publisher.publish("procurement.contract", "contract.activated",
            {"contract_id": str(contract_id), "vendor_id": str(contract.vendor_id),
             "contract_number": contract.contract_number}, org_id)
        await self.audit.log(db, "CONTRACT", contract_id, "CONTRACT_ACTIVATED", actor_id, org_id)
        return contract

    async def amend_contract(self, db, contract_id: UUID, data: ContractAmendRequest,
                              actor_id: UUID, org_id: UUID) -> Contract:
        contract = await self.repo.get(db, contract_id, org_id)
        validate_contract_transition(contract.status, "AMENDED")
        amendment = ContractAmendment(
            org_id=org_id, contract_id=contract_id,
            amendment_number=contract.amendment_count + 1,
            amendment_type=data.amendment_type,
            change_description=data.change_description,
            original_snapshot={"total_value": float(contract.total_value), "end_date": contract.end_date.isoformat()},
            amended_by=actor_id
        )
        db.add(amendment)
        if data.new_total_value:
            contract.total_value = data.new_total_value
        if data.new_end_date:
            contract.end_date = data.new_end_date
        contract.amendment_count += 1
        contract.status = "AMENDED"
        await self.audit.log(db, "CONTRACT", contract_id, "CONTRACT_AMENDED", actor_id, org_id,
            old_values=amendment.original_snapshot, new_values={"total_value": float(contract.total_value)})
        return contract

    async def update_utilization(self, db, contract_id: UUID, po_value: float, org_id: UUID):
        """Called when PO generated from this contract. Uses optimistic lock."""
        contract = await self.repo.get(db, contract_id, org_id)
        if contract.contract_type == "RATE_CONTRACT":
            new_utilization = float(contract.utilized_value or 0) + po_value
            if new_utilization > float(contract.total_value):
                raise ValidationError("CONTRACT_VALUE_EXCEEDED",
                    f"This PO would exceed contract value. Available: {float(contract.total_value) - float(contract.utilized_value or 0)}")
            contract.utilized_value = new_utilization
            contract.version += 1
```

### 2.3 `app/tasks/contract_expiry.py`
```python
@celery_app.task(queue="celery.maintenance", name="check_contract_expiry")
def check_contract_expiry():
    asyncio.run(_async_check_expiry())

async def _async_check_expiry():
    async with async_session_factory() as db:
        today = date.today()
        for threshold_days in [90, 60, 30, 0]:
            check_date = today + timedelta(days=threshold_days)
            expiring = await contract_repo.get_expiring_on(db, check_date)
            for contract in expiring:
                if threshold_days == 0:
                    if contract.auto_renewal:
                        await _auto_renew(db, contract)
                    else:
                        contract.status = "EXPIRED"
                        await publisher.publish("procurement.contract", "contract.expired",
                            {"contract_id": str(contract.id), "org_id": str(contract.org_id)}, contract.org_id)
                else:
                    await publisher.publish("procurement.notification", "notification.email.contract_expiry",
                        {"contract_id": str(contract.id), "contract_number": contract.contract_number,
                         "days_remaining": threshold_days, "end_date": contract.end_date.isoformat()}, contract.org_id)
        await db.commit()
```

---
## STEP 3 — TEST
```python
async def test_contract_from_unapproved_award_fails(db, factory):
async def test_esign_provider_from_tenant_settings(db, factory):
async def test_auto_renewal_creates_new_contract(db, factory):
async def test_rate_contract_utilization_exceeds_value(db, factory):
    """PO value > remaining contract value → ValidationError."""
async def test_amendment_creates_snapshot(db, factory):
    """ContractAmendment.original_snapshot has pre-amendment values."""
async def test_optimistic_lock_on_utilization(db, factory):
    """Concurrent PO generation doesn't corrupt utilization."""
```
