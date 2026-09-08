from __future__ import annotations

import asyncio
import subprocess
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest

from app.config import settings
from app.core.exceptions import ValidationError
from app.modules.document.scanner import (
    ClamAVScanner,
    validate_file_magic,
    validate_mime_type,
    sanitize_filename,
    scan_with_clamav,
    DISALLOWED_MIME_TYPES,
    ALLOWED_MIME_TYPES,
    BUCKET_MAPPING,
)
from app.modules.document.service import DocumentService


class TestFileMagicValidation:
    def test_pdf_magic_passes(self):
        pdf_bytes = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n"
        with patch("app.modules.document.scanner.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "application/pdf"
            mime = validate_file_magic(pdf_bytes, "application/pdf")
            assert mime == "application/pdf"

    def test_disallowed_mime_raises_validation_error(self):
        elf_bytes = b"\x7fELF\x02\x01\x01\x00"
        with patch("app.modules.document.scanner.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "application/x-executable"
            with pytest.raises(ValidationError) as exc:
                validate_file_magic(elf_bytes, "application/pdf")
            assert exc.value.code == "DISALLOWED_FILE_TYPE"

    def test_unsupported_mime_raises_validation_error(self):
        audio_bytes = b"OggS\x00\x02\x00\x00"
        with patch("app.modules.document.scanner.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "audio/ogg"
            with pytest.raises(ValidationError) as exc:
                validate_file_magic(audio_bytes, "audio/ogg")
            assert exc.value.code == "UNSUPPORTED_DOCUMENT_FORMAT"

    def test_libmagic_exception_falls_back_to_declared(self):
        data = b"some regular text content"
        with patch("app.modules.document.scanner.magic") as mock_magic:
            mock_magic.from_buffer.side_effect = Exception("libmagic boom")
            mime = validate_file_magic(data, "text/plain")
            assert mime == "text/plain"


class TestValidateMimeType:
    def test_magic_bytes_reject_fake_pdf(self):
        """Rename .exe to .pdf: detected as executable MIME -> rejected."""
        fake_pdf_bytes = b"MZ\x90\x00\x03\x00\x00\x00"
        with patch("app.modules.document.scanner.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "application/x-dosexec"
            with pytest.raises(ValidationError) as exc:
                validate_mime_type(fake_pdf_bytes, "TENDER_DOCUMENT", "pdf")
            assert exc.value.code in ("DISALLOWED_FILE_TYPE", "INVALID_FILE_TYPE")

    def test_validate_mime_type_valid_pdf(self):
        pdf_bytes = b"%PDF-1.7 valid document content"
        with patch("app.modules.document.scanner.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "application/pdf"
            mime = validate_mime_type(pdf_bytes, "TENDER_DOCUMENT", "pdf")
            assert mime == "application/pdf"

    def test_validate_mime_type_valid_image(self):
        img_bytes = b"\xff\xd8\xff\xe0"
        with patch("app.modules.document.scanner.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "image/jpeg"
            mime = validate_mime_type(img_bytes, "GSTIN_CERTIFICATE", "jpg")
            assert mime == "image/jpeg"

    def test_validate_mime_type_mismatch(self):
        png_bytes = b"\x89PNG\r\n\x1a\n"
        with patch("app.modules.document.scanner.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "image/png"
            with pytest.raises(ValidationError) as exc:
                validate_mime_type(png_bytes, "INCORPORATION_CERTIFICATE", "png")
            assert exc.value.code == "INVALID_FILE_TYPE"


class TestPathTraversalSanitization:
    def test_path_traversal_sanitized(self):
        assert sanitize_filename("../../etc/passwd") == "....etcpasswd"

    def test_path_traversal_windows_separators(self):
        assert sanitize_filename("..\\..\\windows\\system32") == "....windowssystem32"

    def test_null_bytes_stripped(self):
        assert sanitize_filename("\x00secret.doc") == "secret.doc"

    def test_spaces_and_special_chars(self):
        assert sanitize_filename("My Special File (1).pdf") == "My_Special_File__1_.pdf"

    def test_max_length_truncation(self):
        long_name = "a" * 300 + ".pdf"
        sanitized = sanitize_filename(long_name)
        assert len(sanitized) == 255

    def test_empty_fallback(self):
        assert sanitize_filename("") == "unnamed_file"
        assert sanitize_filename("....") == "unnamed_file"


class TestFileSizeValidation:
    @pytest.mark.asyncio
    async def test_file_size_limit_enforced(self):
        service = DocumentService()
        db = AsyncMock()
        big_file = b"0" * (settings.MINIO_MAX_FILE_SIZE_MB * 1024 * 1024 + 1)
        with pytest.raises(ValidationError) as exc:
            await service.upload(
                db=db,
                file_bytes=big_file,
                original_filename="test.pdf",
                document_type="TENDER_DOCUMENT",
                entity_type="TENDER",
                entity_id=uuid4(),
            )
        assert exc.value.code == "FILE_TOO_LARGE"


class TestScanWithClamav:
    @pytest.mark.asyncio
    async def test_scan_with_clamav_clean(self):
        mock_result = subprocess.CompletedProcess(
            args=["clamscan"],
            returncode=0,
            stdout=b"/path/test.pdf: OK\n",
            stderr=b"",
        )
        with patch("subprocess.run", return_value=mock_result):
            is_clean, virus_name = await scan_with_clamav("/tmp/test.pdf")
            assert is_clean is True
            assert virus_name == ""

    @pytest.mark.asyncio
    async def test_scan_with_clamav_infected(self):
        mock_result = subprocess.CompletedProcess(
            args=["clamscan"],
            returncode=1,
            stdout=b"/path/test.pdf: Eicar-Signature FOUND\n",
            stderr=b"",
        )
        with patch("subprocess.run", return_value=mock_result):
            is_clean, virus_name = await scan_with_clamav("/tmp/test.pdf")
            assert is_clean is False
            assert "Eicar-Signature FOUND" in virus_name


class TestClamAVScanner:
    @pytest.mark.asyncio
    async def test_ping_disabled_returns_false(self):
        scanner_inst = ClamAVScanner(enabled=False)
        assert await scanner_inst.ping() is False

    @pytest.mark.asyncio
    async def test_ping_success(self):
        scanner_inst = ClamAVScanner(enabled=True)
        mock_reader = AsyncMock()
        mock_reader.read.return_value = b"PONG\x00"
        mock_writer = MagicMock()
        mock_writer.drain = AsyncMock()
        mock_writer.wait_closed = AsyncMock()

        with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)):
            assert await scanner_inst.ping() is True
            mock_writer.write.assert_called_with(b"zPING\x00")

    @pytest.mark.asyncio
    async def test_ping_failure_returns_false(self):
        scanner_inst = ClamAVScanner(enabled=True)
        with patch("asyncio.open_connection", side_effect=ConnectionRefusedError()):
            assert await scanner_inst.ping() is False

    @pytest.mark.asyncio
    async def test_scan_bytes_when_disabled(self):
        scanner_inst = ClamAVScanner(enabled=False)
        is_clean, detail = await scanner_inst.scan_bytes(b"hello world")
        assert is_clean is True
        assert detail == "SKIPPED"

    @pytest.mark.asyncio
    async def test_scan_bytes_clean_stream(self):
        scanner_inst = ClamAVScanner(enabled=True)
        mock_reader = AsyncMock()
        mock_reader.read.return_value = b"stream: OK\x00"
        mock_writer = MagicMock()
        mock_writer.drain = AsyncMock()
        mock_writer.wait_closed = AsyncMock()

        with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)):
            is_clean, detail = await scanner_inst.scan_bytes(b"safe data content")
            assert is_clean is True
            assert detail == "CLEAN"

    @pytest.mark.asyncio
    async def test_scan_bytes_infected_stream(self):
        scanner_inst = ClamAVScanner(enabled=True)
        mock_reader = AsyncMock()
        mock_reader.read.return_value = b"stream: Eicar-Signature FOUND\x00"
        mock_writer = MagicMock()
        mock_writer.drain = AsyncMock()
        mock_writer.wait_closed = AsyncMock()

        with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)):
            is_clean, detail = await scanner_inst.scan_bytes(b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")
            assert is_clean is False
            assert "INFECTED" in detail

    @pytest.mark.asyncio
    async def test_scan_bytes_connection_offline_in_dev_skips(self):
        scanner_inst = ClamAVScanner(enabled=True)
        with patch("app.modules.document.scanner.settings.ENVIRONMENT", "dev"):
            with patch("asyncio.open_connection", side_effect=ConnectionRefusedError("Connection refused")):
                is_clean, detail = await scanner_inst.scan_bytes(b"test")
                assert is_clean is True
                assert detail == "SKIPPED_UNAVAILABLE"

    @pytest.mark.asyncio
    async def test_scan_bytes_connection_offline_in_prod_raises(self):
        scanner_inst = ClamAVScanner(enabled=True)
        with patch("app.modules.document.scanner.settings.ENVIRONMENT", "production"):
            with patch("asyncio.open_connection", side_effect=ConnectionRefusedError("Connection refused")):
                with pytest.raises(ValidationError) as exc:
                    await scanner_inst.scan_bytes(b"test")
                assert exc.value.code == "VIRUS_SCAN_UNAVAILABLE"
