from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch
import pytest

from app.core.exceptions import ValidationError
from app.modules.document.scanner import ClamAVScanner, validate_file_magic, DISALLOWED_MIME_TYPES


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


class TestClamAVScanner:
    @pytest.mark.asyncio
    async def test_ping_disabled_returns_false(self):
        scanner = ClamAVScanner(enabled=False)
        assert await scanner.ping() is False

    @pytest.mark.asyncio
    async def test_ping_success(self):
        scanner = ClamAVScanner(enabled=True)
        mock_reader = AsyncMock()
        mock_reader.read.return_value = b"PONG\x00"
        mock_writer = AsyncMock()

        with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)):
            assert await scanner.ping() is True
            mock_writer.write.assert_called_with(b"zPING\x00")

    @pytest.mark.asyncio
    async def test_ping_failure_returns_false(self):
        scanner = ClamAVScanner(enabled=True)
        with patch("asyncio.open_connection", side_effect=ConnectionRefusedError()):
            assert await scanner.ping() is False

    @pytest.mark.asyncio
    async def test_scan_bytes_when_disabled(self):
        scanner = ClamAVScanner(enabled=False)
        is_clean, detail = await scanner.scan_bytes(b"hello world")
        assert is_clean is True
        assert detail == "SKIPPED"

    @pytest.mark.asyncio
    async def test_scan_bytes_clean_stream(self):
        scanner = ClamAVScanner(enabled=True)
        mock_reader = AsyncMock()
        mock_reader.read.return_value = b"stream: OK\x00"
        mock_writer = AsyncMock()

        with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)):
            is_clean, detail = await scanner.scan_bytes(b"safe data content")
            assert is_clean is True
            assert detail == "CLEAN"

    @pytest.mark.asyncio
    async def test_scan_bytes_infected_stream(self):
        scanner = ClamAVScanner(enabled=True)
        mock_reader = AsyncMock()
        mock_reader.read.return_value = b"stream: Eicar-Signature FOUND\x00"
        mock_writer = AsyncMock()

        with patch("asyncio.open_connection", return_value=(mock_reader, mock_writer)):
            is_clean, detail = await scanner.scan_bytes(b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")
            assert is_clean is False
            assert "INFECTED" in detail

    @pytest.mark.asyncio
    async def test_scan_bytes_connection_offline_in_dev_skips(self):
        scanner = ClamAVScanner(enabled=True)
        with patch("app.modules.document.scanner.settings.ENVIRONMENT", "dev"):
            with patch("asyncio.open_connection", side_effect=ConnectionRefusedError("Connection refused")):
                is_clean, detail = await scanner.scan_bytes(b"test")
                assert is_clean is True
                assert detail == "SKIPPED_UNAVAILABLE"

    @pytest.mark.asyncio
    async def test_scan_bytes_connection_offline_in_prod_raises(self):
        scanner = ClamAVScanner(enabled=True)
        with patch("app.modules.document.scanner.settings.ENVIRONMENT", "production"):
            with patch("asyncio.open_connection", side_effect=ConnectionRefusedError("Connection refused")):
                with pytest.raises(ValidationError) as exc:
                    await scanner.scan_bytes(b"test")
                assert exc.value.code == "VIRUS_SCAN_UNAVAILABLE"
