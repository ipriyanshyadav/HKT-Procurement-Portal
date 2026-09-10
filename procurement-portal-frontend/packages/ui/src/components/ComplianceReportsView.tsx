"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Lock,
  FileText,
  UserX,
  Clock,
  Building2,
  DollarSign,
  Download,
  Calendar,
  CheckCircle,
} from "lucide-react";
import {
  ComplianceAuditData,
  downloadAnalyticsExport,
} from "@procurement/hooks";

export type ComplianceTab =
  | "emergency_rfq"
  | "single_vendor"
  | "force_approve"
  | "sod_violation";

export interface ComplianceReportsViewProps {
  data?: ComplianceAuditData;
  isLoading?: boolean;
  currency?: string;
  className?: string;
}

export function ComplianceReportsView({
  data,
  isLoading = false,
  currency = "₹",
  className = "",
}: ComplianceReportsViewProps) {
  const [activeTab, setActiveTab] = useState<ComplianceTab>("emergency_rfq");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const formatCurrency = (val: number) => {
    if (val >= 10_000_000) {
      return `${currency}${(val / 10_000_000).toFixed(2)}Cr`;
    }
    if (val >= 100_000) {
      return `${currency}${(val / 100_000).toFixed(1)}L`;
    }
    return `${currency}${val.toLocaleString()}`;
  };

  const emergencyRfqs = data?.emergency_rfqs || [];
  const singleVendorRfqs = data?.single_vendor_rfqs || [];
  const forceApproves = data?.force_approves || [];
  const sodViolations = data?.sod_violations || [];
  const summary = data?.summary;

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      let rows: any[] = [];
      let filename = "compliance_audit";

      if (activeTab === "emergency_rfq") {
        rows = emergencyRfqs.map((r) => ({
          "RFQ Number": r.rfq_number,
          "Title": r.title,
          "Category": r.category_name,
          "Business Unit": r.bu_name,
          "Estimated Value": r.estimated_value,
          "Justification": r.justification || "Emergency Procurement Window",
          "Published At": r.published_at,
          "Status": r.status,
        }));
        filename = "emergency_rfq_audit";
      } else if (activeTab === "single_vendor") {
        rows = singleVendorRfqs.map((r) => ({
          "RFQ Number": r.rfq_number,
          "Title": r.title,
          "Category": r.category_name,
          "Business Unit": r.bu_name,
          "Estimated Value": r.estimated_value,
          "Justification": r.single_vendor_justification || "Proprietary Sourcing",
          "Created At": r.created_at,
          "Status": r.status,
        }));
        filename = "single_vendor_justifications";
      } else if (activeTab === "force_approve") {
        rows = forceApproves.map((a) => ({
          "Entity Type": a.entity_type,
          "Entity ID": a.entity_id,
          "Actor Email": a.actor_email,
          "Action": a.action,
          "Reason": a.reason,
          "Timestamp": a.created_at,
        }));
        filename = "admin_force_approvals";
      } else {
        rows = sodViolations.map((v) => ({
          "Entity Type": v.entity_type,
          "Entity ID": v.entity_id,
          "Actor Email": v.actor_email,
          "Action": v.action,
          "Timestamp": v.created_at,
        }));
        filename = "sod_violations_audit";
      }

      await downloadAnalyticsExport("csv", {
        filename: `${filename}_${new Date().toISOString().split("T")[0]}.csv`,
        data: rows,
        report_type: "compliance_audit",
        sheet_name: "Audit Log",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-[#1C1C1F] p-8 shadow-sm ${className}`}>
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            <p className="text-sm font-medium text-neutral-400">Loading Compliance Audit Records...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* KPI Counters Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Emergency RFQs</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">
              {summary?.emergency_rfq_count || emergencyRfqs.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Fast-tracked 24-hour sourcing windows</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Single-Vendor RFQs</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">
              {summary?.single_vendor_count || singleVendorRfqs.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Sole-source / proprietary justifications</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Admin Force-Approvals</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">
              {summary?.force_approve_count || forceApproves.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Manual workflow bypass interventions</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">SoD Violations Blocked</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <Lock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">
              {summary?.sod_violation_count || sodViolations.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Maker-checker separation breaches</p>
        </div>
      </div>

      {/* Tabbed Compliance Log View */}
      <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-white">Compliance Audit Trail</h3>
            <p className="text-xs text-neutral-400">
              Auditable governance records mandated by SPEC 25 Section 7
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Subtabs */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#252529] p-1">
              <button
                onClick={() => setActiveTab("emergency_rfq")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === "emergency_rfq"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Emergency RFQs ({emergencyRfqs.length})
              </button>
              <button
                onClick={() => setActiveTab("single_vendor")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === "single_vendor"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Single Vendor ({singleVendorRfqs.length})
              </button>
              <button
                onClick={() => setActiveTab("force_approve")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === "force_approve"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Force Approvals ({forceApproves.length})
              </button>
              <button
                onClick={() => setActiveTab("sod_violation")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === "sod_violation"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                SoD Attempts ({sodViolations.length})
              </button>
            </div>

            {/* Export */}
            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#252529] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Tab 1: Emergency RFQs */}
        {activeTab === "emergency_rfq" && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="px-4 py-3">RFQ Number</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Business Unit</th>
                  <th className="px-4 py-3">Estimated Value</th>
                  <th className="px-4 py-3">Justification</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {emergencyRfqs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500 font-sans">
                      No emergency RFQs logged.
                    </td>
                  </tr>
                ) : (
                  emergencyRfqs.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-red-400">{r.rfq_number}</td>
                      <td className="px-4 py-3 font-sans font-medium text-white">{r.title}</td>
                      <td className="px-4 py-3 font-sans text-neutral-300">{r.category_name}</td>
                      <td className="px-4 py-3 font-sans text-neutral-400">{r.bu_name}</td>
                      <td className="px-4 py-3 font-bold text-white">{formatCurrency(r.estimated_value)}</td>
                      <td className="px-4 py-3 font-sans text-neutral-300 max-w-xs truncate">
                        {r.justification || "Emergency procurement window"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-500/30">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Single-Vendor RFQs */}
        {activeTab === "single_vendor" && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="px-4 py-3">RFQ Number</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Business Unit</th>
                  <th className="px-4 py-3">Estimated Value</th>
                  <th className="px-4 py-3">Sole Source Justification</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {singleVendorRfqs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500 font-sans">
                      No single-vendor RFQs logged.
                    </td>
                  </tr>
                ) : (
                  singleVendorRfqs.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-amber-400">{r.rfq_number}</td>
                      <td className="px-4 py-3 font-sans font-medium text-white">{r.title}</td>
                      <td className="px-4 py-3 font-sans text-neutral-300">{r.category_name}</td>
                      <td className="px-4 py-3 font-sans text-neutral-400">{r.bu_name}</td>
                      <td className="px-4 py-3 font-bold text-white">{formatCurrency(r.estimated_value)}</td>
                      <td className="px-4 py-3 font-sans text-neutral-300 max-w-xs truncate">
                        {r.single_vendor_justification || "Proprietary distributor"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Admin Force-Approvals */}
        {activeTab === "force_approve" && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Entity Type</th>
                  <th className="px-4 py-3">Entity ID</th>
                  <th className="px-4 py-3">Actor Email</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {forceApproves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-500 font-sans">
                      No admin force-approvals logged.
                    </td>
                  </tr>
                ) : (
                  forceApproves.map((a) => (
                    <tr key={a.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-neutral-400">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-purple-400">{a.entity_type}</td>
                      <td className="px-4 py-3 text-neutral-400 font-mono text-[10px]">
                        {a.entity_id}
                      </td>
                      <td className="px-4 py-3 font-sans text-white">{a.actor_email || "admin@system"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/30">
                          {a.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-neutral-300 max-w-xs truncate">
                        {a.reason || "Manual workflow intervention"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: SoD Violations */}
        {activeTab === "sod_violation" && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Entity Type</th>
                  <th className="px-4 py-3">Entity ID</th>
                  <th className="px-4 py-3">Actor Email</th>
                  <th className="px-4 py-3">Violation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {sodViolations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500 font-sans">
                      No Segregation-of-Duties violations recorded.
                    </td>
                  </tr>
                ) : (
                  sodViolations.map((v) => (
                    <tr key={v.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-neutral-400">
                        {new Date(v.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-blue-400">{v.entity_type}</td>
                      <td className="px-4 py-3 text-neutral-400 font-mono text-[10px]">
                        {v.entity_id}
                      </td>
                      <td className="px-4 py-3 font-sans text-white">{v.actor_email || "user@system"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-500/30">
                          {v.action}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
