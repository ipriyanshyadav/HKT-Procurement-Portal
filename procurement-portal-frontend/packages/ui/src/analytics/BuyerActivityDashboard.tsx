"use client";

import React, { useState } from "react";
import {
  useBuyerActivitySummary,
  useActivityHeatmap,
  useBuyerLeagueTable,
  useProcurementVelocity,
  useBottlenecks,
  useSessionSecurityAnalytics,
} from "@procurement/hooks";
import { ExportButton } from "../components/ExportButton";
import {
  Activity,
  Flame,
  Clock,
  TrendingUp,
  Award,
  AlertTriangle,
  ShieldCheck,
  Users,
  CheckCircle,
  FileCheck,
  HelpCircle,
  Loader2,
  Calendar,
} from "lucide-react";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function BuyerActivityDashboard() {
  const { data: summary, isLoading: summaryLoading } = useBuyerActivitySummary();
  const { data: heatmap, isLoading: heatmapLoading } = useActivityHeatmap();
  const { data: leagueTable = [], isLoading: leagueLoading } = useBuyerLeagueTable();
  const { data: velocity, isLoading: velocityLoading } = useProcurementVelocity();
  const { data: bottlenecks = [], isLoading: bottlenecksLoading } = useBottlenecks();
  const { data: security, isLoading: securityLoading } = useSessionSecurityAnalytics();

  const [activeTab, setActiveTab] = useState<"overview" | "heatmap" | "league" | "velocity" | "security">("overview");

  const isLoading = summaryLoading || heatmapLoading || leagueLoading || velocityLoading;

  // Build a lookup map for heatmap: key = `${day}_${hour}`
  const heatmapMap = new Map<string, number>();
  let maxCount = 1;
  if (heatmap?.matrix) {
    for (const pt of heatmap.matrix) {
      heatmapMap.set(`${pt.day_of_week}_${pt.hour_of_day}`, pt.count);
      if (pt.count > maxCount) maxCount = pt.count;
    }
  }

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-slate-100 hover:bg-slate-200";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "bg-blue-100 text-blue-800 hover:bg-blue-200";
    if (ratio < 0.5) return "bg-blue-300 text-blue-900 hover:bg-blue-400";
    if (ratio < 0.75) return "bg-blue-500 text-white hover:bg-blue-600";
    return "bg-blue-700 text-white hover:bg-blue-800";
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Activity className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Buyer Activity & Procurement Velocity
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time telemetry, 52-week activity heatmap, cycle times, and approval bottleneck diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportButton
            exportType="ANALYTICS_SPEND"
            label="Export Report"
            variant="outline"
            size="md"
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-sm font-medium">
        {[
          { id: "overview", label: "Overview & KPIs", icon: TrendingUp },
          { id: "heatmap", label: "Activity Heatmap (7×24)", icon: Flame },
          { id: "velocity", label: "Velocity & Bottlenecks", icon: Clock },
          { id: "league", label: "Buyer League Table", icon: Award },
          { id: "security", label: "Session Telemetry", icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`pb-3 flex items-center gap-2 transition-colors border-b-2 -mb-px ${
                isActive
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center space-x-3 text-blue-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="font-medium text-slate-700">Loading procurement activity analytics...</span>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                    <span>Total Actions</span>
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {summary?.total_actions?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Audit log operations</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                    <span>PRs Submitted</span>
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {summary?.prs_created?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Requisitions generated</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                    <span>POs Converted</span>
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {summary?.pos_processed?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Purchase orders issued</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                    <span>Tickets Raised</span>
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {summary?.tickets_raised?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Support / query tickets</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                    <span>Avg Turnaround</span>
                    <Clock className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {summary?.avg_turnaround_hours ? `${summary.avg_turnaround_hours.toFixed(1)}h` : "—"}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Average step completion</div>
                </div>
              </div>

              {/* Quick Heatmap preview & Velocity side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Heatmap summary pill */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-amber-500" />
                      <h3 className="font-semibold text-slate-900">Weekly Activity Peak</h3>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                      {heatmap?.total_actions ?? 0} logged actions
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Highest procurement concurrency happens on{" "}
                    <strong className="text-slate-800">{heatmap?.peak_day ?? "Monday"}</strong> at around{" "}
                    <strong className="text-slate-800">{heatmap?.peak_hour ?? 14}:00</strong>.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("heatmap")}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                    >
                      View 7×24 Full Matrix &rarr;
                    </button>
                  </div>
                </div>

                {/* Velocity summary pill */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      <h3 className="font-semibold text-slate-900">PR-to-PO Velocity</h3>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      Avg {velocity?.avg_cycle_days ? `${velocity.avg_cycle_days.toFixed(1)} days` : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Median end-to-end turnaround is{" "}
                    <strong className="text-slate-800">{velocity?.median_cycle_days ? `${velocity.median_cycle_days.toFixed(1)} days` : "—"}</strong>{" "}
                    from demand submission to vendor PO delivery.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("velocity")}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                    >
                      Inspect Cycle Time Histogram &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HEATMAP */}
          {activeTab === "heatmap" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">7×24 Hourly Activity Intensity Matrix</h3>
                  <p className="text-xs text-slate-500">
                    Audit log events grouped by day of week and hour of day.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Low</span>
                  <div className="flex gap-1">
                    <span className="w-3 h-3 rounded-sm bg-slate-100 inline-block" />
                    <span className="w-3 h-3 rounded-sm bg-blue-100 inline-block" />
                    <span className="w-3 h-3 rounded-sm bg-blue-300 inline-block" />
                    <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                    <span className="w-3 h-3 rounded-sm bg-blue-700 inline-block" />
                  </div>
                  <span>High</span>
                </div>
              </div>

              <div className="overflow-x-auto pb-2">
                <div className="min-w-[760px]">
                  {/* Hour labels */}
                  <div className="grid grid-cols-[60px_repeat(24,1fr)] gap-1 text-[10px] text-slate-400 text-center mb-1">
                    <div />
                    {HOURS.map((h) => (
                      <div key={h}>{h % 3 === 0 ? `${h}h` : ""}</div>
                    ))}
                  </div>

                  {/* Matrix rows */}
                  <div className="space-y-1">
                    {DAYS_OF_WEEK.map((dayName, dayIndex) => (
                      <div key={dayName} className="grid grid-cols-[60px_repeat(24,1fr)] gap-1 items-center">
                        <div className="text-xs font-semibold text-slate-600 text-right pr-2">
                          {dayName}
                        </div>
                        {HOURS.map((hour) => {
                          const count = heatmapMap.get(`${dayIndex}_${hour}`) || 0;
                          return (
                            <div
                              key={hour}
                              title={`${dayName} at ${hour}:00 — ${count} actions`}
                              className={`h-7 rounded-sm flex items-center justify-center text-[10px] cursor-pointer transition-colors ${getHeatmapColor(
                                count
                              )}`}
                            >
                              {count > 0 ? count : ""}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>
                    Busiest window: <strong>{heatmap?.peak_day}</strong> around <strong>{heatmap?.peak_hour}:00</strong>.
                  </span>
                </div>
                <span className="font-semibold text-slate-800">Total tracked: {heatmap?.total_actions ?? 0}</span>
              </div>
            </div>
          )}

          {/* TAB 3: VELOCITY & BOTTLENECKS */}
          {activeTab === "velocity" && (
            <div className="space-y-6">
              {/* Histogram */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">PR-to-PO Cycle Time Distribution</h3>
                    <p className="text-xs text-slate-500">
                      Distribution of total elapsed days from requisition creation to PO dispatch.
                    </p>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div>
                      <span className="text-slate-400">Average: </span>
                      <strong className="text-slate-800">{velocity?.avg_cycle_days?.toFixed(1) ?? 0} days</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Median: </span>
                      <strong className="text-slate-800">{velocity?.median_cycle_days?.toFixed(1) ?? 0} days</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {(velocity?.distribution || []).map((bucket) => (
                    <div key={bucket.bucket_label} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span className="font-medium">{bucket.bucket_label}</span>
                        <span>
                          {bucket.count} POs ({bucket.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(bucket.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {(velocity?.distribution || []).length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">
                      No cycle time samples recorded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Bottlenecks Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-slate-900">Approval Step Duration & Bottlenecks</h3>
                </div>
                <p className="text-xs text-slate-500">
                  Latency metrics across workflow steps identifying queues that exceed SLA thresholds.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Workflow Step</th>
                        <th className="px-4 py-3">Avg Duration</th>
                        <th className="px-4 py-3">Max Duration</th>
                        <th className="px-4 py-3">Delayed Tasks</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {bottlenecks.map((step) => {
                        const isHighLatency = step.avg_duration_hours > 24;
                        return (
                          <tr key={step.step_name} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-semibold text-slate-800">{step.step_name}</td>
                            <td className="px-4 py-3 text-slate-600">{step.avg_duration_hours.toFixed(1)} hrs</td>
                            <td className="px-4 py-3 text-slate-600">{step.max_duration_hours.toFixed(1)} hrs</td>
                            <td className="px-4 py-3 text-slate-700 font-medium">{step.delayed_count}</td>
                            <td className="px-4 py-3 text-right">
                              {isHighLatency ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  SLA Risk
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Healthy
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {bottlenecks.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-xs text-slate-400">
                            All approval steps operating within SLA baselines.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BUYER LEAGUE TABLE */}
          {activeTab === "league" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Buyer Performance League Table</h3>
                  <p className="text-xs text-slate-500">
                    Leaderboard ranked by operational output, PR approval throughput, and SLA compliance.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 w-16 text-center">Rank</th>
                      <th className="px-4 py-3">Buyer Name</th>
                      <th className="px-4 py-3">PRs Created</th>
                      <th className="px-4 py-3">PRs Approved</th>
                      <th className="px-4 py-3">Avg Turnaround</th>
                      <th className="px-4 py-3">Tickets</th>
                      <th className="px-4 py-3 text-right">SLA Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {leagueTable.map((row) => (
                      <tr key={row.buyer_id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold ${
                              row.rank === 1
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : row.rank === 2
                                ? "bg-slate-200 text-slate-700"
                                : row.rank === 3
                                ? "bg-amber-50 text-amber-700"
                                : "text-slate-500"
                            }`}
                          >
                            {row.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.buyer_name}</td>
                        <td className="px-4 py-3 text-slate-700">{row.prs_created}</td>
                        <td className="px-4 py-3 text-slate-700">{row.prs_approved}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.avg_approval_hours ? `${row.avg_approval_hours.toFixed(1)}h` : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.tickets_raised}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              row.sla_compliance_rate >= 90
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {row.sla_compliance_rate.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {leagueTable.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-xs text-slate-400">
                          No buyer performance data found for the current cycle.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY TELEMETRY */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                    <span>Active Users Today</span>
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {security?.active_users_today ?? 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Logged in within 24h</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                    <span>Dormant Users (30d)</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {security?.dormant_users_30d ?? 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">No session in 30 days</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                    <span>Concurrent Peak</span>
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {security?.concurrent_sessions_peak ?? 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Simultaneous portal tokens</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                    <span>Failed Login Attempts</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {security?.failed_login_attempts_today ?? 0}
                  </div>
                  <div className="text-xs text-emerald-600 mt-1">Zero brute force alerts</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
