"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useContracts, Contract } from "@procurement/hooks";
import { ContractExpiryCountdown, Button } from "@procurement/ui";
import {
  FileText,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Search,
  CheckCircle2,
  TrendingUp,
  FileSignature,
} from "lucide-react";

export default function SupplierContractsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expiryDaysFilter, setExpiryDaysFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: contracts = [], isLoading, isError } = useContracts({
    search: search || undefined,
    status: statusFilter || undefined,
    expiring_within_days: expiryDaysFilter,
    page,
    page_size: PAGE_SIZE,
  });

  const kpis = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((c) => c.status === "ACTIVE" || c.status === "AMENDED").length;
    const pendingEsign = contracts.filter((c) => c.status === "PENDING_ESIGN").length;
    const warning = contracts.filter(
      (c) => c.expiry_warning_level === "WARNING" || c.expiry_warning_level === "CRITICAL"
    ).length;
    return { total, active, pendingEsign, warning };
  }, [contracts]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ACTIVE":
      case "AMENDED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400";
      case "PENDING_ESIGN":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400";
      case "APPROVED":
      case "PENDING_REVIEW":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400";
      case "EXPIRED":
      case "TERMINATED":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400";
      case "DRAFT":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Contracts & Service Agreements
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review active procurement agreements, agreed rate cards, milestone obligations, and digital signature status.
          </p>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Agreements
            </span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {kpis.total}
          </div>
          <span className="text-xs text-slate-500">Awarded to your company</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Contracts
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {kpis.active}
          </div>
          <span className="text-xs text-emerald-600/80">Valid for PO creation</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pending eSign
            </span>
            <FileSignature className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {kpis.pendingEsign}
          </div>
          <span className="text-xs text-amber-600/80">Awaiting signatures</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Expiring &lt; 60 Days
            </span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-mono">
            {kpis.warning}
          </div>
          <span className="text-xs text-rose-600/80">Renewal notice window</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by contract number or title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full text-sm border border-slate-300 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 rounded-xl pl-9 pr-3.5 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_ESIGN">Pending eSign</option>
          <option value="APPROVED">Approved</option>
          <option value="AMENDED">Amended</option>
          <option value="EXPIRED">Expired</option>
          <option value="TERMINATED">Terminated</option>
        </select>

        <select
          value={expiryDaysFilter !== undefined ? String(expiryDaysFilter) : ""}
          onChange={(e) => {
            const val = e.target.value;
            setExpiryDaysFilter(val ? Number(val) : undefined);
            setPage(1);
          }}
          className="text-sm border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        >
          <option value="">All Validity Horizons</option>
          <option value="30">Expiring in 30 Days (Urgent)</option>
          <option value="60">Expiring in 60 Days (Renewal)</option>
          <option value="90">Expiring in 90 Days</option>
        </select>
      </div>

      {/* Contracts Table */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400 text-sm">
            <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Loading your contracts...
          </div>
        ) : isError ? (
          <div className="p-16 text-center text-rose-500 text-sm">
            Failed to load contracts. Please check your network connection.
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400 text-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            No contracts found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-[#252529] text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="px-6 py-3.5">Contract Details</th>
                  <th className="px-6 py-3.5">Agreement Type</th>
                  <th className="px-6 py-3.5">Total / Utilized Value</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Validity Horizon</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {contracts.map((c) => {
                  const totalVal = Number(c.total_value || 0);
                  const utilVal = Number(c.utilized_value || 0);
                  const utilPct = totalVal > 0 ? Math.min(100, Math.round((utilVal / totalVal) * 100)) : 0;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline block font-mono"
                        >
                          {c.contract_number}
                        </Link>
                        <div className="text-xs text-slate-800 dark:text-slate-200 font-medium truncate max-w-xs mt-0.5">
                          {c.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Period: {new Date(c.start_date).toLocaleDateString()} –{" "}
                          {new Date(c.end_date).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-[#252529] text-slate-700 dark:text-slate-300">
                          {c.contract_type.replace(/_/g, " ")}
                        </span>
                        {c.auto_renew && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Auto-renew enabled
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                          {c.currency} {totalVal.toLocaleString()}
                        </div>
                        {c.contract_type === "RATE_CONTRACT" && (
                          <div className="mt-1">
                            <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                              <span>Drawn: {utilPct}%</span>
                              <span className="font-mono">{c.currency} {utilVal.toLocaleString()}</span>
                            </div>
                            <div className="w-28 bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  utilPct > 90
                                    ? "bg-rose-500"
                                    : utilPct > 70
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                                style={{ width: `${utilPct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeClass(
                            c.status
                          )}`}
                        >
                          {c.status.replace(/_/g, " ")}
                        </span>
                        {c.esign_provider && (
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            {c.esign_provider}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <ContractExpiryCountdown
                          endDate={c.end_date}
                          warningLevel={c.expiry_warning_level ?? undefined}
                          daysRemaining={c.days_remaining}
                          compact
                        />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:underline"
                        >
                          View Details <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}