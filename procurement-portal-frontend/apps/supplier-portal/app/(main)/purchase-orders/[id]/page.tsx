"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  usePurchaseOrder,
  useAcknowledgePO,
  useDownloadPOPDF,
} from "@procurement/hooks";
import { Button, Badge, Modal } from "@procurement/ui";
import {
  Package,
  ArrowLeft,
  Calendar,
  DollarSign,
  Truck,
  CheckCircle2,
  AlertCircle,
  Download,
  XCircle,
  Clock,
  Receipt,
  FileText,
} from "lucide-react";

export default function SupplierPODetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: po, isLoading, isError, refetch } = usePurchaseOrder(id);
  const acknowledgeMutation = useAcknowledgePO();
  const downloadPDFMutation = useDownloadPOPDF();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [amendmentModalOpen, setAmendmentModalOpen] = useState(false);
  const [proposedDate, setProposedDate] = useState("");
  const [amendmentReason, setAmendmentReason] = useState("");

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/4 animate-pulse" />
        <div className="h-32 bg-slate-100 dark:bg-slate-900 rounded-2xl animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Purchase Order Not Found</h2>
        <p className="text-slate-500 text-sm">The purchase order you requested does not exist or failed to load.</p>
        <Link
          href="/purchase-orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0071E3] text-white rounded-xl text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Purchase Orders
        </Link>
      </div>
    );
  }

  const handleAcknowledge = async () => {
    try {
      await acknowledgeMutation.mutateAsync({
        id: po.id,
        payload: { accepted: true },
      });
      refetch();
    } catch {
      // Handled
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    try {
      await acknowledgeMutation.mutateAsync({
        id: po.id,
        payload: { accepted: false, rejection_reason: rejectionReason.trim() },
      });
      setRejectModalOpen(false);
      setRejectionReason("");
      refetch();
    } catch {
      // Handled
    }
  };

  const handleAmendment = async () => {
    if (!amendmentReason.trim()) return;
    try {
      const fullReason = `[AMENDMENT_REQUEST] Proposed Delivery Date: ${proposedDate || "Unspecified"}. Reason: ${amendmentReason.trim()}`;
      await acknowledgeMutation.mutateAsync({
        id: po.id,
        payload: { accepted: false, rejection_reason: fullReason },
      });
      setAmendmentModalOpen(false);
      setAmendmentReason("");
      setProposedDate("");
      refetch();
    } catch {
      // Handled
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await downloadPDFMutation.mutateAsync(po.id);
      if (res.download_url) {
        window.open(res.download_url, "_blank");
      }
    } catch {
      // Handled
    }
  };

  const canAcknowledge = po.status === "SENT_TO_VENDOR" || po.status === "RELEASED";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
        <Link href="/purchase-orders" className="hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>
        <span>/</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{po.po_number}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {po.po_number}
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
              {po.status}
            </span>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Issued on {new Date(po.created_at || Date.now()).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4 mr-1.5" />}
            onClick={handleDownloadPDF}
            loading={downloadPDFMutation.isPending}
          >
            Download PDF
          </Button>

          {canAcknowledge && (
            <>
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCircle2 className="w-4 h-4 mr-1.5" />}
                onClick={handleAcknowledge}
                loading={acknowledgeMutation.isPending}
              >
                Acknowledge PO
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAmendmentModalOpen(true)}
              >
                Request Change
              </Button>
              <Button
                variant="destructive"
                size="sm"
                icon={<XCircle className="w-4 h-4 mr-1.5" />}
                onClick={() => setRejectModalOpen(true)}
              >
                Reject
              </Button>
            </>
          )}

          {(po.status === "VENDOR_ACKNOWLEDGED" || po.status === "PARTIALLY_RECEIVED") && (
            <Link href={`/invoices/new?po_id=${po.id}`}>
              <Button variant="primary" size="sm" icon={<Receipt className="w-4 h-4 mr-1.5" />}>
                Create Invoice
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 shadow-xs">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Total Value</span>
          <p className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
            {po.currency} {Number(po.total_value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 shadow-xs">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Expected Delivery</span>
          <p className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
            {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : "Per Schedule"}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 shadow-xs">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Payment Terms</span>
          <p className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
            {po.payment_term_id ? "Net Standard" : "Standard Net 30"}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 shadow-xs">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Line Items</span>
          <p className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
            {po.lines?.length || 0} Items
          </p>
        </div>
      </div>

      {/* PO Lines */}
      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Package className="w-4 h-4 text-[#0071E3]" />
          Order Line Items
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-500">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Item Description</th>
                <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                <th className="py-2.5 px-3 text-right">Received Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Tax Rate</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {po.lines?.map((l: any, idx: number) => (
                <tr key={l.id || idx}>
                  <td className="py-3 px-3 text-neutral-400">{l.line_number || idx + 1}</td>
                  <td className="py-3 px-3 font-medium text-neutral-900 dark:text-white">{l.item_description}</td>
                  <td className="py-3 px-3 text-right">{l.ordered_quantity}</td>
                  <td className="py-3 px-3 text-right text-neutral-500">{l.received_quantity || 0}</td>
                  <td className="py-3 px-3 text-right">
                    {po.currency} {Number(l.unit_price).toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right">{l.tax_rate || 0}%</td>
                  <td className="py-3 px-3 text-right font-semibold text-neutral-900 dark:text-white">
                    {po.currency} {Number(l.line_total || l.ordered_quantity * l.unit_price).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Purchase Order"
        description="Please state the official reason for rejecting this purchase order."
      >
        <div className="space-y-4 pt-2">
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
            placeholder="Explain why this order cannot be accepted..."
            className="apple-input resize-none w-full"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
              loading={acknowledgeMutation.isPending}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Amendment Modal */}
      <Modal
        isOpen={amendmentModalOpen}
        onClose={() => setAmendmentModalOpen(false)}
        title="Request Delivery Date or Scope Change"
        description="Notify the buyer of required date or quantity adjustments."
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="apple-label">Proposed Delivery Date</label>
            <input
              type="date"
              value={proposedDate}
              onChange={(e) => setProposedDate(e.target.value)}
              className="apple-input w-full"
            />
          </div>
          <div>
            <label className="apple-label">Reason for Request</label>
            <textarea
              value={amendmentReason}
              onChange={(e) => setAmendmentReason(e.target.value)}
              rows={3}
              placeholder="e.g. Lead time constraints require +7 days delivery extension"
              className="apple-input resize-none w-full"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAmendmentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAmendment}
              disabled={!amendmentReason.trim()}
              loading={acknowledgeMutation.isPending}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
