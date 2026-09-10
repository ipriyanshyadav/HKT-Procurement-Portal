"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useContracts, Contract } from "@procurement/hooks";
import { ContractExpiryCountdown } from "@procurement/ui";
import {
  FileText,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

export default function ContractsListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expiryDaysFilter, setExpiryDaysFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: contracts = [], isLoading, isError, refetch } = useContracts({
    search: search || undefined,
    status: statusFilter || undefined,
    expiring_within_days: expiryDaysFilter,
    page,
    page_size: PAGE_SIZE,
  });

  // Calculate high-level summary KPIs
  const kpis = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((c) => c.status === "ACTIVE" || c.status === "AMENDED").length;
    const critical = contracts.filter(
      (c) => c.expiry_warning_level === "CRITICAL" || c.expiry_warning_level === "EXPIRED"
    ).length;
    const warning = contracts.filter((c) => c.expiry_warning_level === "WARNING").length;
    return { total, active, critical, warning };
  }, [contracts]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ACTIVE":
      case "AMENDED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400";
      case "PENDING_ESIGN":
      case "PENDING_REVIEW":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400";
      case "APPROVED":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400";
      case "EXPIRED":
      case "TERMINATED":
      case "TERMINATION_NOTICE":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400";
      case "DRAFT":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Contracts & Agreements
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise contract lifecycle management, digital signatures, milestones, and rate contract utilization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/contracts/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            New Contract
          </Link>
          <Link
            href="/rfqs"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            Award from RFQ
          </Link>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Contracts
            </span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {kpis.total}
          </div>
          <span className="text-xs text-slate-500">Across all business units</span>
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
          <span className="text-xs text-emerald-600/80">Valid & executing</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Expiring &lt; 60 Days
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {kpis.warning}
          </div>
          <span className="text-xs text-amber-600/80">Renewal notice period</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Critical / Expired
            </span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2 font-mono">
            {kpis.critical}
          </div>
          <span className="text-xs text-red-600/80">Requires urgent action</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by contract number, title, or vendor..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full text-sm border border-slate-300 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 rounded-xl pl-9 pr-3.5 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING_ESIGN">Pending eSign</option>
          <option value="ACTIVE">Active</option>
          <option value="AMENDED">Amended</option>
          <option value="EXPIRED">Expired</option>
          <option value="TERMINATED">Terminated</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={expiryDaysFilter !== undefined ? String(expiryDaysFilter) : ""}
          onChange={(e) => {
            const val = e.target.value;
            setExpiryDaysFilter(val ? Number(val) : undefined);
            setPage(1);
          }}
          className="text-sm border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">All Validity Horizons</option>
          <option value="30">Expiring in 30 Days (Critical)</option>
          <option value="60">Expiring in 60 Days (Warning)</option>
          <option value="90">Expiring in 90 Days</option>
        </select>
      </div>

      {/* Contracts Table */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400 text-sm">
            <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Loading contracts...
          </div>
        ) : isError ? (
          <div className="p-16 text-center text-red-500 text-sm">
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
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Total / Utilized Value</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Expiry Horizon</th>
                  <th className="px-6 py-3.5 text-right">Workspace</th>
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
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline block"
                        >
                          {c.contract_number}
                        </Link>
                        <div className="text-xs text-slate-700 dark:text-slate-200 font-medium truncate max-w-xs">
                          {c.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Period: {new Date(c.start_date).toLocaleDateString()} –{" "}
                          {new Date(c.end_date).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {c.contract_type.replace(/_/g, " ")}
                        </span>
                        {c.auto_renew && (
                          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Auto-renew enabled
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {c.currency} {totalVal.toLocaleString()}
                        </div>
                        {c.contract_type === "RATE_CONTRACT" && (
                          <div className="mt-1">
                            <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                              <span>Utilized: {utilPct}%</span>
                              <span>{c.currency} {utilVal.toLocaleString()}</span>
                            </div>
                            <div className="w-28 bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  utilPct > 90
                                    ? "bg-red-500"
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
                            <ShieldCheck className="w-3 h-3 text-indigo-500" />
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
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline"
                        >
                          Workspace <ArrowRight className="w-3.5 h-3.5" />
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
