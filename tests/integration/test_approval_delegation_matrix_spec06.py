from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.core.exceptions import AppException
from app.db.enums import UserStatusEnum
from app.modules.organization.models import Organization
from app.modules.user.models import User
from app.modules.user.router import (
    DelegationRuleCreateRequest,
    create_my_delegation,
    delete_my_delegation,
    list_my_delegations,
    list_org_delegation_matrix,
)
from app.modules.workflow.service import workflow_engine


@pytest.fixture
async def db_session():
    test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_approval_delegation_matrix_and_sod_guards(db_session: AsyncSession):
    # 1. Setup isolated organization & 3 users
    org_id = uuid4()
    org = Organization(
        id=org_id,
        name=f"Delegation Org {uuid4().hex[:6]}",
        legal_name=f"Delegation Org Legal {uuid4().hex[:6]}",
    )
    db_session.add(org)

    # User 1: Primary Approver (Delegator)
    approver = User(
        id=uuid4(),
        org_id=org_id,
        email=f"approver_{uuid4().hex[:6]}@example.com",
        password_hash="fakehash",
        first_name="Primary",
        last_name="Approver",
        status=UserStatusEnum.ACTIVE,
    )
    # User 2: Colleague (Delegate)
    delegate = User(
        id=uuid4(),
        org_id=org_id,
        email=f"delegate_{uuid4().hex[:6]}@example.com",
        password_hash="fakehash",
        first_name="Colleague",
        last_name="Delegate",
        status=UserStatusEnum.ACTIVE,
    )
    # User 3: Independent Requester
    requester = User(
        id=uuid4(),
        org_id=org_id,
        email=f"requester_{uuid4().hex[:6]}@example.com",
        password_hash="fakehash",
        first_name="General",
        last_name="Requester",
        status=UserStatusEnum.ACTIVE,
    )
    db_session.add_all([approver, delegate, requester])
    await db_session.commit()

    now = datetime.now(timezone.utc)
    valid_from = now - timedelta(hours=1)
    valid_until = now + timedelta(days=7)

    # 2. Guard 1: Self-delegation is prohibited
    with pytest.raises(AppException) as exc_self:
        await create_my_delegation(
            data=DelegationRuleCreateRequest(
                delegate_id=approver.id,
                reason="Testing self delegation",
                valid_from=valid_from,
                valid_until=valid_until,
            ),
            current_user=approver,
            db=db_session,
        )
    assert exc_self.value.code == "INVALID_DELEGATE"

    # 3. Happy path: Approver delegates to Colleague with financial threshold of ₹5,00,000
    create_req = DelegationRuleCreateRequest(
        delegate_id=delegate.id,
        reason="Annual Out of Office Leave",
        valid_from=valid_from,
        valid_until=valid_until,
        entity_types=["PR", "PO"],
        max_amount_threshold=500000.00,
    )
    res = await create_my_delegation(data=create_req, current_user=approver, db=db_session)
    rule_id = res["data"].id
    assert res["data"].max_amount_threshold == 500000.00
    assert res["data"].delegate_id == delegate.id

    # 4. Guard 2: Circular delegation is prohibited (Colleague cannot delegate back to Approver)
    with pytest.raises(AppException) as exc_circ:
        await create_my_delegation(
            data=DelegationRuleCreateRequest(
                delegate_id=approver.id,
                reason="Circular back-delegation",
                valid_from=valid_from,
                valid_until=valid_until,
            ),
            current_user=delegate,
            db=db_session,
        )
    assert exc_circ.value.code == "CIRCULAR_DELEGATION_PROHIBITED"

    # 5. Verify list_my_delegations and list_org_delegation_matrix
    my_rules = await list_my_delegations(current_user=approver, db=db_session)
    assert len(my_rules["data"]) == 1
    assert my_rules["data"][0].id == rule_id

    matrix = await list_org_delegation_matrix(current_user=approver, db=db_session)
    assert len(matrix["data"]) >= 1
    assert any(r.id == rule_id for r in matrix["data"])

    # 6. Test Workflow Engine _apply_delegation behavior:
    engine = workflow_engine

    # Scenario A: Normal PR within threshold (₹1,50,000) created by external requester
    resolved = await engine._apply_delegation(
        db=db_session,
        approvers=[approver],
        org_id=org_id,
        entity_type="PR",
        entity_context={
            "total_amount": 150000.0,
            "created_by": str(requester.id),
            "requester_id": str(requester.id),
        },
    )
    assert len(resolved) == 1
    assert resolved[0].id == delegate.id  # Successfully delegated to Colleague!
    assert getattr(resolved[0], "_delegated_from", None) == approver.id

    # Scenario B: Financial limit exceeded (₹8,50,000 > ₹5,00,000 threshold)
    resolved_exceeded = await engine._apply_delegation(
        db=db_session,
        approvers=[approver],
        org_id=org_id,
        entity_type="PR",
        entity_context={
            "total_amount": 850000.0,
            "created_by": str(requester.id),
            "requester_id": str(requester.id),
        },
    )
    assert len(resolved_exceeded) == 1
    assert resolved_exceeded[0].id == approver.id  # Retains Primary Approver due to financial limit!

    # Scenario C: Segregation of Duties (SoD) Guard:
    # PR is created/requested by Delegate themselves -> Delegate cannot approve their own PR!
    resolved_sod = await engine._apply_delegation(
        db=db_session,
        approvers=[approver],
        org_id=org_id,
        entity_type="PR",
        entity_context={
            "total_amount": 50000.0,
            "created_by": str(delegate.id),  # Maker is delegate
            "requester_id": str(delegate.id),
        },
    )
    assert len(resolved_sod) == 1
    assert resolved_sod[0].id == approver.id  # SoD guard blocked delegate; retains Primary Approver!

    # 7. Test Revocation
    del_res = await delete_my_delegation(rule_id=rule_id, current_user=approver, db=db_session)
    assert "revoked successfully" in del_res["data"]["message"]

    # After revocation, workflow resolves to primary approver
    resolved_after_revoke = await engine._apply_delegation(
        db=db_session,
        approvers=[approver],
        org_id=org_id,
        entity_type="PR",
        entity_context={"total_amount": 50000.0, "created_by": str(requester.id)},
    )
    assert len(resolved_after_revoke) == 1
    assert resolved_after_revoke[0].id == approver.id
