"""
Unit tests for the workflow condition evaluator (safe_eval).
Tests: simple comparisons, boolean operators, injection attempts, edge cases.
"""
from __future__ import annotations

import pytest

from app.modules.workflow.evaluator import safe_eval


class TestSafeEvalBasic:
    def test_simple_greater_than(self):
        assert safe_eval("amount > 100000", {"amount": 200000}) is True

    def test_simple_less_than(self):
        assert safe_eval("amount < 100000", {"amount": 50000}) is True

    def test_equality(self):
        assert safe_eval("is_capex == True", {"is_capex": True}) is True

    def test_equality_false(self):
        assert safe_eval("is_capex == True", {"is_capex": False}) is False

    def test_boolean_and(self):
        assert safe_eval(
            "is_capex == True and amount > 500000",
            {"is_capex": True, "amount": 600000},
        ) is True

    def test_boolean_and_partial_false(self):
        assert safe_eval(
            "is_capex == True and amount > 500000",
            {"is_capex": True, "amount": 400000},
        ) is False

    def test_boolean_or(self):
        assert safe_eval(
            "is_emergency == True or amount > 5000000",
            {"is_emergency": False, "amount": 6000000},
        ) is True

    def test_string_comparison(self):
        assert safe_eval(
            "procurement_type == 'CAPEX'",
            {"procurement_type": "CAPEX"},
        ) is True


class TestSafeEvalEdgeCases:
    def test_empty_string_returns_true(self):
        assert safe_eval("", {}) is True

    def test_none_returns_true(self):
        assert safe_eval(None, {}) is True

    def test_missing_field_returns_false(self):
        """Non-whitelisted / missing field → safe_eval fails safe → False."""
        assert safe_eval("nonexistent_field > 100", {}) is False

    def test_whitelisted_field_missing_from_context(self):
        """Whitelisted field but not in context → evaluator NameNotDefined → False."""
        assert safe_eval("amount > 100", {}) is False

    def test_zero_boundary(self):
        assert safe_eval("amount > 0", {"amount": 0}) is False
        assert safe_eval("amount > 0", {"amount": 1}) is True


class TestSafeEvalSecurity:
    def test_import_injection_blocked(self):
        """__import__ is not in ALLOWED_NAMES and functions dict is empty → False."""
        result = safe_eval("__import__('os').system('rm -rf /')", {})
        assert result is False

    def test_exec_injection_blocked(self):
        result = safe_eval("exec('import os')", {})
        assert result is False

    def test_function_call_blocked(self):
        """Even whitelisted-name functions are stripped."""
        result = safe_eval("len(amount)", {"amount": [1, 2, 3]})
        assert result is False

    def test_non_whitelisted_variable_stripped(self):
        """Variable not in ALLOWED_NAMES is stripped from context."""
        result = safe_eval("password > 0", {"password": 9999})
        assert result is False

    def test_attribute_access_blocked(self):
        result = safe_eval("amount.__class__.__name__", {"amount": 1000})
        assert result is False

    def test_nested_expression_safe(self):
        """Complex but safe expression evaluates correctly."""
        assert safe_eval(
            "amount > 500000 and is_capex == True and procurement_type == 'CAPEX'",
            {
                "amount": 1000000,
                "is_capex": True,
                "procurement_type": "CAPEX",
            },
        ) is True
