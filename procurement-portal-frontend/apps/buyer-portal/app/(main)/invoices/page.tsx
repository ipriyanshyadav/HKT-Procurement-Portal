"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useInvoices } from "@procurement/hooks";
import type { InvoiceResponse } from "@procurement/types";
import {
  FileText,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Search,
  CheckCircle2,
  Receipt,
  DollarSign,
  AlertCircle,
} from "lucide-react";

export default function InvoicesListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: invoices = [], isLoading, isError, refetch } = useInvoices({
    search: search || undefined,
    status: statusFilter || undefined,
    match_status: matchFilter || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const kpis = useMemo(() => {
    const total = invoices.length;
    const fullMatch = invoices.filter(
      (inv) => inv.match_status === "MATCHED" || inv.match_status === "FULL_MATCH"
    ).length;
    const pendingApproval = invoices.filter(
      (inv) => inv.status === "PENDING_APPROVAL" || inv.status === "SUBMITTED"
    ).length;
    const discrepancies = invoices.filter(
      (inv) => inv.match_status === "DISCREPANCY" || inv.status === "DISPUTED"
    ).length;
    const paid = invoices.filter(
      (inv) => inv.payment_status === "COMPLETED" || inv.payment_status === "PAID"
    ).length;
    return { total, fullMatch, pendingApproval, discrepancies, paid };
  }, [invoices]);

  const getMatchBadge = (matchStatus: string) => {
    switch (matchStatus?.toUpperCase()) {
      case "MATCHED":
      case "FULL_MATCH":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
            Matched
          </span>
        );
      case "PARTIAL_MATCH":
      case "PARTIALLY_MATCHED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />
            Partial Match
          </span>
        );
      case "DISCREPANCY":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600 dark:text-rose-400" />
            Discrepancy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Not Matched
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "APPROVED":
        return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "PENDING_APPROVAL":
        return "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "SUBMITTED":
        return "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      case "DISPUTED":
        return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "PAID":
        return "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-800";
      case "CANCELLED":
        return "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
      case "PAID":
        return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "SCHEDULED":
        return "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800";
      case "PROCESSING":
        return "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700";
    }
  };

  const formatCurrency = (val: string | number | undefined | null, curr = "INR") => {
    if (val === undefined || val === null) return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "—" : `${curr} ${num.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Receipt className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Invoices & Reconciliations
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automated 3-way matching across POs, GRN acceptance, and invoice approval workflows.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Invoices</span>
            <Receipt className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{kpis.total}</p>
        </div>

        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 backdrop-blur-md p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">3-Way Matched</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-2">{kpis.fullMatch}</p>
        </div>

        <div className="bg-blue-50/50 dark:bg-blue-950/20 backdrop-blur-md p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">Pending Approval</span>
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-2">{kpis.pendingApproval}</p>
        </div>

        <div className="bg-rose-50/50 dark:bg-rose-950/20 backdrop-blur-md p-4 rounded-2xl border border-rose-200/80 dark:border-rose-900/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">Discrepancies</span>
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-900 dark:text-rose-200 mt-2">{kpis.discrepancies}</p>
        </div>

        <div className="bg-purple-50/50 dark:bg-purple-950/20 backdrop-blur-md p-4 rounded-2xl border border-purple-200/80 dark:border-purple-900/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">Paid / Settled</span>
            <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-200 mt-2">{kpis.paid}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice or vendor inv #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Match Statuses</option>
            <option value="MATCHED">Matched</option>
            <option value="PARTIAL_MATCH">Partial Match</option>
            <option value="DISCREPANCY">Discrepancy</option>
            <option value="NOT_MATCHED">Not Matched</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Workflow Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="DISPUTED">Disputed</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading invoices...</div>
        ) : isError ? (
          <div className="py-16 text-center text-rose-500">Failed to load invoices.</div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Receipt className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            No invoices found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left">Invoice Number</th>
                  <th className="px-3 py-3.5 text-left">Vendor Inv # / FY</th>
                  <th className="px-3 py-3.5 text-left">Vendor / PO</th>
                  <th className="px-3 py-3.5 text-right">Total Amount</th>
                  <th className="px-3 py-3.5 text-center">3-Way Match</th>
                  <th className="px-3 py-3.5 text-center">Invoice Status</th>
                  <th className="px-3 py-3.5 text-center">Payment Status</th>
                  <th className="px-3 py-3.5 text-left">Due Date</th>
                  <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {invoices.map((inv: InvoiceResponse) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 pl-4 pr-3">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        {inv.invoice_number}
                      </Link>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {inv.invoice_date}
                      </div>
                    </td>

                    <td className="px-3 py-3.5">
                      <div className="font-medium text-slate-900 dark:text-white">{inv.vendor_invoice_number}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{inv.financial_year || "—"}</div>
                    </td>

                    <td className="px-3 py-3.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                        {inv.vendor_name || "Vendor"}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">PO: {inv.po_number || inv.po_id.slice(0, 8)}</div>
                    </td>

                    <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(inv.total_amount, inv.currency)}
                    </td>

                    <td className="px-3 py-3.5 text-center">
                      {getMatchBadge(inv.match_status)}
                    </td>

                    <td className="px-3 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                          inv.status
                        )}`}
                      >
                        {inv.status}
                      </span>
                    </td>

                    <td className="px-3 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getPaymentStatusBadge(
                          inv.payment_status
                        )}`}
                      >
                        {inv.payment_status}
                      </span>
                    </td>

                    <td className="px-3 py-3.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {inv.due_date}
                    </td>

                    <td className="py-3.5 pl-3 pr-4 text-right">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                      >
                        Details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
