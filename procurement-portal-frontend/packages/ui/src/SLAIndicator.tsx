"use client";

import React from "react";

export interface SLAIndicatorProps {
  /** ISO datetime string of when the SLA deadline is */
  slaDeadline: string | null;
  /** ISO datetime string of task creation (SLA start) */
  createdAt: string;
  /** Pre-computed SLA status from backend */
  slaStatus: "WITHIN_SLA" | "WARNING" | "ESCALATED" | "REASSIGNED" | "CRITICAL";
}

function computeSLAPercent(createdAt: string, slaDeadline: string): number {
  const created = new Date(createdAt).getTime();
  const deadline = new Date(slaDeadline).getTime();
  const now = Date.now();

  const totalMs = deadline - created;
  if (totalMs <= 0) return 100;

  const elapsedMs = now - created;
  return Math.min((elapsedMs / totalMs) * 100, 200);
}

function getBarColor(slaStatus: SLAIndicatorProps["slaStatus"]): string {
  switch (slaStatus) {
    case "WITHIN_SLA":
      return "bg-green-500";
    case "WARNING":
      return "bg-yellow-400";
    case "ESCALATED":
      return "bg-orange-500";
    case "REASSIGNED":
      return "bg-red-500";
    case "CRITICAL":
      return "bg-red-700";
    default:
      return "bg-gray-300";
  }
}

function getLabel(slaStatus: SLAIndicatorProps["slaStatus"], pct: number): string {
  switch (slaStatus) {
    case "WITHIN_SLA":
      return `On time · ${Math.round(pct)}% elapsed`;
    case "WARNING":
      return `Warning · ${Math.round(pct)}% elapsed`;
    case "ESCALATED":
      return `Overdue · escalated`;
    case "REASSIGNED":
      return `Overdue · reassigned`;
    case "CRITICAL":
      return `Critical · ${Math.round(pct - 100)}% overdue`;
    default:
      return "No SLA";
  }
}

/**
 * SLAIndicator — color-coded SLA progress bar.
 * Green (≤50%) → Yellow (50-100%) → Orange (100-150%) → Red/Dark-Red (≥150%).
 * Uses backend slaStatus as source of truth; only bar width computed client-side.
 */
export function SLAIndicator({ slaDeadline, createdAt, slaStatus }: SLAIndicatorProps) {
  if (!slaDeadline) {
    return <span className="text-xs text-gray-400">No SLA</span>;
  }

  const pct = computeSLAPercent(createdAt, slaDeadline);
  const barWidth = Math.min(pct, 100); // Cap bar at 100% width; colors signal overdue
  const colorClass = getBarColor(slaStatus);
  const label = getLabel(slaStatus, pct);

  return (
    <div className="w-full" title={label} aria-label={label}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium ${slaStatus === "WITHIN_SLA" ? "text-green-700" : slaStatus === "WARNING" ? "text-yellow-700" : "text-red-700"}`}>
          {label}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-2 rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
