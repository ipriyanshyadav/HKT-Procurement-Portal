"use client";

import React from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  LifeBuoy,
  Percent,
  TrendingUp,
} from "lucide-react";
import { useTicketDashboard } from "@procurement/hooks";

export default function AdminTicketDashboardPage() {
  const { data: metrics, isLoading } = useTicketDashboard();

  if (isLoading) {
    return <div className="p-12 text-center text-sm text-slate-400">Loading metrics...</div>;
  }

  const total = metrics?.total_tickets ?? 0;
  const open = metrics?.open_tickets ?? 0;
  const inProgress = metrics?.in_progress_tickets ?? 0;
  const pending = metrics?.pending_response_tickets ?? 0;
  const resolved = metrics?.resolved_tickets ?? 0;
  const closed = metrics?.closed_tickets ?? 0;
  const breached = metrics?.breached_tickets ?? 0;
  const compliance = metrics?.sla_compliance_percentage ?? 100;
  const avgResolutionHours = metrics?.avg_resolution_hours ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tickets</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <span>Ticket Operations &amp; SLA Dashboard</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time analytics on ticket volume, resolution throughput, and SLA compliance.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Total Tickets</span>
            <LifeBuoy className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{total}</p>
          <span className="text-xs text-slate-400">All recorded inquiries</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Active / Open</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{open + inProgress + pending}</p>
          <span className="text-xs text-slate-400">{open} new, {inProgress} in progress</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>SLA Compliance</span>
            <Percent className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{Math.round(compliance)}%</p>
          <span className="text-xs text-slate-400">Within target SLAs</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-rose-700 text-xs font-semibold uppercase">
            <span>SLA Breaches</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-700">{breached}</p>
          <span className="text-xs text-rose-600 font-medium">Require immediate review</span>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Status Breakdown
          </h3>
          <div className="space-y-3">
            {[
              { label: "Open", count: open, color: "bg-blue-500" },
              { label: "In Progress", count: inProgress, color: "bg-indigo-500" },
              { label: "Pending Response", count: pending, color: "bg-amber-500" },
              { label: "Resolved", count: resolved, color: "bg-emerald-500" },
              { label: "Closed", count: closed, color: "bg-slate-400" },
            ].map((item) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-700">{item.label}</span>
                    <span className="text-slate-500">{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational Efficiency */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Resolution Performance
          </h3>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <span className="text-xs text-slate-500 block">Average Time to Resolution</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">
                {avgResolutionHours.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-500">hours</span>
            </div>
            <p className="text-xs text-slate-400">
              Calculated across all resolved and closed inquiries.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600">Need SLA adjustments?</span>
            <Link
              href="/tickets/sla-config"
              className="font-semibold text-blue-600 hover:text-blue-800"
            >
              Edit SLA Policies →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
