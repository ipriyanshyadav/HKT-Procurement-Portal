"""
Approval Rules Models — ApprovalRule + ApprovalRuleVersion.

Matches PostgreSQL schema (SPEC_03 + SPEC_06):
- approval_rules table: id, org_id, name, transaction_type, priority,
  conditions, approval_steps, is_active, current_version_id, created_by, updated_by
- approval_rule_versions table: id, org_id, approval_rule_id, version_number,
  conditions, approval_steps, effective_from, effective_to, change_reason,
  impact_assessment, created_by

Includes hybrid property aliases (entity_type, rule_name, rule_code, condition_expression,
workflow_template_code, is_catch_all) for clean API/service compatibility.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class ApprovalRule(BaseModel):
    """Approval routing rule — maps entity + conditions → workflow template / approval steps."""

    __tablename__ = "approval_rules"

    # Core DB columns matching migration 0010 & SPEC_03
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False)
    conditions: Mapped[List[Any]] = mapped_column(JSONB, default=list, nullable=False)
    approval_steps: Mapped[List[Any]] = mapped_column(JSONB, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    current_version_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    updated_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

    # ── Convenient property aliases for SPEC_06 API / Service ──────────────────

    @hybrid_property
    def rule_name(self) -> str:
        return self.name

    @rule_name.setter
    def rule_name(self, val: str) -> None:
        self.name = val

    @hybrid_property
    def rule_code(self) -> str:
        return self.name

    @rule_code.setter
    def rule_code(self, val: str) -> None:
        self.name = val

    @hybrid_property
    def entity_type(self) -> str:
        return self.transaction_type

    @entity_type.setter
    def entity_type(self, val: str) -> None:
        self.transaction_type = val

    @property
    def condition_expression(self) -> Optional[str]:
        if isinstance(self.conditions, dict):
            return self.conditions.get("expression")
        if isinstance(self.conditions, list):
            for c in self.conditions:
                if isinstance(c, dict) and "expression" in c:
                    return c["expression"]
        return None

    @condition_expression.setter
    def condition_expression(self, val: Optional[str]) -> None:
        if isinstance(self.conditions, dict):
            self.conditions["expression"] = val
        elif isinstance(self.conditions, list):
            # Check if an expression dict exists
            found = False
            for c in self.conditions:
                if isinstance(c, dict) and "expression" in c:
                    c["expression"] = val
                    found = True
                    break
            if not found and val:
                self.conditions.append({"expression": val})
        elif val:
            self.conditions = [{"expression": val}]

    @property
    def workflow_template_code(self) -> str:
        if isinstance(self.approval_steps, dict):
            return self.approval_steps.get("template_code", "")
        if isinstance(self.approval_steps, list) and self.approval_steps:
            first = self.approval_steps[0]
            if isinstance(first, dict):
                return first.get("template_code", first.get("workflow_template_code", ""))
        return ""

    @workflow_template_code.setter
    def workflow_template_code(self, val: str) -> None:
        if isinstance(self.approval_steps, dict):
            self.approval_steps["template_code"] = val
        elif isinstance(self.approval_steps, list):
            if self.approval_steps and isinstance(self.approval_steps[0], dict):
                self.approval_steps[0]["template_code"] = val
            else:
                self.approval_steps = [{"template_code": val}]
        else:
            self.approval_steps = [{"template_code": val}]

    @property
    def is_catch_all(self) -> bool:
        if not self.conditions or len(self.conditions) == 0:
            return True
        if isinstance(self.conditions, dict) and self.conditions.get("is_catch_all"):
            return True
        if isinstance(self.conditions, list):
            for c in self.conditions:
                if isinstance(c, dict) and c.get("is_catch_all"):
                    return True
        return False

    @is_catch_all.setter
    def is_catch_all(self, val: bool) -> None:
        if isinstance(self.conditions, dict):
            self.conditions["is_catch_all"] = val
        elif isinstance(self.conditions, list) and not self.conditions and not val:
            self.conditions = [{"is_catch_all": False}]

    @property
    def effective_from(self) -> Optional[datetime]:
        return self.created_at

    @property
    def effective_to(self) -> Optional[datetime]:
        return None


class ApprovalRuleVersion(BaseModel):
    """
    Immutable snapshot of an approval rule at activation time.
    Created on activation (is_active=True).
    """

    __tablename__ = "approval_rule_versions"

    approval_rule_id: Mapped[UUID] = mapped_column(
        ForeignKey("approval_rules.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    conditions: Mapped[List[Any]] = mapped_column(JSONB, nullable=False, default=list)
    approval_steps: Mapped[List[Any]] = mapped_column(JSONB, nullable=False, default=list)
    effective_from: Mapped[datetime] = mapped_column(
        nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    effective_to: Mapped[Optional[datetime]] = mapped_column(nullable=True, default=None)
    change_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    impact_assessment: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

    @property
    def rule_id(self) -> UUID:
        return self.approval_rule_id

    @rule_id.setter
    def rule_id(self, val: UUID) -> None:
        self.approval_rule_id = val

    @property
    def snapshot(self) -> Dict[str, Any]:
        return {
            "version_number": self.version_number,
            "conditions": self.conditions,
            "approval_steps": self.approval_steps,
            "effective_from": self.effective_from.isoformat() if self.effective_from else None,
            "effective_to": self.effective_to.isoformat() if self.effective_to else None,
            "change_reason": self.change_reason,
            "impact_assessment": self.impact_assessment,
        }

    @snapshot.setter
    def snapshot(self, val: Dict[str, Any]) -> None:
        if isinstance(val, dict):
            self.conditions = val.get("conditions", [])
            self.approval_steps = val.get("approval_steps", [])
            self.impact_assessment = val

    @property
    def activated_by(self) -> Optional[UUID]:
        return self.created_by

    @activated_by.setter
    def activated_by(self, val: Optional[UUID]) -> None:
        self.created_by = val

    @property
    def activated_at(self) -> datetime:
        return self.effective_from
