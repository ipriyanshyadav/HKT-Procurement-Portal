"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useInvoice,
  usePayments,
  useEarlyDiscountOptions,
  useRequestEarlyPayment,
} from "@procurement/hooks";
import type { EarlyDiscountOption } from "@procurement/types";
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
  Zap,
  TrendingDown,
  Sparkles,
} from "lucide-react";

export default function SupplierInvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params?.id as string;

  const { data: invoice, isLoading, isError, refetch } = useInvoice(invoiceId);
  const { data: payments = [] } = usePayments({ invoice_id: invoiceId });
  const paymentRecord = payments[0] || null;

  const { data: discountOptions, refetch: refetchOptions } = useEarlyDiscountOptions(invoiceId);
  const requestDiscountMutation = useRequestEarlyPayment();
  const [selectedOptionIndex, setSelectedOptionIndex] = React.useState<number>(0);
  const [discountNotes, setDiscountNotes] = React.useState<string>("");
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const handleRequestEarlyPayment = async (option: EarlyDiscountOption) => {
    try {
      await requestDiscountMutation.mutateAsync({
        invoiceId,
        data: {
          payout_date: option.payout_date,
          discount_percentage: option.discount_percentage,
          notes: discountNotes || undefined,
        },
      });
      setSuccessMessage("Accelerated early payment request submitted! Buyer AP will review and disburse funds.");
      refetch();
      refetchOptions();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to submit early payment request");
    }
  };

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

      {/* Success Notification */}
      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ⚡ Early Payment / Dynamic Discounting Status & Options */}
      {invoice.early_discount_status === "ACCEPTED" ? (
        <div className="bg-emerald-500/10 dark:bg-emerald-950/30 rounded-2xl border border-emerald-500/30 p-5 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-xs">
              <Zap className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                  Accelerated Early Payment Approved & Scheduled
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                  Payout Scheduled
                </span>
              </div>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                Buyer Accounts Payable approved early settlement. Payout is scheduled for{" "}
                <span className="font-bold text-emerald-950 dark:text-emerald-100">
                  {invoice.early_discount_payout_date ? new Date(invoice.early_discount_payout_date).toLocaleDateString() : "Shortly"}
                </span>.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
                <div className="bg-white/60 dark:bg-white/5 rounded-lg p-2.5 border border-emerald-500/20">
                  <div className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400">Discount Concession</div>
                  <div className="font-mono text-sm font-bold text-emerald-950 dark:text-emerald-100">
                    {invoice.currency} {Number(invoice.early_discount_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-white/60 dark:bg-white/5 rounded-lg p-2.5 border border-emerald-500/20">
                  <div className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400">Net Accelerated Payout</div>
                  <div className="font-mono text-sm font-bold text-emerald-950 dark:text-emerald-100">
                    {invoice.currency} {(Number(invoice.total_amount) - Number(invoice.early_discount_amount || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-white/60 dark:bg-white/5 rounded-lg p-2.5 border border-emerald-500/20 col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400">APR Applied</div>
                  <div className="font-mono text-sm font-bold text-emerald-950 dark:text-emerald-100">
                    {(Number(invoice.early_discount_apr || 0.18) * 100).toFixed(1)}% Annualized
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : invoice.early_discount_status === "REQUESTED" ? (
        <div className="bg-amber-500/10 dark:bg-amber-950/30 rounded-2xl border border-amber-500/30 p-5 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-amber-950 dark:text-amber-200">
                  Early Payment Request Pending Buyer AP Review
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                  Under Review
                </span>
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                You requested accelerated payout on{" "}
                <span className="font-bold text-amber-950 dark:text-amber-100">
                  {invoice.early_discount_payout_date ? new Date(invoice.early_discount_payout_date).toLocaleDateString() : "Earliest Date"}
                </span>{" "}
                with an offered discount of {invoice.currency} {Number(invoice.early_discount_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}.
              </p>
            </div>
          </div>
        </div>
      ) : discountOptions?.eligible_for_early_discount && discountOptions.options.length > 0 ? (
        <div className="bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/70 dark:from-[#1E1F2E] dark:via-[#1C1C1F] dark:to-[#172230] rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-100 dark:border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white">
                  <Zap className="h-3 w-3" /> Supply Chain Finance
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Accelerate Cash Flow (Dynamic Early Payment)
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Receive working capital immediately before standard maturity date ({invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "Net 30/45"}) by offering an automated sliding-scale discount.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block font-medium">Standard Due Date</span>
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "Standard Terms"} ({discountOptions.days_until_due} days remaining)
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Select Desired Accelerated Payout Date:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {discountOptions.options.map((opt, idx) => {
                const isSelected = selectedOptionIndex === idx;
                return (
                  <button
                    key={opt.payout_date}
                    type="button"
                    onClick={() => setSelectedOptionIndex(idx)}
                    className={`text-left p-4 rounded-xl border transition-all relative ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400/40"
                        : "bg-white dark:bg-white/5 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>In {opt.payout_days_from_now} Days</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isSelected ? "bg-white/20 text-white" : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                      }`}>
                        +{opt.days_accelerated}d Earlier
                      </span>
                    </div>
                    <div className="font-mono text-base font-bold mt-2">
                      {new Date(opt.payout_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div className="mt-2 pt-2 border-t border-current/15 text-[11px] space-y-0.5 opacity-90">
                      <div className="flex justify-between">
                        <span>Discount:</span>
                        <span className="font-mono font-semibold">{(opt.discount_percentage * 100).toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Net Cash:</span>
                        <span className="font-mono">{invoice.currency} {opt.net_payout_amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Option Detail Breakdown */}
            {discountOptions.options[selectedOptionIndex] && (
              <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-indigo-100 dark:border-white/10 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Selected Terms: Payout on {new Date(discountOptions.options[selectedOptionIndex].payout_date).toLocaleDateString()}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Gross Invoice: {invoice.currency} {Number(invoice.total_amount).toLocaleString("en-IN")} &nbsp;•&nbsp; 
                    Discount Fee: <span className="font-mono text-rose-600 dark:text-rose-400 font-medium">-{invoice.currency} {discountOptions.options[selectedOptionIndex].discount_amount.toLocaleString("en-IN")}</span> &nbsp;•&nbsp;
                    Net Immediate Cash: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{invoice.currency} {discountOptions.options[selectedOptionIndex].net_payout_amount.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="text"
                    placeholder="Optional reference note..."
                    value={discountNotes}
                    onChange={(e) => setDiscountNotes(e.target.value)}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
                  />
                  <Button
                    onClick={() => handleRequestEarlyPayment(discountOptions.options[selectedOptionIndex])}
                    disabled={requestDiscountMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2"
                    leftIcon={<Zap className="h-3.5 w-3.5" />}
                  >
                    {requestDiscountMutation.isPending ? "Submitting..." : "Submit Early Payment Request"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

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
