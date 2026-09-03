# SPEC_17_DOCUMENT_MANAGEMENT.md

## Title
Enterprise S2P Procurement Portal — Document Management

## Purpose
Define MinIO-based document management including upload, virus scanning, hashing, versioning, access control, watermarking, OCR, and retention enforcement.

## Scope
Covers MinIO bucket structure, upload API with magic-bytes validation, ClamAV virus scanning, SHA-256 hashing, pre-signed URLs, document access matrix, watermarking, OCR (Phase 2), retention enforcement, and versioning.

## Dependencies
- SPEC_02_ARCHITECTURE.md (MinIO bucket structure)
- SPEC_03_DATABASE.md (documents, document_versions tables)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. MinIO Bucket Structure

8 primary buckets + 2 internal buckets. See SPEC_02 Section 9 for full details.

All buckets: private access, versioning enabled, SSE-S3 (AES-256) auto-encryption.

## 2. Upload API

```
POST /api/v1/documents/upload
Content-Type: multipart/form-data
Permission: document.upload

Form fields:
  file: (binary)
  entity_type: "VENDOR" | "RFQ" | "BID" | "CONTRACT" | "PO" | "GRN" | "INVOICE"
  entity_id: UUID
  category: document_category enum
  document_type_id: UUID (optional — links to document_types for validation)

Response (201):
{
  "document_id": "uuid",
  "version_number": 1,
  "sha256_hash": "abc123...",
  "scan_status": "CLEAN",
  "file_size_bytes": 1048576,
  "stored_at": "2026-06-27T15:30:00Z"
}
```

### 2.1 Validation Pipeline

```python
async def upload_document(self, db, file: UploadFile, entity_type: str, entity_id: UUID, category: str, org_id: UUID, actor: User):
    # 1. Client-side pre-check: file type and size (enforced in frontend)
    
    # 2. Server-side magic bytes validation
    file_content = await file.read()
    detected_type = magic.from_buffer(file_content[:2048], mime=True)
    if detected_type not in ALLOWED_MIME_TYPES:
        raise AppException("INVALID_FILE_TYPE", f"File type {detected_type} not allowed")
    
    # 3. Size check
    if len(file_content) > MAX_FILE_SIZE:  # 50MB default
        raise AppException("FILE_TOO_LARGE", f"Maximum file size is {MAX_FILE_SIZE // 1048576}MB")
    
    # 4. ClamAV virus scan
    scan_result = await self.scanner.scan(file_content)
    if scan_result == "INFECTED":
        # Quarantine
        await self.minio.put_object("quarantine", quarantine_key, file_content)
        await self._notify_incident(org_id, file.filename, detected_type)
        raise AppException("FILE_INFECTED", "File flagged by virus scanner")
    
    if scan_result == "SCAN_UNAVAILABLE":
        scan_status = "SCAN_PENDING"  # Retry queue
    else:
        scan_status = "CLEAN"
    
    # 5. SHA-256 hash
    file_hash = hashlib.sha256(file_content).hexdigest()
    
    # 6. Store in MinIO
    bucket = CATEGORY_BUCKET_MAP[category]
    minio_key = f"{org_id}/{entity_type}/{entity_id}/{uuid4()}/{sanitize_filename(file.filename)}"
    await self.minio.put_object(bucket, minio_key, file_content, content_type=detected_type)
    
    # 7. Create DB records
    doc = Document(
        org_id=org_id, entity_type=entity_type, entity_id=entity_id,
        category=category, original_filename=file.filename,
        stored_filename=minio_key.split("/")[-1],
        minio_bucket=bucket, minio_key=minio_key,
        content_type=detected_type, file_size_bytes=len(file_content),
        sha256_hash=file_hash, scan_status=scan_status,
        scan_result=scan_result, created_by=actor.id,
    )
    db.add(doc)
    await db.flush()
    
    doc_version = DocumentVersion(
        org_id=org_id, document_id=doc.id, version_number=1,
        minio_key=minio_key, file_size_bytes=len(file_content),
        sha256_hash=file_hash, uploaded_by=actor.id,
    )
    db.add(doc_version)
    
    return doc
```

## 3. ClamAV Virus Scan

```python
# app/modules/document/scanner.py

import clamd

class ClamAVScanner:
    def __init__(self):
        self.clam = clamd.ClamdUnixSocket("/var/run/clamav/clamd.ctl")

    async def scan(self, file_content: bytes) -> str:
        try:
            result = self.clam.instream(BytesIO(file_content))
            status = result["stream"][0]
            return "CLEAN" if status == "OK" else "INFECTED"
        except clamd.ConnectionError:
            return "SCAN_UNAVAILABLE"
```

**Scan unavailable:** Document held in `SCAN_PENDING` state. Celery retry task `retry_pending_scans` runs every 15 minutes.

## 4. Pre-Signed URL Generation

```python
async def get_download_url(self, db, document_id: UUID, actor: User, org_id: UUID) -> str:
    doc = await self.repo.get(db, document_id, org_id)
    
    # Access control check
    if not await self._check_access(actor, doc.category, doc.entity_type, doc.entity_id, org_id):
        raise ForbiddenError("DOCUMENT_ACCESS_DENIED")
    
    # Generate pre-signed URL (15-minute expiry)
    url = self.minio.presigned_get_object(doc.minio_bucket, doc.minio_key, expires=timedelta(minutes=15))
    
    # Audit download event
    await self._audit(db, doc, "DOCUMENT_DOWNLOADED", actor, org_id)
    
    # Apply watermark for contract documents
    if doc.category == DocumentCategory.CONTRACT:
        return await self._get_watermarked_url(db, doc, actor, org_id)
    
    return url
```

## 5. Document Access Matrix

| Category | REQUESTOR | BUYER | SM | CAT_MGR | PROC_HEAD | FC | LEGAL | COMPLIANCE | VENDOR_ADMIN | SUPPLIER | AUDIT |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TENDER | — | R | R | R | R | — | — | — | — | R (after publish) | R |
| BID | — | R (after open) | R (after open) | R (after open) | R (after open) | — | — | R (after open) | — | RW (own) | R |
| COMPLIANCE | — | R | R | R | R | R | — | R | R | RW (own) | R |
| CONTRACT | — | R | R | R | R | R | RW | R | — | R (own) | R |
| PURCHASE_ORDER | R (own) | R | R | R | R | R | — | — | — | R (own) | R |
| GRN_SES | — | R | R | R | R | R | — | — | — | R (own) | R |
| INVOICE | — | R | — | — | R | R | — | — | — | RW (own) | R |
| AUDIT | — | — | — | — | R | — | — | R | — | — | R |

R = Read, W = Write, RW = Read+Write. Access further scoped by `org_id`, BU scope, and entity ownership.

## 6. Bid Document Sealing

At bid submission: bid documents encrypted using RFQ-specific AES-256 key (same key as bid data sealing in SPEC_10). Key stored in MinIO `key-vault` bucket. Decryption only via `BidService.open_bids()` with audit event.

## 7. OCR (Phase 2)

```python
# Async Celery task triggered after scan pass

@celery_app.task(queue="celery.document")
async def extract_document_metadata(document_id: str, org_id: str):
    doc = await doc_repo.get(db, UUID(document_id), UUID(org_id))
    file_content = await minio.get_object(doc.minio_bucket, doc.minio_key)
    
    # Call AWS Textract or Google Document AI
    extracted = await ocr_provider.extract(file_content, doc.content_type)
    
    doc.ocr_extracted_data = {
        "pan": extracted.get("pan"),
        "gstin": extracted.get("gstin"),
        "invoice_number": extracted.get("invoice_number"),
        "invoice_date": extracted.get("invoice_date"),
        "total_amount": extracted.get("total_amount"),
        "confidence_scores": extracted.get("confidence_scores"),
    }
    # Pre-fills form fields; requires human confirmation
```

## 8. Retention Enforcement

Monthly Celery task `enforce_document_retention`:

| Category | Retention Period | Action After Expiry |
|---|---|---|
| TENDER | 7 years | Archive to cold storage bucket; soft-delete from active |
| BID | 7 years | Archive to cold storage; soft-delete |
| COMPLIANCE | 7 years post-vendor-deactivation | Archive; soft-delete |
| CONTRACT | 10 years post-expiry | Archive; soft-delete |
| PURCHASE_ORDER | 10 years | Archive; soft-delete |
| GRN_SES | 7 years | Archive; soft-delete |
| INVOICE | 10 years | Archive; soft-delete |
| AUDIT | Permanent | No deletion |

Each action creates an audit record.

## 9. Document Versioning

Every upload to same `(entity_type, entity_id, document_type)` creates new version:
- `document_versions.version_number` auto-incremented
- Old versions soft-deleted from active view but retained in MinIO
- "Version History" link in UI shows all versions with upload date, uploader, file size
