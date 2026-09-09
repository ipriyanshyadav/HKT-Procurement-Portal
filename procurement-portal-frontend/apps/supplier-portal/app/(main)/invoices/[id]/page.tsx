"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useInvoice, usePayments } from "@procurement/hooks";
import {
  ThreeWayMatchResult,
  PaymentSchedule,
  DocumentList,
  Button,
} from "@procurement/ui";
import {
  ArrowLeft,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Calendar,
  Building,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

export default function SupplierInvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params?.id as string;

  const { data: invoice, isLoading, isError } = useInvoice(invoiceId);
  const { data: payments = [] } = usePayments({ invoice_id: invoiceId });
  const paymentRecord = payments[0] || null;

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Receipt className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 animate-pulse mb-3" />
        Loading invoice details and reconciliation status...
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="py-24 text-center text-rose-500">
        <AlertCircle className="h-10 w-10 mx-auto text-rose-400 mb-3" />
        Failed to load invoice details.
        <div className="mt-4">
          <Link
            href="/invoices"
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
          >
            ← Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
            Approved for Settlement
          </span>
        );
      case "DISPUTED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600 dark:text-rose-400" />
            Disputed by Buyer
          </span>
        );
      case "PAID":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400" />
            Settled & Disbursed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400" />
            {invoice.status}
          </span>
        );
    }
  };

  const hasDiscrepancy =
    invoice.match_status === "DISCREPANCY" || invoice.status === "DISPUTED";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link
          href="/invoices"
          className="hover:text-slate-800 dark:hover:text-white flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {invoice.invoice_number}
        </span>
      </div>

      {/* Header Card */}
      <div className="bg-white/80 dark:bg-[#1C1C1F] backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/15 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {invoice.invoice_number}
              </h1>
              {getStatusBadge(invoice.status)}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Your Inv #:{" "}
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {invoice.vendor_invoice_number}
                </span>{" "}
                ({invoice.financial_year || "FY 2026-27"})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                PO:{" "}
                <Link
                  href={`/purchase-orders/${invoice.po_id}`}
                  className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline underline-offset-2"
                >
                  {invoice.po_number || invoice.po_id.slice(0, 8)}
                </Link>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Invoice Date: {invoice.invoice_date}
              </span>
              {invoice.vendor_name && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    {invoice.vendor_name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Links */}
          <div className="flex flex-wrap items-center gap-3">
            {hasDiscrepancy && (
              <Link href="/invoices/disputes">
                <Button
                  variant="secondary"
                  className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50"
                  leftIcon={<MessageSquare className="h-4 w-4" />}
                >
                  Open Dispute Thread
                </Button>
              </Link>
            )}

            <Link href={`/purchase-orders/${invoice.po_id}`}>
              <Button variant="secondary">View Linked PO</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Discrepancy Callout if Discrepancy */}
      {hasDiscrepancy && (
        <div className="bg-rose-50/80 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/40 p-4 flex items-start gap-3.5">
          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900 dark:text-rose-200">
            <h4 className="font-semibold text-sm">3-Way Match Discrepancy Flagged</h4>
            <p className="mt-0.5 text-rose-700 dark:text-rose-300">
              The buyer’s automated reconciliation system identified quantity or unit price variances exceeding contract tolerance limits. Inspect the line-by-line verification below or connect with the procurement officer via the dispute thread.
            </p>
          </div>
        </div>
      )}

      {/* 3-Way Match Verification Component */}
      <ThreeWayMatchResult invoice={invoice} />

      {/* Payment Schedule & Statutory TDS Component */}
      <PaymentSchedule invoice={invoice} paymentRecord={paymentRecord} />

      {/* Invoiced Line Items Table */}
      <div className="bg-white/80 dark:bg-[#1C1C1F] backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-[#252529] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Invoiced Line Items</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Gross Total: {invoice.currency} {Number(invoice.total_amount || invoice.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-white/10 text-xs">
            <thead className="bg-slate-50/80 dark:bg-[#252529] text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 pl-4 pr-3 text-left">Line #</th>
                <th className="px-3 py-3 text-left">Description</th>
                <th className="px-3 py-3 text-right">Billed Qty</th>
                <th className="px-3 py-3 text-right">Unit Price</th>
                <th className="px-3 py-3 text-right">Tax Rate (%)</th>
                <th className="px-3 py-3 text-right">Tax Amount</th>
                <th className="py-3 pl-3 pr-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10 bg-white dark:bg-[#1C1C1F]">
              {(invoice.lines || []).map((line) => (
                <tr key={line.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.04] transition-colors">
                  <td className="py-3 pl-4 pr-3 text-slate-500 dark:text-slate-400 font-mono">
                    {line.line_number}
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">
                    {line.item_description}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                    {Number(line.quantity).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                    {invoice.currency} {Number(line.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                    {Number(line.tax_rate).toFixed(2)}%
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                    {invoice.currency} {Number(line.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 pl-3 pr-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {invoice.currency} {Number(line.line_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supporting Documents & Proof of Delivery (with ClamAV scanning integration) */}
      <DocumentList
        entityType="INVOICE"
        entityId={invoice.id}
        title="Invoice Attachments & Proof of Delivery"
        defaultDocumentType="TAX_INVOICE"
      />
    </div>
  );
}
