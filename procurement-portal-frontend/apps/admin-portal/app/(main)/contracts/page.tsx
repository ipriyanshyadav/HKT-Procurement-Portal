"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useContracts, Contract } from "@procurement/hooks";
import { ContractExpiryCountdown, PageHeader, Button } from "@procurement/ui";
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
  Building2,
  Calendar,
  Layers,
  Filter,
} from "lucide-react";

export default function AdminContractsListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expiryDaysFilter, setExpiryDaysFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const { data: contracts = [], isLoading, isError } = useContracts({
    search: search || undefined,
    status: statusFilter || undefined,
    expiring_within_days: expiryDaysFilter,
    page,
    page_size: PAGE_SIZE,
  });

  // High-level summary KPIs
  const kpis = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((c) => c.status === "ACTIVE" || c.status === "AMENDED").length;
    const critical = contracts.filter(
      (c) => c.expiry_warning_level === "CRITICAL" || c.expiry_warning_level === "EXPIRED"
    ).length;
    const warning = contracts.filter((c) => c.expiry_warning_level === "WARNING").length;
    const totalValue = contracts.reduce((acc, c) => acc + Number(c.total_value || 0), 0);
    return { total, active, critical, warning, totalValue };
  }, [contracts]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ACTIVE":
      case "AMENDED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800";
      case "PENDING_ESIGN":
      case "PENDING_REVIEW":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800";
      case "APPROVED":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
      case "EXPIRED":
      case "TERMINATED":
      case "TERMINATION_NOTICE":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800";
      case "DRAFT":
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700";
    }
  };

  const formatCurrency = (val: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Contracts & Agreements"
        subtitle="Enterprise contract governance, terms compliance, rate contracts, and milestone tracking."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/analytics">
              <Button variant="secondary" size="sm" leftIcon={<TrendingUp className="w-4 h-4 text-indigo-500" />}>
                Spend Analytics
              </Button>
            </Link>
            <Link href="/vendors">
              <Button variant="secondary" size="sm" leftIcon={<Building2 className="w-4 h-4 text-blue-500" />}>
                Supplier Registry
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Total Contracts
            </span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2 font-mono">
            {kpis.total}
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatCurrency(kpis.totalValue)} committed
          </span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Active Contracts
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {kpis.active}
          </div>
          <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Valid & executing</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Expiring &lt; 60 Days
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {kpis.warning}
          </div>
          <span className="text-xs text-amber-600/80 dark:text-amber-400/80">Renewal notice period</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Critical / Expired
            </span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2 font-mono">
            {kpis.critical}
          </div>
          <span className="text-xs text-red-600/80 dark:text-red-400/80">Requires governance review</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by contract number, title, or vendor..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl pl-9 pr-3.5 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
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
          className="text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
        >
          <option value="">All Validity Horizons</option>
          <option value="30">Expiring in 30 Days (Critical)</option>
          <option value="60">Expiring in 60 Days (Warning)</option>
          <option value="90">Expiring in 90 Days</option>
        </select>
      </div>

      {/* Contracts Table */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600 dark:text-indigo-400" />
            Loading enterprise contracts...
          </div>
        ) : isError ? (
          <div className="p-16 text-center text-red-500 dark:text-red-400 text-sm">
            Failed to load contracts. Please check your network connection.
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-16 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
            No contracts found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-xs uppercase font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-6 py-3.5">Contract Details</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Total / Utilized Value</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Expiry Horizon</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {contracts.map((c) => {
                  const totalVal = Number(c.total_value || 0);
                  const utilVal = Number(c.utilized_value || 0);
                  const utilPct = totalVal > 0 ? Math.min(100, Math.round((utilVal / totalVal) * 100)) : 0;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline block"
                        >
                          {c.contract_number}
                        </Link>
                        <div className="text-xs text-neutral-900 dark:text-neutral-100 font-medium truncate max-w-xs">
                          {c.title}
                        </div>
                        <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                          Period: {new Date(c.start_date).toLocaleDateString()} –{" "}
                          {new Date(c.end_date).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                          {c.contract_type?.replace(/_/g, " ") || "GENERAL"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100 font-mono text-xs">
                          {formatCurrency(totalVal, c.currency)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 bg-neutral-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                utilPct > 90
                                  ? "bg-red-500"
                                  : utilPct > 70
                                  ? "bg-amber-500"
                                  : "bg-indigo-600 dark:bg-indigo-400"
                              }`}
                              style={{ width: `${utilPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                            {utilPct}%
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5">
                          Spent: {formatCurrency(utilVal, c.currency)}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(
                            c.status
                          )}`}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <ContractExpiryCountdown
                          endDate={c.end_date}
                          warningLevel={c.expiry_warning_level ?? undefined}
                          daysRemaining={c.days_remaining}
                        />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link href={`/contracts/${c.id}`}>
                          <Button
                            variant="secondary"
                            size="sm"
                            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          >
                            Manage
                          </Button>
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
