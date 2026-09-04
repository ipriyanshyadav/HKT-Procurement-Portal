"use client";

import React from "react";
import { AlertTriangle, Clock, XCircle, CheckCircle2 } from "lucide-react";

export interface ContractExpiryCountdownProps {
  /** ISO date string or Date object */
  endDate: string | Date;
  /** Explicit warning level if provided from API, otherwise calculated */
  warningLevel?: "SAFE" | "WARNING" | "CRITICAL" | "EXPIRED" | string;
  /** Pre-calculated days remaining if provided */
  daysRemaining?: number | null;
  /** Compact badge display */
  compact?: boolean;
  /** Custom css class name */
  className?: string;
}

export function ContractExpiryCountdown({
  endDate,
  warningLevel,
  daysRemaining: propDays,
  compact = false,
  className = "",
}: ContractExpiryCountdownProps) {
  const days = React.useMemo(() => {
    if (propDays !== undefined && propDays !== null) {
      return propDays;
    }
    const end = new Date(endDate).getTime();
    const now = Date.now();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  }, [endDate, propDays]);

  const level = React.useMemo(() => {
    if (warningLevel) {
      const upper = warningLevel.toUpperCase();
      if (["SAFE", "WARNING", "CRITICAL", "EXPIRED"].includes(upper)) {
        return upper as "SAFE" | "WARNING" | "CRITICAL" | "EXPIRED";
      }
    }
    if (days <= 0) return "EXPIRED";
    if (days < 30) return "CRITICAL";
    if (days < 60) return "WARNING";
    return "SAFE";
  }, [days, warningLevel]);

  // Color config according to SPEC_13: red < 30 / expired, yellow < 60, green >= 60
  const config = React.useMemo(() => {
    switch (level) {
      case "EXPIRED":
        return {
          bg: "bg-red-50 dark:bg-red-950/30",
          text: "text-red-700 dark:text-red-400",
          border: "border-red-200 dark:border-red-900/50",
          dot: "bg-red-500",
          label: days <= 0 && days !== 0 ? `Expired ${Math.abs(days)}d ago` : "Expired today",
          icon: XCircle,
        };
      case "CRITICAL":
        return {
          bg: "bg-red-50 dark:bg-red-950/30",
          text: "text-red-700 dark:text-red-400",
          border: "border-red-200 dark:border-red-900/50",
          dot: "bg-red-500 animate-pulse",
          label: `${days}d left (Critical)`,
          icon: AlertTriangle,
        };
      case "WARNING":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/30",
          text: "text-amber-700 dark:text-amber-400",
          border: "border-amber-200 dark:border-amber-900/50",
          dot: "bg-amber-500",
          label: `${days}d left (Expiring soon)`,
          icon: Clock,
        };
      case "SAFE":
      default:
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/30",
          text: "text-emerald-700 dark:text-emerald-400",
          border: "border-emerald-200 dark:border-emerald-900/50",
          dot: "bg-emerald-500",
          label: `${days}d left`,
          icon: CheckCircle2,
        };
    }
  }, [days, level]);

  const Icon = config.icon;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
        title={`Expiry: ${new Date(endDate).toLocaleDateString()}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border ${config.bg} ${config.text} ${config.border} shadow-sm ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{config.label}</span>
    </div>
  );
}
