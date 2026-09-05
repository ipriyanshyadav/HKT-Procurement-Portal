from __future__ import annotations
from urllib.parse import urlparse, urlunparse
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

    @staticmethod
    def auction_channel(auction_id: UUID) -> str:
        return f"auction:{auction_id}:broadcast"

    @staticmethod
    def auction_vendor_channel(auction_id: UUID, vendor_id: UUID) -> str:
        return f"auction:{auction_id}:vendor:{vendor_id}"

    @staticmethod
    def auction_sequence(auction_id: UUID) -> str:
        """Redis counter for monotonic bid_sequence."""
        return f"auction:{auction_id}:seq"

    @staticmethod
    def auction_best_bid(auction_id: UUID, lot_id: UUID | None = None) -> str:
        """Cached current best (L1) bid amount per lot."""
        lot_part = str(lot_id) if lot_id else "all"
        return f"auction:{auction_id}:best:{lot_part}"

    @staticmethod
    def analytics_cache(prefix: str, org_id: str | UUID, fiscal_year: str, bu_scope: str = "") -> str:
        return f"analytics:{prefix}:{org_id}:{fiscal_year}:{bu_scope}"

def get_redis_client(db_index: int = 0) -> redis.Redis:
    redis_url = settings.REDIS_URL
    if "://" not in redis_url:
        redis_url = f"redis://{redis_url}"
    parsed = urlparse(redis_url)
    target_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        f"/{db_index}",
        parsed.params,
        parsed.query,
        parsed.fragment,
    ))
    return redis.from_url(target_url)

get_redis = get_redis_client
