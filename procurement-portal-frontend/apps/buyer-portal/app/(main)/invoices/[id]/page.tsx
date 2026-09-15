"use client";
import { getErrorMessage } from "@procurement/utils";

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
  useAcceptEarlyPayment,
  useRejectEarlyPayment,
  useAppToast,
  useCreatePaymentOrder,
  useVerifyPayment,
} from "@procurement/hooks";
import { ThreeWayMatchResult, PaymentSchedule, DocumentList, PermissionGuard, SplitScreenViewer, Button, useConfirm } from "@procurement/ui";
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
  Zap,
  TrendingDown,
  CreditCard,
} from "lucide-react";

export default function InvoiceDetailPage() {
  const { toast } = useAppToast();
  const { confirm } = useConfirm();
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
  const acceptDiscountMutation = useAcceptEarlyPayment();
  const rejectDiscountMutation = useRejectEarlyPayment();
  const [discountActionMessage, setDiscountActionMessage] = useState<string | null>(null);

  // Modals state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReasonCode, setDisputeReasonCode] = useState("PRICE_MISMATCH");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [splitScreenActive, setSplitScreenActive] = useState(false);

  // Payment Gateway states
  const createPaymentOrder = useCreatePaymentOrder();
  const verifyPayment = useVerifyPayment();
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payProvider, setPayProvider] = useState<"RAZORPAY" | "STRIPE">("RAZORPAY");
  const [activePaymentOrder, setActivePaymentOrder] = useState<{
    order_id: string;
    amount: number;
    currency: string;
    gateway_provider: string;
    key_id: string;
    invoice_id: string;
    vendor_name?: string | null;
  } | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [payingPending, setPayingPending] = useState(false);

  const handleOpenPayModal = async () => {
    setPayModalOpen(true);
    setOrderLoading(true);
    try {
      const order = await createPaymentOrder.mutateAsync({
        invoice_id: invoiceId,
        amount: Number(invoice?.total_amount || 0),
        currency: invoice?.currency || "INR",
        gateway_provider: payProvider,
      });
      setActivePaymentOrder(order);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to initialize payment gateway order"));
    } finally {
      setOrderLoading(false);
    }
  };

  const handleConfirmOnlinePayment = async () => {
    if (!activePaymentOrder) return;
    setPayingPending(true);
    try {
      const mockPaymentId = `pay_${payProvider.toLowerCase().slice(0, 3)}_${Date.now()}`;
      await verifyPayment.mutateAsync({
        invoice_id: invoiceId,
        gateway_order_id: activePaymentOrder.order_id,
        gateway_payment_id: mockPaymentId,
        gateway_signature: `mock_sig_${Date.now()}`,
      });
      toast.success("Payment Successful!", `Settlement completed via ${payProvider}. Invoice marked as PAID.`);
      setPayModalOpen(false);
      refetch();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Payment signature verification failed"));
    } finally {
      setPayingPending(false);
    }
  };

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
    const ok = await confirm({
      title: "Approve Invoice",
      description: "Are you sure you want to approve this invoice for payment settlement?",
      confirmLabel: "Approve",
      variant: "primary",
    });
    if (!ok) return;
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

  const handleAcceptDiscount = async () => {
    const ok = await confirm({
      title: "Accept Early Payment Discount",
      description: "Confirm acceptance of early payment discount? Payout will be scheduled accordingly.",
      confirmLabel: "Accept Discount",
      variant: "primary",
    });
    if (!ok) return;
    try {
      const res = await acceptDiscountMutation.mutateAsync(invoiceId);
      setDiscountActionMessage(res?.message || "Early payment discount accepted successfully!");
      refetch();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to accept early discount"));
    }
  };

  const handleRejectDiscount = async () => {
    const reason = prompt("Enter reason for declining early payment discount (optional):");
    try {
      const res = await rejectDiscountMutation.mutateAsync({ invoiceId, reason: reason || undefined });
      setDiscountActionMessage(res?.message || "Early payment discount request rejected.");
      refetch();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to reject early discount"));
    }
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

            {invoice.status === "APPROVED" && (
              <PermissionGuard permission="payment.initiate">
                <Button
                  type="button"
                  onClick={handleOpenPayModal}
                  variant="primary"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-sm"
                  leftIcon={<CreditCard className="h-4 w-4" />}
                >
                  Pay Online
                </Button>
              </PermissionGuard>
            )}
          </div>
        </div>
      </div>

      {/* Online Gateway Settlement Pill (SPEC 27-J) */}
      {(paymentRecord as any)?.gateway_provider && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-100">
          <div className="flex items-center gap-2.5">
            <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              Settled via Online Gateway (<strong>{(paymentRecord as any).gateway_provider}</strong>)
            </span>
            {(paymentRecord as any).gateway_order_id && (
              <span className="font-mono text-slate-500 text-[11px]">
                Order: {(paymentRecord as any).gateway_order_id}
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded font-semibold text-blue-800 dark:text-blue-200">
            Payment Ref: {(paymentRecord as any).gateway_payment_id || paymentRecord?.utr_number || "Captured"}
          </span>
        </div>
      )}

      {/* Discount Action Message Banner */}
      {discountActionMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{discountActionMessage}</span>
          </div>
          <button onClick={() => setDiscountActionMessage(null)} className="font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ⚡ Early Payment Discount Review & Actions */}
      {invoice.early_discount_status === "REQUESTED" ? (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 rounded-2xl border border-amber-500/30 p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
                <Zap className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Vendor Requested Early Payment Acceleration (Dynamic Discount)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                    AP Action Required
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  The supplier offers an immediate dynamic discount concession of{" "}
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {invoice.currency} {Number(invoice.early_discount_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>{" "}
                  if payment is disbursed early on{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {invoice.early_discount_payout_date ? new Date(invoice.early_discount_payout_date).toLocaleDateString() : "Accelerated Date"}
                  </span>.
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs pt-1 font-mono">
                  <span className="text-slate-500 dark:text-slate-400">
                    Gross: {invoice.currency} {Number(invoice.total_amount).toLocaleString("en-IN")}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Net Payout: {invoice.currency} {(Number(invoice.total_amount) - Number(invoice.early_discount_amount || 0)).toLocaleString("en-IN")}
                  </span>
                  <span>•</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                    Effective Return: {(Number(invoice.early_discount_apr || 0.18) * 100).toFixed(1)}% Annualized
                  </span>
                </div>
              </div>
            </div>

            <PermissionGuard permission="payment.process">
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleRejectDiscount}
                  disabled={rejectDiscountMutation.isPending}
                  variant="secondary"
                  className="text-xs px-3 py-2 text-slate-700 dark:text-slate-300"
                >
                  Decline
                </Button>
                <Button
                  onClick={handleAcceptDiscount}
                  disabled={acceptDiscountMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2"
                  leftIcon={<Zap className="h-3.5 w-3.5" />}
                >
                  {acceptDiscountMutation.isPending ? "Accepting..." : "Accept & Capture Savings"}
                </Button>
              </div>
            </PermissionGuard>
          </div>
        </div>
      ) : invoice.early_discount_status === "ACCEPTED" ? (
        <div className="bg-emerald-500/10 dark:bg-emerald-950/30 rounded-2xl border border-emerald-500/30 p-4 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Early payment discount accepted! Net payout of{" "}
              <strong className="font-mono">{invoice.currency} {(Number(invoice.total_amount) - Number(invoice.early_discount_amount || 0)).toLocaleString("en-IN")}</strong>{" "}
              scheduled for {invoice.early_discount_payout_date ? new Date(invoice.early_discount_payout_date).toLocaleDateString() : "payout date"} (Company captured{" "}
              <strong className="font-mono">{invoice.currency} {Number(invoice.early_discount_amount || 0).toLocaleString("en-IN")}</strong> cash savings).
            </span>
          </div>
        </div>
      ) : null}

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

      {/* Online Payment Checkout Modal (SPEC 27-J) */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-white/15 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Online Payment Gateway</h3>
              </div>
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-[#252529] p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Payee / Beneficiary</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{invoice.vendor_name || "Supplier"}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Invoice Total</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {invoice.currency} {Number(invoice.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              {activePaymentOrder && (
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-white/10">
                  <span>Order Reference</span>
                  <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    {activePaymentOrder.order_id}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                Gateway Provider
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPayProvider("RAZORPAY")}
                  className={`p-3 rounded-xl border text-left transition-all text-xs ${
                    payProvider === "RAZORPAY"
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold"
                      : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="font-bold text-sm">Razorpay</div>
                  <div className="text-[11px] text-slate-500">UPI, NetBanking, Cards (India)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPayProvider("STRIPE")}
                  className={`p-3 rounded-xl border text-left transition-all text-xs ${
                    payProvider === "STRIPE"
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold"
                      : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="font-bold text-sm">Stripe</div>
                  <div className="text-[11px] text-slate-500">Global Cards, ACH, Cross-Border</div>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPayModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={orderLoading || payingPending}
                onClick={handleConfirmOnlinePayment}
                variant="primary"
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-transparent flex items-center gap-1.5"
              >
                {(orderLoading || payingPending) && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {orderLoading
                    ? "Generating Order..."
                    : payingPending
                    ? "Verifying Signature..."
                    : `Pay ${invoice.currency} ${Number(invoice.total_amount).toLocaleString("en-IN")}`}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
