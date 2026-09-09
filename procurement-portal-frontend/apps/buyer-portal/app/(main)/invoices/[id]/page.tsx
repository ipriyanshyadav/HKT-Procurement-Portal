"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useInvoice,
  useApproveInvoice,
  useRejectInvoice,
  useDisputeInvoice,
  useMatchInvoice,
  usePayments,
} from "@procurement/hooks";
import { ThreeWayMatchResult, PaymentSchedule, DocumentList, PermissionGuard, SplitScreenViewer, Button } from "@procurement/ui";
import {
  ArrowLeft,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Clock,
  ShieldCheck,
  Building,
  Calendar,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Columns,
} from "lucide-react";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;

  const { data: invoice, isLoading, isError, refetch } = useInvoice(invoiceId);
  const { data: payments = [] } = usePayments({ invoice_id: invoiceId });
  const paymentRecord = payments[0] || null;

  const approveMutation = useApproveInvoice();
  const rejectMutation = useRejectInvoice();
  const disputeMutation = useDisputeInvoice();
  const matchMutation = useMatchInvoice();

  // Modals state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReasonCode, setDisputeReasonCode] = useState("PRICE_MISMATCH");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [splitScreenActive, setSplitScreenActive] = useState(false);

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Receipt className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 animate-pulse mb-3" />
        Loading invoice and match results...
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

  const handleApprove = async () => {
    if (!confirm("Are you sure you want to approve this invoice for payment settlement?")) return;
    await approveMutation.mutateAsync(invoiceId);
    refetch();
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    await rejectMutation.mutateAsync({
      id: invoiceId,
      data: { rejection_reason: rejectReason },
    });
    setRejectModalOpen(false);
    refetch();
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeDescription.trim()) return;
    await disputeMutation.mutateAsync({
      id: invoiceId,
      data: {
        reason_code: disputeReasonCode,
        description: disputeDescription,
      },
    });
    setDisputeModalOpen(false);
    refetch();
  };

  const handleRematch = async () => {
    await matchMutation.mutateAsync(invoiceId);
    refetch();
  };

  const isPendingApproval =
    invoice.status === "SUBMITTED" ||
    invoice.status === "PENDING_APPROVAL" ||
    invoice.status === "MATCHED" ||
    invoice.status === "PARTIALLY_MATCHED";

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/invoices" className="hover:text-slate-800 dark:hover:text-white flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">{invoice.invoice_number}</span>
      </div>

      {/* Invoice Header Card */}
      <div className="bg-white/80 dark:bg-[#1C1C1F] backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/15 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {invoice.invoice_number}
              </h1>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                  invoice.status === "APPROVED"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : invoice.status === "DISPUTED"
                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                }`}
              >
                {invoice.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {invoice.vendor_name || "Vendor"}
                </span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Vendor Inv:{" "}
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {invoice.vendor_invoice_number}
                </span>{" "}
                ({invoice.financial_year})
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
                Date: {invoice.invoice_date}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={splitScreenActive ? "primary" : "secondary"}
              onClick={() => setSplitScreenActive((prev) => !prev)}
              leftIcon={<Columns className="h-4 w-4" />}
            >
              {splitScreenActive ? "Exit Split View" : "Split Screen Viewer"}
            </Button>

            {isPendingApproval && (
              <>
                <PermissionGuard permission="invoice.approve">
                  <Button
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                    variant="primary"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  >
                    {approveMutation.isPending ? "Approving..." : "Approve Invoice"}
                  </Button>
                </PermissionGuard>

                <PermissionGuard permission="invoice.dispute">
                  <Button
                    onClick={() => setDisputeModalOpen(true)}
                    variant="secondary"
                    className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50"
                    leftIcon={<AlertTriangle className="h-4 w-4" />}
                  >
                    Raise Dispute
                  </Button>
                </PermissionGuard>

                <PermissionGuard permission="invoice.reject">
                  <Button
                    onClick={() => setRejectModalOpen(true)}
                    variant="danger"
                    leftIcon={<XCircle className="h-4 w-4" />}
                  >
                    Reject
                  </Button>
                </PermissionGuard>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Discrepancy Alert Callout if Discrepancy */}
      {invoice.match_status === "DISCREPANCY" && (
        <div className="bg-rose-50/80 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/40 p-4 flex items-start gap-3.5">
          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900 dark:text-rose-200">
            <h4 className="font-semibold text-sm">3-Way Match Discrepancies Detected</h4>
            <p className="mt-0.5 text-rose-700 dark:text-rose-300">
              One or more line items differ in price or quantity beyond allowable limits (±2% quantity, ±0.5% price). Review the discrepancy breakdown below before approving or resolving with the supplier.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Layout (Responsive Split-Screen Mode) */}
      <div className={splitScreenActive ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : "space-y-6"}>
        <div className="space-y-6">
          {/* 3-Way Match Verification Component */}
          <ThreeWayMatchResult
            invoice={invoice}
            onRematch={handleRematch}
            isMatching={matchMutation.isPending}
          />

          {/* Payment Schedule & Statutory TDS Component */}
          <PaymentSchedule invoice={invoice} paymentRecord={paymentRecord} />

          {/* Line Items Table */}
          <div className="bg-white/80 dark:bg-[#1C1C1F] backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-[#252529] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Invoiced Line Items</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Subtotal: {invoice.currency} {Number(invoice.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-white/10 text-xs">
                <thead className="bg-slate-50/80 dark:bg-[#252529] text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 pl-4 pr-3 text-left">Line #</th>
                    <th className="px-3 py-3 text-left">Description</th>
                    <th className="px-3 py-3 text-right">Quantity</th>
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

          {/* Invoice Documents (SPEC_17) */}
          <DocumentList
            entityType="INVOICE"
            entityId={invoice.id}
            title="Invoice Attachments & Supporting Documents"
            defaultDocumentType="TAX_INVOICE"
          />
        </div>

        {/* Right Column: SplitScreen Document Viewer */}
        {splitScreenActive && (
          <div className="sticky top-6 h-[calc(100vh-100px)] min-h-[640px]">
            <SplitScreenViewer
              isOpen={true}
              onClose={() => setSplitScreenActive(false)}
              invoiceNumber={invoice.invoice_number}
              poNumber={invoice.po_id || undefined}
              title="3-Way Match Document Viewer"
            />
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-white/15">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reject Invoice</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Provide a mandatory justification reason for canceling this invoice.
            </p>
            <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
              <textarea
                required
                rows={3}
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-3 border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRejectModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={rejectMutation.isPending}
                  variant="danger"
                >
                  {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-white/15">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Raise Invoice Dispute</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Open a structured dispute thread with the vendor for resolution.
            </p>
            <form onSubmit={handleDisputeSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Dispute Reason
                </label>
                <select
                  value={disputeReasonCode}
                  onChange={(e) => setDisputeReasonCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 rounded-xl text-sm bg-white dark:bg-[#252529] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="PRICE_MISMATCH">PRICE_MISMATCH</option>
                  <option value="QUANTITY_MISMATCH">QUANTITY_MISMATCH</option>
                  <option value="WRONG_PO">WRONG_PO</option>
                  <option value="QUALITY_ISSUE">QUALITY_ISSUE</option>
                  <option value="DUPLICATE">DUPLICATE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Discrepancy Details & Description
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain the specific issue with the invoice lines..."
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  className="w-full p-3 border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDisputeModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={disputeMutation.isPending}
                  variant="primary"
                  className="bg-amber-600 hover:bg-amber-700 text-white border-transparent"
                >
                  {disputeMutation.isPending ? "Submitting..." : "Submit Dispute"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
