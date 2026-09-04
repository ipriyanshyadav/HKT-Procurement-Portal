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

    async def find_matching_rule(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_context: dict,
        org_id: UUID,
    ) -> Optional[ApprovalRule]:
        """
        Evaluate all active rules for entity_type in priority order (ascending = higher first).
        Catch-all is reserved as last resort. Fires alert event if nothing matches.
        """
        now = datetime.now(timezone.utc)
        active_rules = await self._repo.get_active_rules(db, entity_type, org_id, now)

        # Specific rules (non-catch-all) evaluated first, in priority order
        for rule in active_rules:
            if rule.is_catch_all:
                continue
            if safe_eval(rule.condition_expression or "", entity_context):
                logger.info(
                    "Approval rule matched",
                    rule_code=rule.rule_code,
                    entity_type=entity_type,
                )
                return rule

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
