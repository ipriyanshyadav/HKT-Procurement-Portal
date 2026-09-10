"""
Rules Engine Service — find_matching_rule(), detect_conflicts(), activate_rule().

Priority: lower integer = higher priority (1 = highest).
Catch-all rule evaluated last when no specific rule matches.
PENDING_RULE_RESOLUTION: fires alert when neither specific nor catch-all matches.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import AppException, ConflictError, NotFoundError
from app.events.publisher import OutboxPublisher
from app.modules.approval_rules.models import ApprovalRule, ApprovalRuleVersion
from app.modules.approval_rules.repository import (
    ApprovalRulesRepository,
    approval_rules_repository,
)
from app.modules.audit.service import audit_service
from app.modules.workflow.evaluator import safe_eval


class RulesEngine:
    """
    Approval Rules matching engine.
    Immutable rule evaluation: reads active rules, evaluates conditions via safe_eval,
    returns the highest-priority matching rule.
    """

    def __init__(self, repo: ApprovalRulesRepository) -> None:
        self._repo = repo

    def _evaluate_conditions(self, conditions: Any, context: dict) -> bool:
        """
        Evaluate rule conditions against entity context.
        Supports structured conditions list, expression strings, and compound dictionaries.
        """
        if not conditions:
            return True

        if isinstance(conditions, str):
            return safe_eval(conditions, context)

        if isinstance(conditions, dict):
            if "expression" in conditions:
                return safe_eval(conditions["expression"], context)
            if "conditions" in conditions and isinstance(conditions["conditions"], list):
                conditions = conditions["conditions"]
            else:
                return True

        if not isinstance(conditions, list):
            return True

        for cond in conditions:
            if not isinstance(cond, dict):
                continue
            if "expression" in cond:
                if not safe_eval(cond["expression"], context):
                    return False
                continue

            field = cond.get("field")
            operator = str(cond.get("operator", "eq")).lower()
            expected = cond.get("value")

            if not field:
                continue

            actual = context.get(field)
            if not self._check_condition_operator(actual, operator, expected):
                return False

        return True

    def _check_condition_operator(self, actual: Any, operator: str, expected: Any) -> bool:
        """Helper to evaluate standard operators: eq, neq, gt, gte, lt, lte, in, not_in, contains, is_true, is_false."""
        if operator == "eq":
            if actual is None and expected is not None:
                return False
            return str(actual).lower() == str(expected).lower() if isinstance(expected, (str, bool)) else actual == expected
        elif operator == "neq":
            if actual is None and expected is not None:
                return True
            return str(actual).lower() != str(expected).lower() if isinstance(expected, (str, bool)) else actual != expected
        elif operator in ("gt", "gte", "lt", "lte"):
            if actual is None:
                return False
            try:
                act_num = float(actual)
                exp_num = float(expected)
                if operator == "gt":
                    return act_num > exp_num
                elif operator == "gte":
                    return act_num >= exp_num
                elif operator == "lt":
                    return act_num < exp_num
                elif operator == "lte":
                    return act_num <= exp_num
            except (ValueError, TypeError):
                return False
        elif operator == "in":
            if actual is None:
                return False
            if isinstance(expected, (list, tuple, set)):
                act_str = str(actual).lower()
                return act_str in [str(x).lower() for x in expected]
            return str(actual) in str(expected)
        elif operator == "not_in":
            if actual is None:
                return True
            if isinstance(expected, (list, tuple, set)):
                act_str = str(actual).lower()
                return act_str not in [str(x).lower() for x in expected]
            return str(actual) not in str(expected)
        elif operator == "contains":
            if actual is None or expected is None:
                return False
            return str(expected).lower() in str(actual).lower()
        elif operator == "is_true":
            return bool(actual) is True
        elif operator == "is_false":
            return bool(actual) is False

        return True

    async def find_matching_rule(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_context: dict,
        org_id: UUID,
    ) -> Optional[ApprovalRule]:
        """
        Evaluate all active rules for entity_type in priority order (ascending = higher first)
        and specificity order (more conditions = higher specificity).
        Catch-all is reserved as last resort. Fires alert event if nothing matches.
        """
        now = datetime.now(timezone.utc)
        active_rules = await self._repo.get_active_rules(db, entity_type, org_id, now)

        matching_rules = []
        for rule in active_rules:
            if rule.is_catch_all:
                continue
            is_matched = False
            if rule.condition_expression:
                is_matched = safe_eval(rule.condition_expression, entity_context)
            elif rule.conditions:
                is_matched = self._evaluate_conditions(rule.conditions, entity_context)
            else:
                is_matched = True

            if is_matched:
                matching_rules.append(rule)

        if matching_rules:
            # Sort by priority ASC (1 is highest priority), then condition count DESC (higher specificity)
            matching_rules.sort(key=lambda r: (r.priority, -len(r.conditions or [])))
            top = matching_rules[0]
            logger.info(
                "Approval rule matched",
                rule_code=top.rule_code,
                entity_type=entity_type,
            )
            return top

        # Catch-all as fallback
        catch_all = next((r for r in active_rules if r.is_catch_all), None)
        if catch_all:
            logger.info(
                "Catch-all approval rule matched",
                rule_code=catch_all.rule_code,
                entity_type=entity_type,
            )
            return catch_all

        # No rule matched — fire PENDING_RULE_RESOLUTION alert
        logger.warning(
            "No approval rule matched — PENDING_RULE_RESOLUTION",
            entity_type=entity_type,
            org_id=str(org_id),
        )
        await OutboxPublisher.publish(
            db,
            "procurement.alert",
            "alert.rule.unmatched",
            {
                "entity_type": entity_type,
                "entity_context": entity_context,
                "org_id": str(org_id),
            },
            org_id,
        )
        return None

    async def resolve_chain(
        self,
        db: AsyncSession,
        transaction_type: str,
        entity_context: dict,
        org_id: UUID,
    ) -> dict[str, Any]:
        """
        Evaluate all active rules, resolve priority & specificity ties, and return approval chain (SPEC_06).
        """
        now = datetime.now(timezone.utc)
        active_rules = await self._repo.get_active_rules(db, transaction_type, org_id, now)

        matching_rules = []
        for rule in active_rules:
            if rule.is_catch_all:
                continue
            if rule.condition_expression and safe_eval(rule.condition_expression, entity_context):
                matching_rules.append(rule)
            elif rule.conditions and self._evaluate_conditions(rule.conditions, entity_context):
                matching_rules.append(rule)

        if not matching_rules:
            catch_all = next((r for r in active_rules if r.is_catch_all), None)
            if catch_all:
                return {
                    "status": "RESOLVED",
                    "rule_id": str(catch_all.id),
                    "rule_code": catch_all.rule_code,
                    "approval_steps": catch_all.approval_steps,
                    "workflow_template_code": catch_all.workflow_template_code,
                    "is_catch_all": True,
                }
            return {
                "status": "PENDING_RULE_RESOLUTION",
                "reason": "No matching approval rule found for entity context",
            }

        matching_rules.sort(key=lambda r: (r.priority, -len(r.conditions or [])))
        top = matching_rules[0]
        same_priority = [r for r in matching_rules if r.priority == top.priority]

        if len(same_priority) > 1:
            by_specificity = sorted(same_priority, key=lambda r: -len(r.conditions or []))
            if len(by_specificity[0].conditions or []) == len(by_specificity[1].conditions or []):
                return {
                    "status": "PENDING_RULE_RESOLUTION",
                    "reason": "Tied rules at same priority and specificity",
                    "tied_rule_ids": [str(r.id) for r in same_priority],
                }
            top = by_specificity[0]

        return {
            "status": "RESOLVED",
            "rule_id": str(top.id),
            "rule_code": top.rule_code,
            "approval_steps": top.approval_steps,
            "workflow_template_code": top.workflow_template_code,
            "is_catch_all": False,
        }

    async def detect_conflicts(
        self,
        db: AsyncSession,
        new_rule: ApprovalRule,
    ) -> list[dict[str, Any]]:
        """
        Detect priority conflicts: two active rules with same entity_type and priority.
        Returns list of conflicting rule info dicts.
        """
        same_priority = await self._repo.get_rules_by_priority(
            db, new_rule.entity_type, new_rule.priority, new_rule.org_id
        )
        return [
            {
                "rule_id": str(r.id),
                "rule_code": r.rule_code,
                "conflict": "SAME_PRIORITY",
            }
            for r in same_priority
            if r.id != new_rule.id
        ]

    async def activate_rule(
        self,
        db: AsyncSession,
        rule_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> ApprovalRule:
        """
        Activate a rule. Blocks if priority conflicts exist.
        Creates an immutable version snapshot on activation (A-06-3).
        """
        rule = await self._repo.get(db, rule_id, org_id)
        conflicts = await self.detect_conflicts(db, rule)
        if conflicts:
            raise ConflictError(
                f"Rule has priority conflict with {len(conflicts)} existing active rule(s)",
                {"conflicts": conflicts},
            )

        rule.is_active = True

        snapshot = {
            "id": str(rule.id),
            "rule_code": rule.rule_code,
            "rule_name": rule.rule_name,
            "entity_type": rule.entity_type,
            "priority": rule.priority,
            "conditions": rule.conditions,
            "condition_expression": rule.condition_expression,
            "workflow_template_code": rule.workflow_template_code,
            "is_catch_all": rule.is_catch_all,
            "effective_from": rule.effective_from.isoformat() if rule.effective_from else None,
            "effective_to": rule.effective_to.isoformat() if rule.effective_to else None,
        }
        version = ApprovalRuleVersion(
            org_id=org_id,
            rule_id=rule.id,
            snapshot=snapshot,
            activated_by=actor_id,
        )
        db.add(version)

        await audit_service.log(
            db,
            "APPROVAL_RULE",
            rule.id,
            "RULE_ACTIVATED",
            actor_id,
            org_id,
            new_values=snapshot,
        )
        return rule

    async def deactivate_rule(
        self,
        db: AsyncSession,
        rule_id: UUID,
        actor_id: UUID,
        org_id: UUID,
    ) -> ApprovalRule:
        """Deactivate a rule. Does NOT create a version snapshot (A-06-3)."""
        rule = await self._repo.get(db, rule_id, org_id)
        rule.is_active = False
        await audit_service.log(
            db, "APPROVAL_RULE", rule.id, "RULE_DEACTIVATED", actor_id, org_id
        )
        return rule


rules_engine = RulesEngine(repo=approval_rules_repository)
