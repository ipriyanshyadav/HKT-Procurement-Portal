"use client";

import React from "react";

export interface BudgetIndicatorProps {
  estimatedTotal: number;
  availableBudget?: number | null;
  budgetStatus?: string; // "SUFFICIENT" | "WARNING" | "BLOCKED" | "NOT_CHECKED"
  currency?: string;
  className?: string;
}

export const BudgetIndicator: React.FC<BudgetIndicatorProps> = ({
  estimatedTotal,
  availableBudget = 0,
  budgetStatus = "NOT_CHECKED",
  currency = "INR",
  className = "",
}) => {
  const available = availableBudget || 0;
  const percentage = available > 0 ? Math.min(Math.round((estimatedTotal / available) * 100), 100) : 0;
  const isOverBudget = available > 0 && estimatedTotal > available;

  const getStatusBadge = () => {
    switch (budgetStatus?.toUpperCase()) {
      case "SUFFICIENT":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            ✓ Budget Sufficient
          </span>
        );
      case "WARNING":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            ⚠ Advisory Warning
          </span>
        );
      case "BLOCKED":
      case "INSUFFICIENT":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            ✕ Budget Blocked
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
            Budget Pending Check
          </span>
        );
    }
  };

  return (
    <div className={`p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Budget Utilization
        </span>
        {getStatusBadge()}
      </div>

      <div className="flex items-baseline justify-between text-sm">
        <div>
          <span className="text-xs text-gray-400 block">Requested Total</span>
          <span className="text-lg font-bold text-gray-900">
            {currency} {estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        {available > 0 && (
          <div className="text-right">
            <span className="text-xs text-gray-400 block">Available Budget</span>
            <span className={`text-sm font-semibold ${isOverBudget ? "text-red-600" : "text-gray-700"}`}>
              {currency} {available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {available > 0 && (
        <div className="space-y-1">
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isOverBudget
                  ? "bg-red-500"
                  : percentage > 85
                  ? "bg-amber-500"
                  : "bg-blue-600"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 text-right">
            {percentage}% consumed
          </p>
        </div>
      )}
    </div>
  );
};
