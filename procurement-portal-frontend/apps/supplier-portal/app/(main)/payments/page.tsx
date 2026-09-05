"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { usePayments } from "@procurement/hooks";
import type { PaymentRecordResponse } from "@procurement/types";
import {
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Building,
  Receipt,
  ArrowUpRight,
  ShieldCheck,
  DollarSign,
  Info,
  Calendar,
} from "lucide-react";

export default function SupplierPaymentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  const { data: payments = [], isLoading, isError, refetch } = usePayments({
    status: statusFilter || undefined,
  });

  // Client-side search
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        (p.utr_number && p.utr_number.toLowerCase().includes(q)) ||
        (p.invoice_number && p.invoice_number.toLowerCase().includes(q)) ||
        (p.erp_payment_reference && p.erp_payment_reference.toLowerCase().includes(q))
      );
    });
  }, [payments, search]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    let totalCredited = 0;
    let scheduledInflow = 0;
    let totalTdsWithheld = 0;
    let settledCount = 0;

    for (const p of payments) {
      const net = Number(p.net_amount || p.amount || 0);
      const tds = Number(p.tds_amount || 0);
      totalTdsWithheld += tds;

      if (p.status === "COMPLETED" || p.status === "PAID") {
        totalCredited += net;
        settledCount++;
      } else if (p.status === "SCHEDULED" || p.status === "PROCESSING") {
        scheduledInflow += net;
      }
    }

    return {
      totalCredited,
      scheduledInflow,
      totalTdsWithheld,
      settledCount,
      totalCount: payments.length,
    };
  }, [payments]);

  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const formatCurrency = (val: string | number | undefined | null, curr = "INR") => {
    if (val === undefined || val === null) return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "—" : `${curr} ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
      case "PAID":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Remittance Settled
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Calendar className="w-3.5 h-3.5 mr-1 text-blue-600" />
            Scheduled Inflow
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Bank Processing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <CreditCard className="h-6 w-6 text-emerald-600" />
            Inward Payments & Remittances
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track bank remittances, UTR transaction references, and statutory TDS deduction credits.
          </p>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Credited to Account</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-2">
            ₹{kpis.totalCredited.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <span className="text-xs text-emerald-700 mt-0.5 block">{kpis.settledCount} settled remittances</span>
        </div>

        <div className="bg-sky-50/50 backdrop-blur-md p-4 rounded-2xl border border-sky-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">Scheduled Inflow</span>
            <Clock className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-sky-900 mt-2">
            ₹{kpis.scheduledInflow.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <span className="text-xs text-sky-600 mt-0.5 block">Approved & awaiting payout</span>
        </div>

        <div className="bg-amber-50/50 backdrop-blur-md p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">TDS Credit (2%)</span>
            <ShieldCheck className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-900 mt-2">
            ₹{kpis.totalTdsWithheld.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <span className="text-xs text-amber-700 mt-0.5 block">Eligible for Form 26AS / TRACES</span>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Transactions</span>
            <Receipt className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{kpis.totalCount}</p>
          <span className="text-xs text-slate-500 mt-0.5 block">Total remittance records</span>
        </div>
      </div>

      {/* Statutory Info Banner */}
      <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100 flex items-start gap-3">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-800 leading-relaxed">
          <span className="font-semibold">TDS Withholding & Tax Credit Reconciliation: </span>
          Statutory TDS (Tax Deducted at Source under Section 194C / 194J) is automatically computed on net invoice values.
          Quarterly TDS certificates (Form 16A) will reflect these deductions for your tax filings on the TRACES portal.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by UTR or invoice #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Settlement Statuses</option>
            <option value="COMPLETED">Settled / Paid</option>
            <option value="SCHEDULED">Scheduled Inflow</option>
            <option value="PROCESSING">Processing</option>
          </select>
        </div>
      </div>

      {/* Remittances Table */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading remittance records...</span>
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-rose-500 flex flex-col items-center gap-2">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <span className="text-sm font-medium">Failed to load remittance ledger.</span>
            <button
              onClick={() => refetch()}
              className="text-xs text-emerald-600 hover:text-emerald-800 underline mt-1"
            >
              Try again
            </button>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CreditCard className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-600">No payment records found</p>
            <p className="text-xs text-slate-400 mt-1">
              Disbursements appear here once your submitted invoices are 3-way verified and approved.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left">UTR Reference</th>
                  <th className="px-3 py-3.5 text-left">Invoice #</th>
                  <th className="px-3 py-3.5 text-right">Gross Invoiced</th>
                  <th className="px-3 py-3.5 text-right">TDS Deducted (2%)</th>
                  <th className="px-3 py-3.5 text-right">Net Credited</th>
                  <th className="px-3 py-3.5 text-left">Due Date</th>
                  <th className="px-3 py-3.5 text-left">Remittance Date</th>
                  <th className="px-3 py-3.5 text-center">Mode</th>
                  <th className="px-3 py-3.5 text-center">Status</th>
                  <th className="py-3.5 pl-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredPayments.map((p) => {
                  const gross = Number(p.gross_amount || p.amount || 0);
                  const tds = Number(p.tds_amount || 0);
                  const net = Number(p.net_amount || (gross - tds) || 0);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* UTR Reference */}
                      <td className="py-3.5 pl-4 pr-3">
                        {p.utr_number ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {p.utr_number}
                            </span>
                            <button
                              onClick={() => handleCopyUtr(p.utr_number!)}
                              title="Copy UTR"
                              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                            >
                              {copiedUtr === p.utr_number ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 italic">
                            Awaiting Settlement
                          </span>
                        )}
                        {p.erp_payment_reference && (
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                            Ref: {p.erp_payment_reference}
                          </span>
                        )}
                      </td>

                      {/* Invoice */}
                      <td className="px-3 py-3.5">
                        <Link
                          href="/invoices"
                          className="font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-1 group"
                        >
                          {p.invoice_number || "View Invoices"}
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>

                      {/* Gross Invoiced */}
                      <td className="px-3 py-3.5 text-right font-medium text-slate-600">
                        {formatCurrency(gross, p.currency)}
                      </td>

                      {/* TDS (2%) */}
                      <td className="px-3 py-3.5 text-right font-medium text-amber-700">
                        {tds > 0 ? `- ${formatCurrency(tds, p.currency)}` : "—"}
                      </td>

                      {/* Net Credited */}
                      <td className="px-3 py-3.5 text-right font-bold text-emerald-700 text-sm">
                        {formatCurrency(net, p.currency)}
                      </td>

                      {/* Due Date */}
                      <td className="px-3 py-3.5 text-slate-600 whitespace-nowrap">
                        {p.payment_due_date ? (
                          <span>
                            {new Date(p.payment_due_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Remittance Date */}
                      <td className="px-3 py-3.5 text-slate-600 whitespace-nowrap">
                        {p.payment_date && p.status === "COMPLETED" ? (
                          <span className="font-semibold text-slate-900">
                            {new Date(p.payment_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Payment Mode */}
                      <td className="px-3 py-3.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {p.payment_method || "NEFT"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {getStatusBadge(p.status)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap">
                        <Link
                          href="/invoices"
                          className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                        >
                          Invoice Details →
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
