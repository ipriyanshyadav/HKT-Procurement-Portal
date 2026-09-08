import re
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.user.repository import user_repository

_MENTION_RE = re.compile(r"@([a-zA-Z0-9._-]{2,})")


class MentionParser:
    def __init__(self, user_repo=None) -> None:
        self.user_repo = user_repo or user_repository

    async def parse(self, db: AsyncSession, content: str, org_id: UUID) -> list[UUID]:
        """Returns list of resolved user UUIDs from @mentions in content.
        Unknown @mentions are silently ignored.
        """
        if not content:
            return []
        usernames = list(set(_MENTION_RE.findall(content)))
        if not usernames:
            return []

        resolved: list[UUID] = []
        for uname in usernames:
            try:
                user = await self.user_repo.find_by_username_or_email_prefix(db, uname, org_id)
                if user and user.id not in resolved:
                    resolved.append(user.id)
            except Exception as e:
                from loguru import logger
                logger.debug("Failed to resolve @mention {}: {}", uname, e)
        return resolved
