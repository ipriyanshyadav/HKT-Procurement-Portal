"use client";

import React, { useState } from "react";
import {
  useSuperadminOverview,
  useSuperadminOrgPerformance,
  useSuperadminOrgDetail,
} from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  FileSpreadsheet,
  Package,
  FileCheck,
  ShieldAlert,
  Loader2,
  Search,
  Globe,
  ExternalLink,
  X,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

export default function SuperadminCrossCompanyReportPage() {
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions) || [];
  const isSuperadmin = Boolean(
    user?.role_names?.includes("SUPERADMIN") ||
      permissions.includes("admin.manage_system") ||
      permissions.includes("report.cross_company") ||
      permissions.includes("*")
  );

  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: overview, isLoading: isOverviewLoading } = useSuperadminOverview();
  const { data: orgs, isLoading: isOrgsLoading } = useSuperadminOrgPerformance(1, 50);
  const { data: orgDetail, isLoading: isDetailLoading } = useSuperadminOrgDetail(selectedOrgId || undefined);

  if (!isSuperadmin) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-red-600 mx-auto" />
        <h2 className="text-xl font-bold text-red-900 dark:text-red-200">Platform Admin Required</h2>
        <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
          Cross-Company multi-tenant reporting aggregates sensitive financial and transaction data across all tenants. Only Platform Administrators and Universal SuperAdmins have access to this workbench.
        </p>
      </div>
    );
  }

  const filteredOrgs = (orgs || []).filter((o) =>
    o.org_name.toLowerCase().includes(search.toLowerCase()) || o.org_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Platform Telemetry & Governance (SPEC_27-C)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Cross-Company SuperAdmin Reports</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Real-time multi-tenant telemetry, cross-organization transaction volume, and operational SLA benchmarking across all onboarded enterprises.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/40 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-200">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Universal Tenant Scope</span>
        </div>
      </div>

      {/* KPI Tiles */}
      {isOverviewLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500">Total Enterprises</span>
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              {overview.total_organizations}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {overview.active_organizations} Active Tenants
            </span>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500">Gross GMV Transacted</span>
              <CreditCard className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              ₹{Number(overview.total_gmv_inr || 0).toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +{overview.mom_growth_percent}% MoM Growth
            </span>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500">Procurement Volume</span>
              <FileSpreadsheet className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              {overview.total_pos} POs
            </div>
            <span className="text-[11px] text-neutral-500 font-medium mt-1">
              from {overview.total_prs} Requisitions
            </span>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500">Connected Network</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              {overview.total_vendors} Vendors
            </div>
            <span className="text-[11px] text-neutral-500 font-medium mt-1">
              across {overview.total_users} Active Users
            </span>
          </div>
        </div>
      ) : null}

      {/* Multi-Tenant Comparative Benchmarking Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">Tenant Performance Directory</h2>
            <p className="text-xs text-neutral-500">Benchmarked operational health and spend metrics per tenant</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by company or org ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 pl-9 pr-3 py-2 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        {isOrgsLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3 text-right">Users</th>
                  <th className="px-4 py-3 text-right">Vendors</th>
                  <th className="px-4 py-3 text-right">PRs / POs</th>
                  <th className="px-4 py-3 text-right">Spend (MTD)</th>
                  <th className="px-4 py-3 text-right">SLA Score</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                {filteredOrgs.map((org) => (
                  <tr key={org.org_id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-neutral-900 dark:text-white">{org.org_name}</div>
                      <div className="text-[10px] font-mono text-neutral-400">{org.org_id}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-neutral-700 dark:text-neutral-300">
                      {org.user_count}
                    </td>
                    <td className="px-4 py-3.5 text-right text-neutral-700 dark:text-neutral-300">
                      {org.vendor_count}
                    </td>
                    <td className="px-4 py-3.5 text-right text-neutral-700 dark:text-neutral-300">
                      <span>{org.prs_count}</span>
                      <span className="text-neutral-400 mx-1">/</span>
                      <span className="font-semibold">{org.pos_count}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-neutral-900 dark:text-white">
                      ₹{Number(org.spend_mtd_inr || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded text-[11px]">
                        {org.avg_sla_compliance_percent}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {org.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedOrgId(org.org_id)}
                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                        title="View Org Telemetry Detail"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredOrgs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-neutral-400">
                      No tenant organizations matched the query filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drill-down Detail Modal */}
      {selectedOrgId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Tenant Telemetry</span>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {orgDetail?.org_name || "Organization Detail"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrgId(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isDetailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : orgDetail ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700">
                    <span className="text-neutral-400">Legal Entities</span>
                    <p className="text-base font-bold text-neutral-900 dark:text-white mt-0.5">
                      {orgDetail.legal_entities_count}
                    </p>
                  </div>
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700">
                    <span className="text-neutral-400">Business Units</span>
                    <p className="text-base font-bold text-neutral-900 dark:text-white mt-0.5">
                      {orgDetail.business_units_count}
                    </p>
                  </div>
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700">
                    <span className="text-neutral-400">Active Users</span>
                    <p className="text-base font-bold text-neutral-900 dark:text-white mt-0.5">
                      {orgDetail.active_users}
                    </p>
                  </div>
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700">
                    <span className="text-neutral-400">Active Vendors</span>
                    <p className="text-base font-bold text-neutral-900 dark:text-white mt-0.5">
                      {orgDetail.active_vendors}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Lifetime Gross Spend</span>
                    <span className="font-bold text-neutral-900 dark:text-white">
                      ₹{Number(orgDetail.total_spend_inr || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Open Tickets & Discrepancies</span>
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                      {orgDetail.open_tickets_count}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Last Telemetry Activity</span>
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {orgDetail.last_activity_at
                        ? new Date(orgDetail.last_activity_at).toLocaleString()
                        : "No recent activity"}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrgId(null)}
                    className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-lg text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
