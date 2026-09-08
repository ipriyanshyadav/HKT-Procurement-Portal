from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.redis_client import get_redis_client
from app.modules.ticket.models import Ticket, TicketActivityLog, TicketAutomationRule, TicketComment
from app.modules.ticket.repository import ticket_repository


class TicketAutomationEngine:
    """Evaluates and executes no-code Jira-style automation rules."""

    def __init__(self) -> None:
        self.repo = ticket_repository
        self.redis = get_redis_client()

    async def trigger(
        self,
        db: AsyncSession,
        trigger_type: str,
        ticket: Ticket,
        org_id: UUID,
        context: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Finds all active rules for this trigger and org, evaluates conditions, and runs actions."""
        executed_rules: list[dict[str, Any]] = []
        rules = await self.repo.get_automation_rules(db, org_id, trigger_type=trigger_type, only_enabled=True)
        if not rules:
            return executed_rules

        ctx = context or {}

        for rule in rules:
            try:
                # 1. Evaluate Trigger Config if applicable
                if not self._matches_trigger_config(rule.trigger_config, ctx):
                    continue

                # 2. Evaluate Conditions
                if not self._evaluate_conditions(rule.conditions, ticket, ctx):
                    continue

                # 3. Execute Actions
                action_results = await self._execute_actions(db, rule, ticket, org_id)

                rule.execution_count = (rule.execution_count or 0) + 1
                rule.last_executed_at = datetime.now(timezone.utc)
                executed_rules.append({
                    "rule_id": str(rule.id),
                    "rule_name": rule.name,
                    "actions": action_results,
                })
            except Exception as e:
                logger.error(f"Error executing automation rule {rule.id} ({rule.name}): {e}")

        return executed_rules

    def _matches_trigger_config(self, trigger_config: dict[str, Any], context: dict[str, Any]) -> bool:
        if not trigger_config:
            return True
        for key, expected in trigger_config.items():
            if context.get(key) != expected:
                return False
        return True

    def _evaluate_conditions(
        self,
        conditions: list[dict[str, Any]],
        ticket: Ticket,
        context: dict[str, Any],
    ) -> bool:
        if not conditions:
            return True

        for cond in conditions:
            field = cond.get("field")
            op = cond.get("operator", "eq")
            expected = cond.get("value")

            # Resolve actual value from ticket or context
            actual = getattr(ticket, field, None) if hasattr(ticket, field) else context.get(field)

            if not self._eval_single_condition(actual, op, expected):
                return False
        return True

    def _eval_single_condition(self, actual: Any, op: str, expected: Any) -> bool:
        if op == "eq":
            return str(actual) == str(expected) if actual is not None else expected is None
        elif op == "ne":
            return str(actual) != str(expected)
        elif op == "in":
            if isinstance(expected, list):
                return actual in expected or str(actual) in [str(x) for x in expected]
            return False
        elif op == "not_in":
            if isinstance(expected, list):
                return actual not in expected and str(actual) not in [str(x) for x in expected]
            return True
        elif op == "contains":
            if expected is None:
                return False
            if isinstance(actual, list):
                return expected in actual or str(expected) in [str(x) for x in actual]
            if isinstance(actual, str):
                return str(expected).lower() in actual.lower()
            return False
        elif op in ("gt", "gte", "lt", "lte"):
            try:
                if actual is None or expected is None:
                    return False
                if op == "gt":
                    return float(actual) > float(expected)
                elif op == "gte":
                    return float(actual) >= float(expected)
                elif op == "lt":
                    return float(actual) < float(expected)
                elif op == "lte":
                    return float(actual) <= float(expected)
            except (ValueError, TypeError):
                return False
        return True

    async def _execute_actions(
        self,
        db: AsyncSession,
        rule: TicketAutomationRule,
        ticket: Ticket,
        org_id: UUID,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []

        for action in rule.actions:
            action_name = action.get("action")

            if action_name == "ASSIGN_ROUND_ROBIN":
                user_ids_raw = action.get("user_ids", [])
                user_ids = [UUID(str(u)) for u in user_ids_raw]
                if user_ids:
                    # Atomic round-robin index in Redis
                    key = f"automation:rr:{rule.id}"
                    idx = await self.redis.incr(key)
                    assigned_uid = user_ids[idx % len(user_ids)]
                    old_assignee = ticket.assigned_to
                    ticket.assigned_to = assigned_uid
                    if ticket.status == "OPEN":
                        ticket.status = "IN_PROGRESS"
                    db.add(
                        TicketActivityLog(
                            org_id=org_id,
                            ticket_id=ticket.id,
                            actor_id=rule.created_by,
                            activity_type="AUTOMATION_ASSIGNED",
                            old_value=str(old_assignee) if old_assignee else None,
                            new_value=f"round_robin -> {assigned_uid} (rule: {rule.name})",
                        )
                    )
                    results.append({"action": action_name, "assigned_to": str(assigned_uid)})

            elif action_name == "ASSIGN_BALANCED":
                user_ids_raw = action.get("user_ids", [])
                user_ids = [UUID(str(u)) for u in user_ids_raw]
                if user_ids:
                    counts = await self.repo.count_open_tickets_by_users(db, user_ids, org_id)
                    # Pick user with lowest open tickets count
                    best_user = min(user_ids, key=lambda uid: counts.get(uid, 0))
                    old_assignee = ticket.assigned_to
                    ticket.assigned_to = best_user
                    if ticket.status == "OPEN":
                        ticket.status = "IN_PROGRESS"
                    db.add(
                        TicketActivityLog(
                            org_id=org_id,
                            ticket_id=ticket.id,
                            actor_id=rule.created_by,
                            activity_type="AUTOMATION_ASSIGNED",
                            old_value=str(old_assignee) if old_assignee else None,
                            new_value=f"balanced_workload -> {best_user} (rule: {rule.name})",
                        )
                    )
                    results.append({"action": action_name, "assigned_to": str(best_user)})

            elif action_name == "ASSIGN_USER":
                uid = UUID(str(action["user_id"]))
                old_assignee = ticket.assigned_to
                ticket.assigned_to = uid
                if action.get("team"):
                    ticket.assigned_team = action["team"]
                if ticket.status == "OPEN":
                    ticket.status = "IN_PROGRESS"
                db.add(
                    TicketActivityLog(
                        org_id=org_id,
                        ticket_id=ticket.id,
                        actor_id=rule.created_by,
                        activity_type="AUTOMATION_ASSIGNED",
                        old_value=str(old_assignee) if old_assignee else None,
                        new_value=str(uid),
                    )
                )
                results.append({"action": action_name, "assigned_to": str(uid)})

            elif action_name == "TRANSITION_STATUS":
                target_status = action.get("status")
                if target_status and target_status != ticket.status:
                    old_status = ticket.status
                    ticket.status = target_status
                    db.add(
                        TicketActivityLog(
                            org_id=org_id,
                            ticket_id=ticket.id,
                            actor_id=rule.created_by,
                            activity_type="AUTOMATION_STATUS_CHANGE",
                            old_value=old_status,
                            new_value=target_status,
                        )
                    )
                    results.append({"action": action_name, "status": target_status})

            elif action_name == "CHANGE_PRIORITY":
                new_priority = action.get("priority")
                if new_priority and new_priority != ticket.priority:
                    old_prio = ticket.priority
                    ticket.priority = new_priority
                    db.add(
                        TicketActivityLog(
                            org_id=org_id,
                            ticket_id=ticket.id,
                            actor_id=rule.created_by,
                            activity_type="AUTOMATION_PRIORITY_CHANGE",
                            old_value=old_prio,
                            new_value=new_priority,
                        )
                    )
                    results.append({"action": action_name, "priority": new_priority})

            elif action_name == "SET_DUE_DATE":
                days = int(action.get("days_from_now", settings.TICKET_DEFAULT_ROUND_ROBIN_DUE_DAYS))
                due = date.today() + timedelta(days=days)
                ticket.due_date = due
                db.add(
                    TicketActivityLog(
                        org_id=org_id,
                        ticket_id=ticket.id,
                        actor_id=rule.created_by,
                        activity_type="AUTOMATION_DUE_DATE",
                        new_value=due.isoformat(),
                    )
                )
                results.append({"action": action_name, "due_date": due.isoformat()})

            elif action_name == "ADD_TAG":
                tag = str(action.get("tag", "")).strip()
                if tag and tag not in ticket.tags:
                    ticket.tags = list(ticket.tags) + [tag]
                    results.append({"action": action_name, "tag": tag})

            elif action_name == "ADD_COMMENT":
                content = str(action.get("content", ""))
                is_internal = bool(action.get("is_internal", False))
                if content:
                    comment = TicketComment(
                        org_id=org_id,
                        ticket_id=ticket.id,
                        author_id=rule.created_by,
                        content=content,
                        is_internal=is_internal,
                    )
                    db.add(comment)
                    results.append({"action": action_name, "comment": content[:50]})

        return results


ticket_automation_engine = TicketAutomationEngine()
