# IMPLEMENTATION PLAN — SPEC_17: Document Management
**Module:** 17 | **Phase:** Core | **Squad:** E
**Spec File:** SPEC_17_DOCUMENT_MANAGEMENT.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Target | Status |
|---|---|---|
| S17-01 | Upload → ClamAV scan → MinIO store → DB record | document/service.py + scanner.py | PLANNED |
| S17-02 | 11 document types with bucket routing | document/service.py | PLANNED |
| S17-03 | File type validation (magic bytes + extension) | document/scanner.py | PLANNED |
| S17-04 | File size validation (50 MB limit from settings) | document/service.py | PLANNED |
| S17-05 | Presigned URL generation (15-min TTL) | document/service.py | PLANNED |
| S17-06 | Document versioning (version_number increment) | document/service.py | PLANNED |
| S17-07 | Path traversal prevention (sanitize_filename) | document/service.py | PLANNED |
| S17-08 | Soft delete (deleted_at) | document/service.py | PLANNED |
| S17-09 | Compliance expiry date tracking | document/models.py | PLANNED |
| S17-10 | MinIO path convention: {org_id}/{module}/{entity_id}/{filename} | document/service.py | PLANNED |
| S17-11 | Quarantine bucket for infected files | document/scanner.py | PLANNED |
| S17-12 | Audit trail for all document operations | document/service.py | PLANNED |
| S17-13 | Document type ↔ bucket mapping | document/service.py | PLANNED |
| S17-14 | Async ClamAV scan via Celery task | tasks/document_scan.py | PLANNED |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-17-1 | ClamAV scan runs async via Celery; file stored with `scan_status=PENDING` immediately; status updated to CLEAN/INFECTED after scan | Sync scan blocks upload endpoint | MEDIUM — file accessible before scan | Squad E |
| A-17-2 | Infected files moved to `quarantine` bucket; original MinIO path deleted; `documents.scan_status=INFECTED` | SPEC Section 11 quarantine | LOW | Squad E |
| A-17-3 | Presigned URL TTL = 900 seconds (15 min); NOT stored in DB; generated on demand | SPEC Section 5 presigned URL | LOW | Squad E |
| A-17-4 | `sanitize_filename()` strips path separators, null bytes, and non-ASCII; replaces spaces with underscores; truncates to 255 chars | SPEC Section 7 path traversal | LOW | Squad E |
| A-17-5 | ALLOWED_MIME_TYPES by document_type stored in config (not DB); validated against python-magic result | SPEC Section 3 magic bytes | LOW | Squad E |

---
## STEP 2 — IMPLEMENT

### 2.1 `app/modules/document/scanner.py`
```python
import magic
import subprocess
from app.config import settings

ALLOWED_MIME_TYPES = {
    "GSTIN_CERTIFICATE":        ["application/pdf", "image/jpeg", "image/png"],
    "PAN_CARD":                 ["application/pdf", "image/jpeg", "image/png"],
    "BANK_DETAILS":             ["application/pdf", "image/jpeg", "image/png"],
    "INCORPORATION_CERTIFICATE":["application/pdf"],
    "TENDER_DOCUMENT":          ["application/pdf", "application/msword",
                                 "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    "BID_DOCUMENT":             ["application/pdf", "application/zip"],
    "CONTRACT_DOCUMENT":        ["application/pdf"],
    "PURCHASE_ORDER":           ["application/pdf"],
    "INVOICE":                  ["application/pdf", "image/jpeg", "image/png"],
    "GRN_DOCUMENT":             ["application/pdf"],
    "QUALITY_CERTIFICATE":      ["application/pdf", "image/jpeg", "image/png"],
}

BUCKET_MAPPING = {
    "GSTIN_CERTIFICATE":         "compliance-documents",
    "PAN_CARD":                  "compliance-documents",
    "BANK_DETAILS":              "compliance-documents",
    "INCORPORATION_CERTIFICATE": "compliance-documents",
    "TENDER_DOCUMENT":           "tender-documents",
    "BID_DOCUMENT":              "bid-documents",
    "CONTRACT_DOCUMENT":         "contract-documents",
    "PURCHASE_ORDER":            "po-documents",
    "INVOICE":                   "invoice-documents",
    "GRN_DOCUMENT":              "grn-ses-documents",
    "QUALITY_CERTIFICATE":       "compliance-documents",
}

def validate_mime_type(file_bytes: bytes, document_type: str, declared_extension: str) -> str:
    detected_mime = magic.from_buffer(file_bytes[:2048], mime=True)
    allowed = ALLOWED_MIME_TYPES.get(document_type, [])
    if detected_mime not in allowed:
        raise ValidationError("INVALID_FILE_TYPE",
            f"File type {detected_mime} not allowed for {document_type}. Allowed: {allowed}")
    return detected_mime

def sanitize_filename(filename: str) -> str:
    import re, unicodedata
    filename = unicodedata.normalize("NFKD", filename).encode("ascii", "ignore").decode()
    filename = re.sub(r'[^\w.\-]', '_', filename)
    filename = filename.lstrip('.')
    if not filename:
        filename = "unnamed_file"
    return filename[:255]

async def scan_with_clamav(file_path: str) -> tuple[bool, str]:
    """Returns (is_clean, virus_name)."""
    result = subprocess.run(
        ["clamscan", "--no-summary", file_path],
        capture_output=True, timeout=30
    )
    if result.returncode == 0:
        return True, ""
    virus_name = result.stdout.decode().split(":")[1].strip() if ":" in result.stdout.decode() else "UNKNOWN"
    return False, virus_name
```

### 2.2 `app/modules/document/service.py`
```python
class DocumentService:

    async def upload(self, db, file_bytes: bytes, original_filename: str,
                     document_type: str, entity_type: str, entity_id: UUID,
                     actor_id: UUID, org_id: UUID,
                     compliance_expiry: Optional[date] = None) -> Document:
        # 1. Size check
        size_bytes = len(file_bytes)
        max_bytes = settings.MINIO_MAX_FILE_SIZE_MB * 1024 * 1024
        if size_bytes > max_bytes:
            raise ValidationError("FILE_TOO_LARGE",
                f"File exceeds {settings.MINIO_MAX_FILE_SIZE_MB}MB limit")
        # 2. Filename sanitization
        safe_name = sanitize_filename(original_filename)
        # 3. MIME validation
        detected_mime = validate_mime_type(file_bytes, document_type, safe_name.rsplit(".", 1)[-1])
        # 4. MinIO path
        bucket = BUCKET_MAPPING[document_type]
        minio_path = f"{org_id}/{entity_type.lower()}/{entity_id}/{safe_name}"
        # 5. Existing version check
        existing = await self.repo.find_latest(db, entity_id, document_type, org_id)
        version_number = (existing.version_number + 1) if existing else 1
        # 6. Upload to MinIO (PENDING scan status)
        await self.minio_client.put_object(bucket, minio_path, file_bytes, detected_mime)
        doc = Document(
            org_id=org_id, entity_type=entity_type, entity_id=entity_id,
            document_type=document_type, original_filename=original_filename,
            stored_filename=safe_name, bucket_name=bucket, minio_path=minio_path,
            file_size_bytes=size_bytes, mime_type=detected_mime,
            version_number=version_number, scan_status="PENDING",
            uploaded_by=actor_id, compliance_expiry=compliance_expiry,
        )
        db.add(doc)
        await db.flush()
        # 7. Enqueue async ClamAV scan
        from app.tasks.document_scan import scan_document_task
        scan_document_task.delay(str(doc.id), bucket, minio_path, str(org_id))
        await self.audit.log(db, "DOCUMENT", doc.id, "DOCUMENT_UPLOADED", actor_id, org_id,
            new_values={"filename": safe_name, "document_type": document_type, "size_bytes": size_bytes})
        return doc

    async def get_presigned_url(self, db, document_id: UUID, actor_id: UUID, org_id: UUID) -> str:
        doc = await self.repo.get(db, document_id, org_id)
        if doc.scan_status == "INFECTED":
            raise ForbiddenError("INFECTED_FILE", "This document has been quarantined due to malware detection")
        if doc.scan_status == "PENDING":
            raise AppException("SCAN_PENDING", "Document is still being scanned. Try again shortly.", 202)
        url = self.minio_client.presigned_get_object(doc.bucket_name, doc.minio_path, expires=timedelta(seconds=900))
        await self.audit.log(db, "DOCUMENT", document_id, "DOCUMENT_ACCESSED", actor_id, org_id)
        return url
```

### 2.3 `app/tasks/document_scan.py`
```python
@celery_app.task(queue="celery.document_scan", name="scan_document")
def scan_document_task(document_id: str, bucket: str, minio_path: str, org_id: str):
    asyncio.run(_async_scan(document_id, bucket, minio_path, org_id))

async def _async_scan(document_id: str, bucket: str, minio_path: str, org_id: str):
    import tempfile, os
    async with async_session_factory() as db:
        doc = await doc_repo.get(db, UUID(document_id), UUID(org_id))
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{doc.stored_filename}") as tmp:
            minio_client.fget_object(bucket, minio_path, tmp.name)
            is_clean, virus_name = await scan_with_clamav(tmp.name)
        os.unlink(tmp.name)
        if is_clean:
            doc.scan_status = "CLEAN"
        else:
            doc.scan_status = "INFECTED"
            doc.virus_name = virus_name
            # Move to quarantine bucket
            minio_client.copy_object("quarantine", f"infected/{document_id}/{doc.stored_filename}",
                CopySource(bucket, minio_path))
            minio_client.remove_object(bucket, minio_path)
            await publisher.publish("procurement.alert", "alert.document.infected",
                {"document_id": document_id, "virus": virus_name, "org_id": org_id}, UUID(org_id))
        await db.commit()
```

---
## STEP 3 — TEST
```python
async def test_magic_bytes_reject_fake_pdf(service, factory):
    """Rename .exe to .pdf: detected as wrong MIME → rejected."""
async def test_path_traversal_sanitized(service):
    assert sanitize_filename("../../etc/passwd") == "....etcpasswd"  # stripped
async def test_infected_file_quarantined(db, factory, mock_clamav_infected):
    """Infected file: scan_status=INFECTED, moved to quarantine."""
async def test_presigned_url_infected_raises(db, factory):
    """get_presigned_url on INFECTED doc → ForbiddenError."""
async def test_presigned_url_pending_raises(db, factory):
    """get_presigned_url while PENDING → 202 SCAN_PENDING."""
async def test_file_size_limit_enforced(service):
    big_file = b"0" * (settings.MINIO_MAX_FILE_SIZE_MB * 1024 * 1024 + 1)
    with pytest.raises(ValidationError, match="FILE_TOO_LARGE"):
        await service.upload(db, big_file, "test.pdf", "TENDER_DOCUMENT", ...)
async def test_version_number_increments(db, factory):
    """Second upload of same document_type for entity → version_number=2."""
```
