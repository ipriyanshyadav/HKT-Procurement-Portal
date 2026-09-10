"use client";

import React from "react";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";

export interface TicketSLAIndicatorProps {
  slaStatus?: string | null;
  slaBreachAt?: string | null;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  status?: string;
  resolutionDeadline?: string | null;
  firstResponseDeadline?: string | null;
  isFirstResponseBreached?: boolean;
  isResolutionBreached?: boolean;
  compact?: boolean;
}

export function TicketSLAIndicator({
  slaStatus,
  slaBreachAt,
  firstResponseAt,
  resolvedAt,
  status,
  resolutionDeadline,
  firstResponseDeadline,
  isFirstResponseBreached,
  isResolutionBreached,
  compact = false,
}: TicketSLAIndicatorProps) {
  const isResolved = status === "RESOLVED" || status === "CLOSED" || Boolean(resolvedAt);
  const breachAt = slaBreachAt || resolutionDeadline || firstResponseDeadline;

  if (isResolved) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>Resolved</span>
      </div>
    );
  }

  if (!breachAt) {
    return null;
  }

  const deadline = new Date(breachAt);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const isBreached =
    slaStatus === "BREACHED" ||
    isResolutionBreached ||
    isFirstResponseBreached ||
    diffMs <= 0;

  let colorClass = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
  let progressColor = "bg-emerald-500";
  let text = "";

  if (isBreached) {
    colorClass = "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    progressColor = "bg-rose-500";
    const overdueHours = Math.abs(Math.round(diffHours));
    text = overdueHours > 0 ? `Breached by ${overdueHours}h` : "SLA Breached";
  } else if (diffHours < 1) {
    colorClass = "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 animate-pulse";
    progressColor = "bg-rose-500";
    const minutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
    text = `${minutes}m remaining`;
  } else if (diffHours <= 4 || slaStatus === "AT_RISK") {
    colorClass = "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    progressColor = "bg-amber-500";
    text = `${Math.round(diffHours)}h remaining`;
  } else if (diffHours <= 24) {
    colorClass = "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    progressColor = "bg-blue-500";
    text = `${Math.round(diffHours)}h remaining`;
  } else {
    const days = Math.round(diffHours / 24);
    colorClass = "bg-slate-50 dark:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10";
    progressColor = "bg-slate-400 dark:bg-slate-500";
    text = `${days}d remaining`;
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}>
        {isBreached ? <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> : <Clock className="w-3 h-3" />}
        <span>{text}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 text-xs px-2.5 py-1.5 rounded-xl border ${colorClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-medium">
          {isBreached ? <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> : <Clock className="w-3.5 h-3.5" />}
          {isBreached ? "SLA Alert" : "Target SLA"}
        </span>
        <span className="font-semibold">{text}</span>
      </div>
      <div className="w-full bg-black/10 dark:bg-white/15 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full ${progressColor}`}
          style={{ width: isBreached ? "100%" : `${Math.min(100, Math.max(5, (1 - diffHours / 72) * 100))}%` }}
        />
      </div>
    </div>
  );
}
