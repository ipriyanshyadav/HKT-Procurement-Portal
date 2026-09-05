"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  usePurchaseOrder,
  useApprovePO,
  useSendPOToVendor,
  useCancelPO,
  useDownloadPOPDF,
  useGRNs,
} from "@procurement/hooks";
import { DeliveryScheduleTable, DocumentList } from "@procurement/ui";
import {
  Package,
  ArrowLeft,
  Calendar,
  DollarSign,
  Truck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  Download,
  XCircle,
  Clock,
  Shield,
  FileCheck,
} from "lucide-react";

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: po, isLoading, isError, refetch } = usePurchaseOrder(id);
  const { data: grns = [], isLoading: isLoadingGRNs } = useGRNs({ po_id: id });

  const approveMutation = useApprovePO();
  const sendToVendorMutation = useSendPOToVendor();
  const cancelMutation = useCancelPO();
  const downloadPDFMutation = useDownloadPOPDF();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [activeTab, setActiveTab] = useState<"lines" | "grn" | "amendments" | "documents">("lines");

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/4 animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Purchase Order Not Found</h2>
        <p className="text-slate-500 text-sm">The purchase order you requested does not exist or failed to load.</p>
        <Link
          href="/purchase-orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Purchase Orders
        </Link>
      </div>
    );
  }

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ id: po.id });
      refetch();
    } catch (err) {
      // Handled
    }
  };

  const handleSendToVendor = async () => {
    try {
      await sendToVendorMutation.mutateAsync(po.id);
      refetch();
    } catch (err) {
      // Handled
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    try {
      await cancelMutation.mutateAsync({ id: po.id, reason: cancelReason });
      setCancelModalOpen(false);
      refetch();
    } catch (err) {
      // Handled
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await downloadPDFMutation.mutateAsync(po.id);
      if (res.download_url) {
        window.open(res.download_url, "_blank");
      }
    } catch (err) {
      // Handled
    }
  };

  const formatCurrency = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return "0.00";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "0.00" : `${po.currency} ${num.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "VENDOR_ACKNOWLEDGED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "SENT_TO_VENDOR":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "PENDING_APPROVAL":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "PARTIALLY_RECEIVED":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "RECEIVED":
      case "CLOSED":
        return "bg-green-100 text-green-800 border-green-300";
      case "VENDOR_REJECTED":
      case "CANCELLED":
      case "REJECTED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "DRAFT":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/purchase-orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Purchase Orders
        </Link>
        <div className="flex items-center gap-2">
          {po.status === "PENDING_APPROVAL" && (
            <button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve PO
            </button>
          )}
          {po.status === "APPROVED" && (
            <button
              onClick={handleSendToVendor}
              disabled={sendToVendorMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send to Vendor
            </button>
          )}
          {(po.status === "APPROVED" ||
            po.status === "SENT_TO_VENDOR" ||
            po.status === "VENDOR_ACKNOWLEDGED" ||
            po.status === "PARTIALLY_RECEIVED" ||
            po.status === "RECEIVED") && (
            <button
              onClick={handleDownloadPDF}
              disabled={downloadPDFMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4 text-slate-500" />
              Download PDF
            </button>
          )}
          {(po.status === "SENT_TO_VENDOR" ||
            po.status === "VENDOR_ACKNOWLEDGED" ||
            po.status === "PARTIALLY_RECEIVED") && (
            <Link
              href={`/grn/new?po_id=${po.id}`}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Truck className="h-4 w-4" />
              Create GRN
            </Link>
          )}
          {po.status !== "CANCELLED" && po.status !== "CLOSED" && (
            <button
              onClick={() => setCancelModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Cancel PO
            </button>
          )}
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-slate-900">{po.po_number}</h1>
              {po.amendment_count > 0 && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800">
                  Version {po.amendment_count + 1}
                </span>
              )}
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                  po.status
                )}`}
              >
                {po.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-base font-medium text-slate-700 mt-1">{po.title}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 font-medium">TOTAL ORDER VALUE</div>
            <div className="text-2xl font-bold font-mono text-slate-900">
              {formatCurrency(po.total_value)}
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-sm">
          <div>
            <span className="block text-xs font-medium text-slate-400 uppercase">Vendor ID</span>
            <span className="font-mono text-xs text-slate-700 font-semibold">{po.vendor_id}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400 uppercase">Expected Delivery</span>
            <span className="font-medium text-slate-700">
              {po.expected_delivery_date
                ? new Date(po.expected_delivery_date).toLocaleDateString()
                : "Not Specified"}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400 uppercase">Created Date</span>
            <span className="font-medium text-slate-700">
              {po.created_at ? new Date(po.created_at).toLocaleDateString() : "—"}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400 uppercase">Sent to Vendor</span>
            <span className="font-medium text-slate-700">
              {po.sent_at ? new Date(po.sent_at).toLocaleDateString() : "Not Sent"}
            </span>
          </div>
        </div>

        {po.vendor_rejection_reason && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm">
            <span className="font-bold">Vendor Rejection Reason:</span> {po.vendor_rejection_reason}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("lines")}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "lines"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Package className="h-4 w-4" />
            Delivery Schedule & Lines ({po.lines?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("grn")}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "grn"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Truck className="h-4 w-4" />
            GRN Receipts ({grns.length})
          </button>
          {po.amendments && po.amendments.length > 0 && (
            <button
              onClick={() => setActiveTab("amendments")}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === "amendments"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <FileCheck className="h-4 w-4" />
              Amendments ({po.amendments.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab("documents")}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "documents"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents & Attachments
          </button>
        </nav>
      </div>

      {/* Tab Contents */}
      {activeTab === "lines" && (
        <div className="space-y-4">
          <DeliveryScheduleTable lines={po.lines || []} currency={po.currency} />
        </div>
      )}

      {activeTab === "grn" && (
        <div className="space-y-4">
          {isLoadingGRNs ? (
            <div className="p-8 text-center text-slate-500">Loading GRN receipts...</div>
          ) : grns.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
              <Truck className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <h3 className="text-base font-semibold text-slate-800">No GRNs recorded yet</h3>
              <p className="text-sm mt-1 text-slate-500">Goods receipt notes will show up here as deliveries arrive.</p>
              {(po.status === "SENT_TO_VENDOR" ||
                po.status === "VENDOR_ACKNOWLEDGED" ||
                po.status === "PARTIALLY_RECEIVED") && (
                <Link
                  href={`/grn/new?po_id=${po.id}`}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
                >
                  <Truck className="h-4 w-4" />
                  Record First GRN
                </Link>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-5 py-3">GRN Number</th>
                    <th scope="col" className="px-5 py-3">Challan / LR #</th>
                    <th scope="col" className="px-5 py-3">Receipt Date</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                    <th scope="col" className="px-5 py-3">Confirmed At</th>
                    <th scope="col" className="px-5 py-3 text-right">Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grns.map((grn) => (
                    <tr key={grn.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 font-mono font-semibold text-indigo-600">
                        {grn.grn_number}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <div>{grn.challan_number || "—"}</div>
                        {grn.transporter_name && (
                          <div className="text-xs text-slate-400">{grn.transporter_name}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {new Date(grn.receipt_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            grn.status === "CONFIRMED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : grn.status === "PENDING_QC"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {grn.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {grn.confirmed_at ? new Date(grn.confirmed_at).toLocaleDateString() : "Pending"}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-700">
                        {grn.lines?.length || 0} line items
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "amendments" && po.amendments && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3">Amendment #</th>
                  <th scope="col" className="px-5 py-3">Reason</th>
                  <th scope="col" className="px-5 py-3">Changed Amount</th>
                  <th scope="col" className="px-5 py-3">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {po.amendments.map((am) => (
                  <tr key={am.id}>
                    <td className="px-5 py-4 font-mono font-semibold text-indigo-600">
                      Amendment #{am.amendment_number}
                    </td>
                    <td className="px-5 py-4 text-slate-700">{am.reason}</td>
                    <td className="px-5 py-4 font-mono text-slate-900">
                      {formatCurrency(am.value_change)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {am.created_at ? new Date(am.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="space-y-4">
          <DocumentList
            entityType="PURCHASE_ORDER"
            entityId={po.id}
            title="Purchase Order Attachments & Delivery Notes"
            defaultDocumentType="PURCHASE_ORDER"
          />
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Cancel Purchase Order</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to cancel this purchase order? This action will set the status to CANCELLED and notify all parties.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cancellation Reason *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Provide a valid cancellation reason..."
                rows={3}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Dismiss
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
