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
      <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
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

  let colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let progressColor = "bg-emerald-500";
  let text = "";

  if (isBreached) {
    colorClass = "bg-rose-50 text-rose-700 border-rose-200";
    progressColor = "bg-rose-500";
    const overdueHours = Math.abs(Math.round(diffHours));
    text = overdueHours > 0 ? `Breached by ${overdueHours}h` : "SLA Breached";
  } else if (diffHours < 1) {
    colorClass = "bg-rose-50 text-rose-700 border-rose-200 animate-pulse";
    progressColor = "bg-rose-500";
    const minutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
    text = `${minutes}m remaining`;
  } else if (diffHours <= 4 || slaStatus === "AT_RISK") {
    colorClass = "bg-amber-50 text-amber-700 border-amber-200";
    progressColor = "bg-amber-500";
    text = `${Math.round(diffHours)}h remaining`;
  } else if (diffHours <= 24) {
    colorClass = "bg-blue-50 text-blue-700 border-blue-200";
    progressColor = "bg-blue-500";
    text = `${Math.round(diffHours)}h remaining`;
  } else {
    const days = Math.round(diffHours / 24);
    colorClass = "bg-slate-50 text-slate-700 border-slate-200";
    progressColor = "bg-slate-400";
    text = `${days}d remaining`;
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${colorClass}`}>
        {isBreached ? <AlertTriangle className="w-3 h-3 text-rose-600" /> : <Clock className="w-3 h-3" />}
        <span>{text}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 text-xs px-2.5 py-1.5 rounded-md border ${colorClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-medium">
          {isBreached ? <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> : <Clock className="w-3.5 h-3.5" />}
          {isBreached ? "SLA Alert" : "Target SLA"}
        </span>
        <span className="font-semibold">{text}</span>
      </div>
      <div className="w-full bg-black/10 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full ${progressColor}`}
          style={{ width: isBreached ? "100%" : `${Math.min(100, Math.max(5, (1 - diffHours / 72) * 100))}%` }}
        />
      </div>
    </div>
  );
}
