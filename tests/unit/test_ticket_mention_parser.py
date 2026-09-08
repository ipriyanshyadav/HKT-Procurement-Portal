from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.modules.ticket.mention_parser import MentionParser


@pytest.mark.asyncio
async def test_parse_empty_content():
    """Verify empty or None content returns an empty list."""
    parser = MentionParser(user_repo=AsyncMock())
    mock_db = AsyncMock()
    org_id = uuid4()

    assert await parser.parse(mock_db, "", org_id) == []
    assert await parser.parse(mock_db, None, org_id) == []


@pytest.mark.asyncio
async def test_parse_no_mentions():
    """Verify text without @mentions returns empty list without calling repo."""
    mock_repo = AsyncMock()
    parser = MentionParser(user_repo=mock_repo)
    mock_db = AsyncMock()
    org_id = uuid4()

    result = await parser.parse(mock_db, "This is a regular comment without tags.", org_id)
    assert result == []
    mock_repo.find_by_username_or_email_prefix.assert_not_called()


@pytest.mark.asyncio
async def test_parse_valid_mentions():
    """Verify valid @mentions are extracted and resolved via user repository."""
    alice_id = uuid4()
    bob_id = uuid4()

    mock_repo = AsyncMock()

    async def mock_find(db, uname, org):
        if uname == "alice":
            u = MagicMock()
            u.id = alice_id
            return u
        if uname == "bob.smith":
            u = MagicMock()
            u.id = bob_id
            return u
        return None

    mock_repo.find_by_username_or_email_prefix.side_effect = mock_find

    parser = MentionParser(user_repo=mock_repo)
    mock_db = AsyncMock()
    org_id = uuid4()

    content = "Hello @alice and @bob.smith, please review @unknown_user."
    resolved = await parser.parse(mock_db, content, org_id)

    assert set(resolved) == {alice_id, bob_id}


@pytest.mark.asyncio
async def test_parse_deduplicates_mentions():
    """Verify duplicated @mentions are queried and returned only once."""
    user_id = uuid4()
    mock_repo = AsyncMock()
    u = MagicMock()
    u.id = user_id
    mock_repo.find_by_username_or_email_prefix.return_value = u

    parser = MentionParser(user_repo=mock_repo)
    mock_db = AsyncMock()
    org_id = uuid4()

    content = "@charlie was mentioned. Yes, @charlie again!"
    resolved = await parser.parse(mock_db, content, org_id)

    assert resolved == [user_id]
    assert mock_repo.find_by_username_or_email_prefix.call_count == 1


@pytest.mark.asyncio
async def test_parse_handles_repo_exception_gracefully():
    """Verify repository exceptions during mention resolution are caught and ignored."""
    mock_repo = AsyncMock()
    mock_repo.find_by_username_or_email_prefix.side_effect = RuntimeError("DB connection error")

    parser = MentionParser(user_repo=mock_repo)
    mock_db = AsyncMock()
    org_id = uuid4()

    content = "Hey @failing_user please check this."
    resolved = await parser.parse(mock_db, content, org_id)

    assert resolved == []
