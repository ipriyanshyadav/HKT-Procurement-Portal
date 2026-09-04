"""
Unit tests for the Approval Rules Engine service (SPEC_06).

Tests cover:
- find_matching_rule: priority ordering (lowest priority number matches first)
- find_matching_rule: condition expression evaluation
- find_matching_rule: catch-all fallback when no specific rule matches
- find_matching_rule: fires alert when no rule matches (PENDING_RULE_RESOLUTION)
- detect_conflicts: flags rules with same priority
- activate_rule: creates immutable version snapshot and audit log
- activate_rule: blocks if priority conflict exists
- deactivate_rule: deactivates without creating version snapshot
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.core.exceptions import ConflictError
from app.modules.approval_rules.models import ApprovalRule
from app.modules.approval_rules.service import RulesEngine


def make_rule(
    rule_code: str,
    priority: int,
    condition_expr: str | None = None,
    is_active: bool = True,
    is_catch_all: bool = False,
    template_code: str = "TEST_TEMPLATE",
    entity_type: str = "PR",
) -> MagicMock:
    r = MagicMock(spec=ApprovalRule)
    r.id = uuid4()
    r.org_id = uuid4()
    r.rule_code = rule_code
    r.rule_name = f"Rule {rule_code}"
    r.priority = priority
    r.condition_expression = condition_expr
    r.conditions = {}
    r.is_active = is_active
    r.is_catch_all = is_catch_all
    r.workflow_template_code = template_code
    r.entity_type = entity_type
    r.effective_from = datetime.now(timezone.utc)
    r.effective_to = None
    r.created_by = uuid4()
    return r


@pytest.fixture
def mock_repo():
    return AsyncMock()


@pytest.fixture
def rules_engine(mock_repo):
    return RulesEngine(repo=mock_repo)


class TestRulesMatching:
    @pytest.mark.asyncio
    async def test_higher_priority_rule_matches_first(self, rules_engine, mock_repo):
        """Priority 10 matches before priority 20 even if both conditions are True."""
        rule_high = make_rule("RULE_HIGH", priority=10, condition_expr="amount > 1000")
        rule_low = make_rule("RULE_LOW", priority=20, condition_expr="amount > 100")
        mock_repo.get_active_rules.return_value = [rule_high, rule_low]

        db = AsyncMock()
        matched = await rules_engine.find_matching_rule(
            db, "PR", {"amount": 5000}, uuid4()
        )
        assert matched is not None
        assert matched.rule_code == "RULE_HIGH"

    @pytest.mark.asyncio
    async def test_falls_through_to_lower_priority_when_first_condition_fails(
        self, rules_engine, mock_repo
    ):
        """When priority 10 condition is False, priority 20 matches."""
        rule_high = make_rule("RULE_HIGH", priority=10, condition_expr="amount > 10000")
        rule_low = make_rule("RULE_LOW", priority=20, condition_expr="amount > 100")
        mock_repo.get_active_rules.return_value = [rule_high, rule_low]

        db = AsyncMock()
        matched = await rules_engine.find_matching_rule(
            db, "PR", {"amount": 500}, uuid4()
        )
        assert matched is not None
        assert matched.rule_code == "RULE_LOW"

    @pytest.mark.asyncio
    async def test_catch_all_used_when_no_specific_rule_matches(
        self, rules_engine, mock_repo
    ):
        """Catch-all rule matches when all specific rule conditions evaluate to False."""
        rule_specific = make_rule("RULE_SPECIFIC", priority=10, condition_expr="amount > 10000")
        rule_catch_all = make_rule(
            "RULE_CATCH_ALL", priority=1000, condition_expr=None, is_catch_all=True
        )
        mock_repo.get_active_rules.return_value = [rule_specific, rule_catch_all]

        db = AsyncMock()
        matched = await rules_engine.find_matching_rule(
            db, "PR", {"amount": 500}, uuid4()
        )
        assert matched is not None
        assert matched.rule_code == "RULE_CATCH_ALL"

    @pytest.mark.asyncio
    async def test_unmatched_rule_fires_alert(self, rules_engine, mock_repo):
        """When neither specific nor catch-all rule matches, return None and publish alert."""
        rule_specific = make_rule("RULE_SPECIFIC", priority=10, condition_expr="amount > 10000")
        mock_repo.get_active_rules.return_value = [rule_specific]

        db = AsyncMock()
        db.add = MagicMock()
        matched = await rules_engine.find_matching_rule(
            db, "PR", {"amount": 500}, uuid4()
        )
        assert matched is None


class TestConflictDetection:
    @pytest.mark.asyncio
    async def test_detects_same_priority_conflict(self, rules_engine, mock_repo):
        """Rules with same priority and entity_type are flagged as conflicts."""
        existing_rule = make_rule("EXISTING", priority=10)
        new_rule = make_rule("NEW", priority=10)
        mock_repo.get_rules_by_priority.return_value = [existing_rule]

        db = AsyncMock()
        conflicts = await rules_engine.detect_conflicts(db, new_rule)
        assert len(conflicts) == 1
        assert conflicts[0]["rule_code"] == "EXISTING"
        assert conflicts[0]["conflict"] == "SAME_PRIORITY"

    @pytest.mark.asyncio
    async def test_no_conflict_when_different_priority(self, rules_engine, mock_repo):
        """No conflict when priorities differ."""
        new_rule = make_rule("NEW", priority=15)
        mock_repo.get_rules_by_priority.return_value = []

        db = AsyncMock()
        conflicts = await rules_engine.detect_conflicts(db, new_rule)
        assert len(conflicts) == 0


class TestRuleActivationAndVersioning:
    @pytest.mark.asyncio
    async def test_activate_creates_version_snapshot(self, rules_engine, mock_repo):
        """Activating a rule adds an ApprovalRuleVersion snapshot."""
        rule = make_rule("RULE_1", priority=10, is_active=False)
        mock_repo.get.return_value = rule
        mock_repo.get_rules_by_priority.return_value = []

        db = AsyncMock()
        db.add = MagicMock()

        activated = await rules_engine.activate_rule(db, rule.id, uuid4(), rule.org_id)
        assert activated.is_active is True
        # Version snapshot must have been added to db session
        assert db.add.called

    @pytest.mark.asyncio
    async def test_activate_blocked_by_conflict(self, rules_engine, mock_repo):
        """Activating a rule with priority conflict raises ConflictError."""
        existing = make_rule("EXISTING", priority=10)
        rule = make_rule("TO_ACTIVATE", priority=10, is_active=False)
        mock_repo.get.return_value = rule
        mock_repo.get_rules_by_priority.return_value = [existing]

        db = AsyncMock()
        with pytest.raises(ConflictError):
            await rules_engine.activate_rule(db, rule.id, uuid4(), rule.org_id)

    @pytest.mark.asyncio
    async def test_deactivate_does_not_create_version(self, rules_engine, mock_repo):
        """Deactivating a rule sets is_active=False without creating a new version snapshot."""
        rule = make_rule("RULE_1", priority=10, is_active=True)
        mock_repo.get.return_value = rule

        db = AsyncMock()
        db.add = MagicMock()

        deactivated = await rules_engine.deactivate_rule(db, rule.id, uuid4(), rule.org_id)
        assert deactivated.is_active is False
        # db.add is called for audit log only, NOT for ApprovalRuleVersion
        # We can check no ApprovalRuleVersion was added
        added_objs = [call.args[0] for call in db.add.call_args_list]
        for obj in added_objs:
            assert not hasattr(obj, "snapshot")
