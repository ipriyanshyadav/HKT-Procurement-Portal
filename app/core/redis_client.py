from __future__ import annotations
from uuid import UUID
import redis.asyncio as redis
from app.config import settings

class RedisKeys:
    @staticmethod
    def session(jti: str) -> str:
        return f"session:{jti}"

    @staticmethod
    def revoked_token(jti: str) -> str:
        return f"revoked:{jti}"

    @staticmethod
    def rate_limit(user_id: str | UUID, endpoint_tier: str) -> str:
        return f"ratelimit:{user_id}:{endpoint_tier}"

    @staticmethod
    def failed_login(email: str) -> str:
        return f"failed_login:{email}"

    @staticmethod
    def idempotency(key: str) -> str:
        return f"idem:{key}"

    @staticmethod
    def ws_user(user_id: str | UUID) -> str:
        return f"ws:user:{user_id}"

    @staticmethod
    def notification_channel(user_id: str | UUID) -> str:
        return f"channel:notifications:{user_id}"

    @staticmethod
    def pr_count_cache(org_id: str | UUID, status: str) -> str:
        return f"cache:pr_count:{org_id}:{status}"

    @staticmethod
    def rfq_count_cache(org_id: str | UUID, status: str) -> str:
        return f"cache:rfq_count:{org_id}:{status}"

    @staticmethod
    def pending_approvals(user_id: str | UUID) -> str:
        return f"cache:pending_approvals:{user_id}"

    @staticmethod
    def vendor_verify(verification_type: str, identifier: str) -> str:
        return f"vendor_verify:{verification_type}:{identifier}"

    @staticmethod
    def exchange_rate(base: str, target: str) -> str:
        return f"exchange_rate:{base}:{target}"

    @staticmethod
    def workflow_lock(workflow_instance_id: str | UUID) -> str:
        return f"lock:workflow:{workflow_instance_id}"

    @staticmethod
    def bid_seal(rfq_id: str | UUID) -> str:
        return f"seal:bids:{rfq_id}"

def get_redis_client(db_index: int = 0) -> redis.Redis:
    return redis.from_url(settings.REDIS_URL, db=db_index)
