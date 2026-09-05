"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useInvoices } from "@procurement/hooks";
import type { InvoiceResponse } from "@procurement/types";
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
  Building,
  ArrowRight,
  CreditCard,
} from "lucide-react";

export default function SupplierInvoicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: invoices = [], isLoading, isError } = useInvoices({
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const kpis = useMemo(() => {
    const total = invoices.length;
    const submitted = invoices.filter(
      (inv) => inv.status === "SUBMITTED" || inv.status === "PENDING_APPROVAL"
    ).length;
    const approved = invoices.filter((inv) => inv.status === "APPROVED").length;
    const paid = invoices.filter(
      (inv) => inv.payment_status === "COMPLETED" || inv.payment_status === "PAID"
    ).length;
    const disputed = invoices.filter(
      (inv) => inv.status === "DISPUTED" || inv.match_status === "DISCREPANCY"
    ).length;
    return { total, submitted, approved, paid, disputed };
  }, [invoices]);

  const getMatchBadge = (matchStatus: string) => {
    switch (matchStatus?.toUpperCase()) {
      case "MATCHED":
      case "FULL_MATCH":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
            3-Way Matched
          </span>
        );
      case "PARTIAL_MATCH":
      case "PARTIALLY_MATCHED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />
            Partial Match
          </span>
        );
      case "DISCREPANCY":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600 dark:text-rose-400" />
            Discrepancy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            Under Review
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
      case "PAID":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
            Settled / Paid
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <Calendar className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400" />
            Scheduled
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
            Processing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            Pending
          </span>
        );
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
            Tax Invoices & Payments
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Submit invoices against delivered purchase orders and track settlement status & UTR details.
          </p>
        </div>

        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Submit New Invoice
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Submitted</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{kpis.total}</p>
        </div>
        <div className="bg-blue-50/50 dark:bg-blue-950/30 backdrop-blur-md p-4 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">Under Review</span>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-1">{kpis.submitted}</p>
        </div>
        <div className="bg-emerald-50/50 dark:bg-emerald-950/30 backdrop-blur-md p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Approved</span>
          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">{kpis.approved}</p>
        </div>
        <div className="bg-purple-50/50 dark:bg-purple-950/30 backdrop-blur-md p-4 rounded-2xl border border-purple-200/80 dark:border-purple-800/60 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">Settled / Paid</span>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-200 mt-1">{kpis.paid}</p>
        </div>
        <div className="bg-rose-50/50 dark:bg-rose-950/30 backdrop-blur-md p-4 rounded-2xl border border-rose-200/80 dark:border-rose-800/60 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">Disputed</span>
          <p className="text-2xl font-bold text-rose-900 dark:text-rose-200 mt-1">{kpis.disputed}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="PAID">Paid</option>
          <option value="DISPUTED">Disputed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading your invoices...</div>
        ) : isError ? (
          <div className="py-16 text-center text-rose-500">Failed to load invoices.</div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <Receipt className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-slate-500 dark:text-slate-400">No invoices submitted yet.</p>
            <Link
              href="/invoices/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Invoice
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left">Invoice Ref</th>
                  <th className="px-3 py-3.5 text-left">Your Invoice # / FY</th>
                  <th className="px-3 py-3.5 text-left">PO Reference</th>
                  <th className="px-3 py-3.5 text-right">Invoiced Gross</th>
                  <th className="px-3 py-3.5 text-center">3-Way Match</th>
                  <th className="px-3 py-3.5 text-center">Payment Status</th>
                  <th className="px-3 py-3.5 text-left">Payment Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {invoices.map((inv: InvoiceResponse) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 pl-4 pr-3 font-semibold text-slate-900 dark:text-white">
                      {inv.invoice_number}
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                        {inv.invoice_date}
                      </div>
                    </td>

                    <td className="px-3 py-3.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{inv.vendor_invoice_number}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{inv.financial_year || "—"}</div>
                    </td>

                    <td className="px-3 py-3.5">
                      <div className="font-medium text-indigo-600 dark:text-indigo-400">
                        {inv.po_number || inv.po_id.slice(0, 8)}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(inv.total_amount, inv.currency)}
                    </td>

                    <td className="px-3 py-3.5 text-center">
                      {getMatchBadge(inv.match_status)}
                    </td>

                    <td className="px-3 py-3.5 text-center">
                      {getPaymentStatusBadge(inv.payment_status)}
                    </td>

                    <td className="px-3 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      {inv.due_date}
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
