from __future__ import annotations
import asyncio
import struct
from typing import Optional, Tuple
from loguru import logger

try:
    import magic
    MAGIC_AVAILABLE = True
except (ImportError, OSError):
    magic = None
    MAGIC_AVAILABLE = False
    logger.warning("python-magic or libmagic not found on host — using content-type header fallback")

from app.config import settings
from app.core.exceptions import ValidationError

import re
import subprocess
import unicodedata

ALLOWED_MIME_TYPES: dict[str, list[str]] = {
    "GSTIN_CERTIFICATE": ["application/pdf", "image/jpeg", "image/png"],
    "PAN_CARD": ["application/pdf", "image/jpeg", "image/png"],
    "BANK_DETAILS": ["application/pdf", "image/jpeg", "image/png"],
    "INCORPORATION_CERTIFICATE": ["application/pdf"],
    "TENDER_DOCUMENT": [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    "BID_DOCUMENT": ["application/pdf", "application/zip"],
    "CONTRACT_DOCUMENT": ["application/pdf"],
    "PURCHASE_ORDER": ["application/pdf"],
    "INVOICE": ["application/pdf", "image/jpeg", "image/png"],
    "GRN_DOCUMENT": ["application/pdf"],
    "QUALITY_CERTIFICATE": ["application/pdf", "image/jpeg", "image/png"],
}

BUCKET_MAPPING: dict[str, str] = {
    "GSTIN_CERTIFICATE": "compliance-documents",
    "PAN_CARD": "compliance-documents",
    "BANK_DETAILS": "compliance-documents",
    "INCORPORATION_CERTIFICATE": "compliance-documents",
    "TENDER_DOCUMENT": "tender-documents",
    "BID_DOCUMENT": "bid-documents",
    "CONTRACT_DOCUMENT": "contract-documents",
    "PURCHASE_ORDER": "po-documents",
    "INVOICE": "invoice-documents",
    "GRN_DOCUMENT": "grn-ses-documents",
    "QUALITY_CERTIFICATE": "compliance-documents",
    "COMPLIANCE": "compliance-documents",
    "TENDER": "tender-documents",
    "BID": "bid-documents",
    "CONTRACT": "contract-documents",
    "GRN_SES": "grn-ses-documents",
    "AUDIT": "audit-documents",
}

DISALLOWED_MIME_TYPES = {
    "application/x-executable",
    "application/x-dosexec",
    "application/x-sharedlib",
    "application/x-msdos-program",
    "application/x-msdownload",
    "text/x-shellscript",
    "application/x-bat",
    "application/x-sh",
}

ALLOWED_DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/msword",
    "text/plain",
    "text/csv",
    "application/zip",
}


def validate_mime_type(
    file_bytes: bytes,
    document_type: str,
    declared_extension: str = "",
) -> str:
    """
    Validates detected mime type against ALLOWED_MIME_TYPES for a given document_type.
    Raises ValidationError if mime type is disallowed or not allowed for the document_type.
    """
    detected_mime = None
    try:
        if magic is not None and hasattr(magic, "from_buffer"):
            detected_mime = magic.from_buffer(file_bytes[:2048], mime=True)
    except Exception as exc:
        logger.warning(f"magic.from_buffer inspection failed: {exc}")
        detected_mime = None

    if not detected_mime or detected_mime == "application/octet-stream":
        ext = declared_extension.lower().lstrip(".")
        ext_map = {
            "pdf": "application/pdf",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "doc": "application/msword",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "zip": "application/zip",
        }
        if ext in ext_map:
            detected_mime = ext_map[ext]
        else:
            detected_mime = detected_mime or "application/octet-stream"

    if detected_mime in DISALLOWED_MIME_TYPES:
        raise ValidationError(
            "DISALLOWED_FILE_TYPE",
            f"File type '{detected_mime}' is not permitted for security reasons.",
        )

    allowed = ALLOWED_MIME_TYPES.get(document_type)
    if not allowed:
        if document_type in ("COMPLIANCE", "INVOICE", "QUALITY_CERTIFICATE"):
            allowed = ["application/pdf", "image/jpeg", "image/png"]
        elif document_type in ("CONTRACT", "PURCHASE_ORDER", "GRN_DOCUMENT", "GRN_SES", "INCORPORATION_CERTIFICATE"):
            allowed = ["application/pdf"]
        elif document_type in ("BID", "BID_DOCUMENT"):
            allowed = ["application/pdf", "application/zip"]
        elif document_type in ("TENDER", "TENDER_DOCUMENT"):
            allowed = [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ]
        else:
            allowed = list(ALLOWED_DOCUMENT_MIME_TYPES)

    if detected_mime not in allowed:
        raise ValidationError(
            "INVALID_FILE_TYPE",
            f"File type {detected_mime} not allowed for {document_type}. Allowed: {allowed}",
        )
    return detected_mime


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes filename by stripping path traversal characters, null bytes,
    normalizing unicode to ASCII, replacing spaces and non-word characters with underscores,
    and truncating to 255 characters.
    """
    # 1. Strip path separators and null bytes to prevent path traversal
    filename = filename.replace("/", "").replace("\\", "").replace("\x00", "")
    # 2. Normalize to ASCII
    filename = unicodedata.normalize("NFKD", filename).encode("ascii", "ignore").decode()
    # 3. Replace spaces with underscores
    filename = re.sub(r"\s+", "_", filename)
    # 4. Remove/replace unsafe characters
    filename = re.sub(r"[^\w.\-]", "_", filename)
    # 5. Empty or dot-only fallback
    if not filename or filename == "." * len(filename):
        filename = "unnamed_file"
    return filename[:255]


async def scan_with_clamav(file_path: str) -> tuple[bool, str]:
    """
    Scans a file using the clamscan CLI utility.
    Returns (is_clean: bool, virus_name: str).
    """
    try:
        def _run():
            return subprocess.run(
                ["clamscan", "--no-summary", file_path],
                capture_output=True,
                timeout=30,
            )
        result = await asyncio.to_thread(_run)
        if result.returncode == 0:
            return True, ""
        stdout = result.stdout.decode("utf-8", errors="replace")
        virus_name = stdout.split(":")[1].strip() if ":" in stdout else "UNKNOWN"
        return False, virus_name
    except (FileNotFoundError, subprocess.SubprocessError) as exc:
        logger.warning(f"clamscan execution issue: {exc}")
        if settings.ENVIRONMENT in ("local", "dev"):
            return True, ""
        return False, "SCAN_UNAVAILABLE"



class ClamAVScanner:
    """Asynchronous ClamAV client using the standard clamd INSTREAM protocol."""

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        timeout: Optional[int] = None,
        enabled: Optional[bool] = None,
    ) -> None:
        self.host = host or settings.CLAMAV_HOST
        self.port = port or settings.CLAMAV_PORT
        self.timeout = timeout or settings.CLAMAV_TIMEOUT_SECONDS
        self.enabled = enabled if enabled is not None else settings.CLAMAV_ENABLED

    async def ping(self) -> bool:
        """Check if ClamAV daemon is reachable and responding to PING."""
        if not self.enabled:
            return False
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=self.timeout,
            )
            writer.write(b"zPING" + bytes([0]))
            await writer.drain()
            response = await asyncio.wait_for(reader.read(1024), timeout=self.timeout)
            writer.close()
            await writer.wait_closed()
            return b"PONG" in response
        except Exception as exc:
            logger.debug(f"ClamAV ping failed: {exc}")
            return False

    async def scan_bytes(self, data: bytes) -> Tuple[bool, str]:
        """
        Scan a byte payload for malware.
        Returns:
            (is_clean: bool, detail: str)
            - (True, "CLEAN") or (True, "SKIPPED") if disabled/unavailable in local
            - (False, "INFECTED: <virus_name>") if a threat is detected
        """
        if not self.enabled:
            logger.debug("ClamAV scanning disabled via settings; skipping.")
            return True, "SKIPPED"

        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=self.timeout,
            )
            # zINSTREAM format: chunks prefixed with 4-byte big-endian length, terminated with 0-length chunk
            writer.write(b"zINSTREAM" + bytes([0]))
            await writer.drain()

            chunk_size = 2048
            for i in range(0, len(data), chunk_size):
                chunk = data[i : i + chunk_size]
                writer.write(struct.pack(">I", len(chunk)))
                writer.write(chunk)
                await writer.drain()

            # End of stream chunk
            writer.write(struct.pack(">I", 0))
            await writer.drain()

            raw_response = await asyncio.wait_for(reader.read(1024), timeout=self.timeout)
            writer.close()
            response_str = raw_response.decode("utf-8", errors="replace").strip()
            response_str = response_str.replace(chr(0), "").strip()
            if "OK" in response_str:
                return True, "CLEAN"
            elif "FOUND" in response_str:
                logger.warning(f"Malware detected by ClamAV: {response_str}")
                return False, f"INFECTED: {response_str}"
            else:
                logger.error(f"Unexpected ClamAV scan response: {response_str}")
                return False, f"SCAN_ERROR: {response_str}"

        except (ConnectionRefusedError, OSError, asyncio.TimeoutError) as exc:
            if settings.ENVIRONMENT in ("local", "dev"):
                logger.warning(f"ClamAV daemon offline at {self.host}:{self.port} ({exc}); skipping scan in {settings.ENVIRONMENT} mode.")
                return True, "SKIPPED_UNAVAILABLE"
            logger.error(f"ClamAV scanner unavailable in production: {exc}")
            raise ValidationError("VIRUS_SCAN_UNAVAILABLE", "Antivirus scanning service is currently unavailable")


def validate_file_magic(
    file_bytes: bytes,
    declared_content_type: str,
    allowed_types: Optional[set[str]] = None,
) -> str:
    """
    Validates file magic bytes against disallowed executable types and declared MIME type.
    Returns detected mime type or raises ValidationError.
    """
    try:
        detected_mime = magic.from_buffer(file_bytes, mime=True)
    except Exception as exc:
        logger.warning(f"libmagic inspection failed, using declared type: {exc}")
        detected_mime = declared_content_type

    if detected_mime in DISALLOWED_MIME_TYPES:
        raise ValidationError(
            "DISALLOWED_FILE_TYPE",
            f"File type '{detected_mime}' is not permitted for security reasons.",
        )

    allowed = allowed_types or ALLOWED_DOCUMENT_MIME_TYPES
    if detected_mime not in allowed and declared_content_type not in allowed:
        raise ValidationError(
            "UNSUPPORTED_DOCUMENT_FORMAT",
            f"Uploaded format '{detected_mime}' is not supported. Allowed formats: PDF, JPEG, PNG, DOCX, XLSX, CSV.",
        )

    return detected_mime


scanner = ClamAVScanner()
