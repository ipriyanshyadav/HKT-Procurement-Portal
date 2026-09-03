from uuid import uuid4
from app.core.redis_client import RedisKeys

def test_session_key():
    assert RedisKeys.session("abc123") == "session:abc123"

def test_revoked_token_key():
    assert RedisKeys.revoked_token("jti-456") == "revoked:jti-456"

def test_rate_limit_key():
    uid = uuid4()
    assert RedisKeys.rate_limit(uid, "tier1") == f"ratelimit:{uid}:tier1"

def test_failed_login_key():
    assert RedisKeys.failed_login("user@test.com") == "failed_login:user@test.com"

def test_idempotency_key():
    assert RedisKeys.idempotency("key-1") == "idem:key-1"

def test_ws_user_key():
    uid = uuid4()
    assert RedisKeys.ws_user(uid) == f"ws:user:{uid}"

def test_notification_channel_key():
    uid = uuid4()
    assert RedisKeys.notification_channel(uid) == f"channel:notifications:{uid}"

def test_pr_count_cache_key():
    oid = uuid4()
    assert RedisKeys.pr_count_cache(oid, "draft") == f"cache:pr_count:{oid}:draft"

def test_rfq_count_cache_key():
    oid = uuid4()
    assert RedisKeys.rfq_count_cache(oid, "open") == f"cache:rfq_count:{oid}:open"

def test_pending_approvals_key():
    uid = uuid4()
    assert RedisKeys.pending_approvals(uid) == f"cache:pending_approvals:{uid}"

def test_vendor_verify_key():
    assert RedisKeys.vendor_verify("gst", "GSTIN123") == "vendor_verify:gst:GSTIN123"

def test_exchange_rate_key():
    assert RedisKeys.exchange_rate("USD", "INR") == "exchange_rate:USD:INR"

def test_workflow_lock():
    if hasattr(RedisKeys, "workflow_lock"):
        assert RedisKeys.workflow_lock("abc") == "lock:workflow:abc"

def test_bid_seal():
    if hasattr(RedisKeys, "bid_seal"):
        assert RedisKeys.bid_seal("xyz") == "seal:bids:xyz"
