from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.main import app
from app.modules.approval_rules.models import ApprovalRule
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository


async def _fake_db():
    mock = AsyncMock()
    mock.commit = AsyncMock()
    mock.rollback = AsyncMock()
    yield mock


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "admin@procurement.test"
    user.roles = ["PROCUREMENT_ADMIN"]
    return user


@pytest.fixture
def client(mock_user):
    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: mock_user

    with patch.object(role_repository, "user_has_permission", AsyncMock(return_value=True)):
        with TestClient(app) as test_client:
            yield test_client

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)


class TestApprovalRulesRouter:
    def test_simulate_rule_matching_specific_match(self, client, mock_user):
        mock_rule = MagicMock(spec=ApprovalRule)
        mock_rule.id = uuid4()
        mock_rule.org_id = mock_user.org_id
        mock_rule.entity_type = "PR"
        mock_rule.rule_code = "HIGH_VALUE_PR"
        mock_rule.rule_name = "High Value PR"
        mock_rule.priority = 10
        mock_rule.conditions = {}
        mock_rule.condition_expression = "amount > 10000"
        mock_rule.workflow_template_code = "EXEC_CHAIN"
        mock_rule.is_active = True
        mock_rule.is_catch_all = False
        mock_rule.effective_from = datetime.now(timezone.utc)
        mock_rule.effective_to = None
        mock_rule.created_by = mock_user.id
        mock_rule.created_at = datetime.now(timezone.utc)

        with patch("app.modules.approval_rules.router.approval_rules_repository") as mock_repo, \
             patch("app.modules.approval_rules.router.rules_engine") as mock_engine:

            mock_repo.get_active_rules = AsyncMock(return_value=[mock_rule])
            mock_engine.find_matching_rule = AsyncMock(return_value=mock_rule)

            res = client.post(
                "/api/v1/approval-rules/simulate",
                json={
                    "entity_type": "PR",
                    "entity_context": {"amount": 25000},
                },
            )
            assert res.status_code == 200
            data = res.json()["data"]
            assert data["match_type"] == "SPECIFIC"
            assert data["workflow_template_code"] == "EXEC_CHAIN"
            assert data["matched_rule"]["rule_code"] == "HIGH_VALUE_PR"

    def test_get_rule_by_id(self, client, mock_user):
        rule_id = uuid4()
        mock_rule = MagicMock(spec=ApprovalRule)
        mock_rule.id = rule_id
        mock_rule.org_id = mock_user.org_id
        mock_rule.entity_type = "PR"
        mock_rule.rule_code = "RULE_001"
        mock_rule.rule_name = "Rule 001"
        mock_rule.priority = 10
        mock_rule.conditions = {}
        mock_rule.condition_expression = None
        mock_rule.workflow_template_code = "TEMPLATE_A"
        mock_rule.is_active = True
        mock_rule.is_catch_all = True
        mock_rule.effective_from = datetime.now(timezone.utc)
        mock_rule.effective_to = None
        mock_rule.created_by = mock_user.id
        mock_rule.created_at = datetime.now(timezone.utc)

        with patch("app.modules.approval_rules.router.approval_rules_repository") as mock_repo:
            mock_repo.get = AsyncMock(return_value=mock_rule)

            res = client.get(f"/api/v1/approval-rules/{rule_id}")
            assert res.status_code == 200
            data = res.json()["data"]
            assert data["id"] == str(rule_id)
            assert data["rule_code"] == "RULE_001"
            assert data["is_catch_all"] is True

    def test_list_rules(self, client, mock_user):
        mock_rule = MagicMock(spec=ApprovalRule)
        mock_rule.id = uuid4()
        mock_rule.org_id = mock_user.org_id
        mock_rule.entity_type = "PR"
        mock_rule.rule_code = "RULE_002"
        mock_rule.rule_name = "Rule 002"
        mock_rule.priority = 20
        mock_rule.conditions = {}
        mock_rule.condition_expression = None
        mock_rule.workflow_template_code = "TEMPLATE_B"
        mock_rule.is_active = True
        mock_rule.is_catch_all = False
        mock_rule.effective_from = datetime.now(timezone.utc)
        mock_rule.effective_to = None
        mock_rule.created_by = mock_user.id
        mock_rule.created_at = datetime.now(timezone.utc)

        with patch("app.modules.approval_rules.router.approval_rules_repository") as mock_repo:
            mock_repo.get_multi = AsyncMock(return_value=[mock_rule])

            res = client.get("/api/v1/approval-rules")
            assert res.status_code == 200
            data = res.json()["data"]
            assert len(data) == 1
            assert data[0]["rule_code"] == "RULE_002"
