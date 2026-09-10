"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  FileSpreadsheet,
  Search,
  Filter,
  ArrowUpDown,
  FileWarning,
  Building2,
  DollarSign,
} from "lucide-react";
import {
  MaverickSpendData,
  MaverickPOItem,
  downloadAnalyticsExport,
} from "@procurement/hooks";

export interface MaverickSpendTableProps {
  data?: MaverickSpendData;
  isLoading?: boolean;
  currency?: string;
  className?: string;
}

export function MaverickSpendTable({
  data,
  isLoading = false,
  currency = "₹",
  className = "",
}: MaverickSpendTableProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const formatCurrency = (val: number) => {
    if (val >= 10_000_000) {
      return `${currency}${(val / 10_000_000).toFixed(2)}Cr`;
    }
    if (val >= 100_000) {
      return `${currency}${(val / 100_000).toFixed(1)}L`;
    }
    if (val >= 1_000) {
      return `${currency}${(val / 1_000).toFixed(1)}k`;
    }
    return `${currency}${val.toLocaleString()}`;
  };

  const totalPoSpend = data?.total_po_spend || 0;
  const maverickSpend = data?.maverick_spend || 0;
  const contractedSpend = data?.contracted_spend || 0;
  const sourcedSpend = data?.sourced_spend || 0;
  const leakageRate = data?.leakage_rate || 0;
  const totalPos = data?.total_po_count || 0;
  const maverickPos = data?.maverick_po_count || 0;
  const categories = data?.by_category || [];
  const uncontractedPos = data?.uncontracted_pos || [];

  // Filtered uncontracted POs
  const filteredPOs = useMemo(() => {
    return uncontractedPos.filter((po) => {
      const matchSearch =
        po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.category_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRisk = selectedRisk === "ALL" || po.risk_level === selectedRisk;
      return matchSearch && matchRisk;
    });
  }, [uncontractedPos, searchTerm, selectedRisk]);

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const rows = filteredPOs.map((p) => ({
        "PO Number": p.po_number,
        "Supplier": p.vendor_name,
        "Category": p.category_name,
        "Business Unit": p.bu_name,
        "Total Value": p.total_value,
        "Created At": p.created_at,
        "Risk Level": p.risk_level,
        "Compliance Reason": "Created without linked contract, RFQ, or formal PR",
      }));

      await downloadAnalyticsExport("csv", {
        filename: `maverick_spend_audit_${new Date().toISOString().split("T")[0]}.csv`,
        data: rows,
        report_type: "maverick_spend",
        sheet_name: "Maverick Spend",
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
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <p className="text-sm font-medium text-neutral-400">Auditing Maverick Spend Leakage...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Leakage KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Maverick Leakage Rate */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Spend Leakage Rate</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">{leakageRate}%</span>
            <span className="text-xs text-neutral-400">of total spend</span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {maverickPos} of {totalPos} POs off-contract
          </p>
        </div>

        {/* Total Maverick Spend */}
        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Maverick Spend</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <FileWarning className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-amber-400">{formatCurrency(maverickSpend)}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Uncontracted & non-tendered POs</p>
        </div>

        {/* Contracted Spend */}
        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Contracted Spend</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">{formatCurrency(contractedSpend)}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Secured via active master contracts</p>
        </div>

        {/* Sourced Tendered Spend */}
        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Sourced via RFQ</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">{formatCurrency(sourcedSpend)}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Competitively tendered or formal PR</p>
        </div>
      </div>

      {/* Category Maverick Risk Breakdown */}
      <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-white">Category Maverick Leakage Risk</h3>
            <p className="text-xs text-neutral-400">Off-contract spend exposure and risk distribution across procurement categories</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div key={c.category_name} className="rounded-xl border border-white/5 bg-[#252529] p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-white truncate">{c.category_name}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                    c.risk_level === "HIGH"
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : c.risk_level === "MEDIUM"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  }`}
                >
                  {c.risk_level} RISK
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xs text-neutral-400">Maverick Spend:</span>
                <span className="font-mono text-sm font-bold text-amber-400">{formatCurrency(c.maverick_spend)}</span>
              </div>

              <div className="mt-1 flex items-baseline justify-between text-xs text-neutral-400">
                <span>Leakage Rate:</span>
                <span className="font-mono font-semibold text-white">{c.leakage_rate}%</span>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className={`h-full ${
                    c.risk_level === "HIGH" ? "bg-red-500" : c.risk_level === "MEDIUM" ? "bg-amber-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min(c.leakage_rate, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Non-Compliant PO Audit Table */}
      <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-white">Uncontracted PO Audit Trail</h3>
            <p className="text-xs text-neutral-400">
              Showing {filteredPOs.length} purchase orders created without linked rate contracts or formal sourcing
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative w-56">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search PO, vendor, category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#252529] pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Risk filter */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#252529] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>

            {/* Export */}
            <button
              onClick={handleExportCSV}
              disabled={isExporting || filteredPOs.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#252529] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              {isExporting ? "Exporting..." : "Export Audit CSV"}
            </button>
          </div>
        </div>

        {/* Audit Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Business Unit</th>
                <th className="px-4 py-3">Total Value</th>
                <th className="px-4 py-3">Created Date</th>
                <th className="px-4 py-3">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-500 font-sans">
                    No uncontracted or maverick purchase orders found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => (
                  <tr key={po.po_id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold text-blue-400">{po.po_number}</td>
                    <td className="px-4 py-3 font-sans font-medium text-white">{po.vendor_name}</td>
                    <td className="px-4 py-3 font-sans text-neutral-300">{po.category_name}</td>
                    <td className="px-4 py-3 font-sans text-neutral-400">{po.bu_name}</td>
                    <td className="px-4 py-3 font-bold text-white">{formatCurrency(po.total_value)}</td>
                    <td className="px-4 py-3 text-neutral-400">
                      {new Date(po.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          po.risk_level === "HIGH"
                            ? "bg-red-500/20 text-red-300 border border-red-500/30"
                            : po.risk_level === "MEDIUM"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {po.risk_level}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
