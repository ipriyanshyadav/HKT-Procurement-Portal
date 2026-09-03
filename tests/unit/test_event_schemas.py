import pytest
from uuid import uuid4
from pydantic import ValidationError
from app.events.schemas import VendorInvitedEvent, RFQPublishedEvent

def test_vendor_invited_event_valid():
    event = VendorInvitedEvent(
        vendor_id=uuid4(),
        email="vendor@example.com",
        org_id=uuid4()
    )
    assert event.event_type == "vendor.invited"
    assert event.timestamp is not None
    assert event.email == "vendor@example.com"

def test_vendor_invited_event_invalid():
    with pytest.raises(ValidationError):
        VendorInvitedEvent(
            vendor_id="not-a-uuid",
            email="not-an-email",
            org_id=uuid4()
        )

def test_rfq_published_event_valid():
    event = RFQPublishedEvent(
        rfq_id=uuid4(),
        rfq_number="RFQ-001",
        org_id=uuid4()
    )
    assert event.event_type == "rfq.published"
    assert event.timestamp is not None
    assert event.rfq_number == "RFQ-001"

def test_rfq_published_event_invalid():
    with pytest.raises(ValidationError):
        RFQPublishedEvent(
            rfq_id="not-a-uuid",
            rfq_number="RFQ-001",
            org_id=uuid4()
        )
