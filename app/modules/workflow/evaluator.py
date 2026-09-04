"""
Workflow Condition Evaluator — safe expression evaluation using simpleeval.
Security: ALLOWED_NAMES whitelist; functions stripped; fails safe on error.
"""
from __future__ import annotations

from typing import Optional

from loguru import logger
from simpleeval import EvalWithCompoundTypes, InvalidExpression

ALLOWED_NAMES: frozenset[str] = frozenset({
    "amount",
    "estimated_value",
    "total_value",
    "awarded_total",
    "total_amount",
    "category_level1",
    "bu_id",
    "rfq_type",
    "bidder_count",
    "is_capex",
    "is_emergency",
    "is_single_vendor",
    "is_strategic",
    "risk_class",
    "procurement_type",
    "vendor_type",
    "sourcing_type",
    "category_id",
    "plant_id",
    "business_unit_id",
    "contract_value",
    "po_value",
    "invoice_amount",
    "vendor_category_ids",
})


def safe_eval(expression: Optional[str], context: dict) -> bool:
    """
    Evaluate a boolean expression against entity context using simpleeval.

    - Only ALLOWED_NAMES keys pass through — all others are stripped.
    - Function calls are prohibited (functions dict set to empty).
    - Returns True on empty/None expression (step always runs).
    - Returns False on any evaluation error (fail-safe: step skipped, not crashed).
    """
    if not expression:
        return True

    safe_context: dict = {k: v for k, v in context.items() if k in ALLOWED_NAMES}

    try:
        evaluator = EvalWithCompoundTypes(names=safe_context)
        evaluator.functions = {}  # NO function calls allowed
        result = evaluator.eval(expression)
        return bool(result)
    except InvalidExpression as exc:
        logger.error(
            "Workflow condition evaluation error",
            expression=expression,
            error=str(exc),
        )
        return False
    except Exception as exc:
        logger.error(
            "Unexpected error in safe_eval",
            expression=expression,
            error=str(exc),
        )
        return False
