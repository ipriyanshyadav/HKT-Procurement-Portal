"use client";

import React, { useState, useMemo } from "react";
import {
  usePurchaseOrders,
  useAcknowledgePO,
  useDownloadPOPDF,
  POResponse,
} from "@procurement/hooks";
import {
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  AlertCircle,
  Search,
  Truck,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit3,
} from "lucide-react";

export default function SupplierPurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPO, setSelectedPO] = useState<POResponse | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

  // Amendment Request Modal State (Plan 14)
  const [amendmentModalOpen, setAmendmentModalOpen] = useState(false);
  const [proposedDeliveryDate, setProposedDeliveryDate] = useState("");
  const [amendmentReason, setAmendmentReason] = useState("");
  const [proposedNotes, setProposedNotes] = useState("");

  const { data: purchaseOrders = [], isLoading, isError, refetch } = usePurchaseOrders({
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const acknowledgeMutation = useAcknowledgePO();
  const downloadPDFMutation = useDownloadPOPDF();

  const kpis = useMemo(() => {
    const total = purchaseOrders.length;
    const pendingAck = purchaseOrders.filter(
      (po) => po.status === "SENT_TO_VENDOR" || po.status === "RELEASED"
    ).length;
    const acknowledged = purchaseOrders.filter(
      (po) => po.status === "VENDOR_ACKNOWLEDGED" || po.status === "PARTIALLY_RECEIVED"
    ).length;
    const completed = purchaseOrders.filter(
      (po) => po.status === "RECEIVED" || po.status === "CLOSED"
    ).length;
    return { total, pendingAck, acknowledged, completed };
  }, [purchaseOrders]);

  const handleAcknowledge = async (po: POResponse) => {
    try {
      await acknowledgeMutation.mutateAsync({
        id: po.id,
        payload: { accepted: true },
      });
      refetch();
    } catch (err) {
      // Handled
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedPO || !rejectionReason.trim()) return;
    try {
      await acknowledgeMutation.mutateAsync({
        id: selectedPO.id,
        payload: {
          accepted: false,
          rejection_reason: rejectionReason,
        },
      });
      setRejectModalOpen(false);
      setRejectionReason("");
      setSelectedPO(null);
      refetch();
    } catch (err) {
      // Handled
    }
  };

  const handleAmendmentSubmit = async () => {
    if (!selectedPO || !amendmentReason.trim()) return;
    try {
      const fullReason = `[AMENDMENT_REQUEST] Proposed Delivery Date: ${proposedDeliveryDate || "Unspecified"}. Reason: ${amendmentReason.trim()}${
        proposedNotes.trim() ? `. Details: ${proposedNotes.trim()}` : ""
      }`;
      await acknowledgeMutation.mutateAsync({
        id: selectedPO.id,
        payload: {
          accepted: false,
          rejection_reason: fullReason,
        },
      });
      setAmendmentModalOpen(false);
      setAmendmentReason("");
      setProposedDeliveryDate("");
      setProposedNotes("");
      setSelectedPO(null);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to submit amendment request");
    }
  };

  const handleDownloadPDF = async (poId: string) => {
    try {
      const res = await downloadPDFMutation.mutateAsync(poId);
      if (res.download_url) {
        window.open(res.download_url, "_blank");
      }
    } catch (err) {
      // Handled
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "SENT_TO_VENDOR":
      case "RELEASED":
        return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
      case "VENDOR_ACKNOWLEDGED":
      case "ACKNOWLEDGED":
        return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
      case "PARTIALLY_RECEIVED":
        return "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800";
      case "RECEIVED":
      case "FULLY_RECEIVED":
      case "CLOSED":
        return "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800";
      case "VENDOR_REJECTED":
      case "CANCELLED":
        return "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  const formatCurrency = (val: string | number | undefined | null, curr = "INR") => {
    if (val === undefined || val === null) return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "—" : `${curr} ${num.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <Package className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          My Purchase Orders
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review incoming buyer purchase orders, acknowledge commitments, and download official PO documents.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Orders</span>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{kpis.total}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <span>Action Required</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{kpis.pendingAck}</div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Pending your acknowledgment</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>Acknowledged / Active</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{kpis.acknowledged}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <span>Fulfilled / Closed</span>
            <Truck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{kpis.completed}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO number or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="">All Orders</option>
            <option value="SENT_TO_VENDOR">Pending My Acknowledgment</option>
            <option value="VENDOR_ACKNOWLEDGED">Acknowledged</option>
            <option value="PARTIALLY_RECEIVED">Partially Delivered</option>
            <option value="RECEIVED">Fully Delivered</option>
            <option value="CLOSED">Closed</option>
            <option value="VENDOR_REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Purchase Orders List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-1/3 mx-auto"></div>
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-rose-500">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-rose-400" />
            <p className="font-semibold">Failed to load purchase orders</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-sm text-emerald-600 hover:underline font-medium"
            >
              Try again
            </button>
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Package className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800">No purchase orders found</h3>
            <p className="text-sm mt-1 max-w-sm mx-auto text-slate-500">
              Orders released to your organization will appear here for acknowledgment and fulfillment.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {purchaseOrders.map((po) => {
              const isExpanded = expandedPoId === po.id;
              const isPendingAck = po.status === "SENT_TO_VENDOR" || po.status === "RELEASED";

              return (
                <div key={po.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                          {po.po_number}
                        </span>
                        {po.amendment_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                            v{po.amendment_count + 1}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                            po.status
                          )}`}
                        >
                          {isPendingAck ? "Action Required: Pending Acknowledgment" : po.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">{po.title}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        <span>Expected Delivery: <strong className="text-slate-700 dark:text-slate-300">{po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : "—"}</strong></span>
                        <span>•</span>
                        <span>Total: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatCurrency(po.total_value, po.currency)}</strong></span>
                        <span>•</span>
                        <span>Lines: <strong className="text-slate-700 dark:text-slate-300">{po.lines?.length || 0} items</strong></span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {isPendingAck && (
                        <>
                          <button
                            onClick={() => handleAcknowledge(po)}
                            disabled={acknowledgeMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Acknowledge Order
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPO(po);
                              setProposedDeliveryDate(
                                po.expected_delivery_date
                                  ? po.expected_delivery_date.split("T")[0]
                                  : ""
                              );
                              setAmendmentModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg shadow-sm transition-colors"
                          >
                            <Edit3 className="h-4 w-4" />
                            Request Amendment
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPO(po);
                              setRejectModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-lg shadow-sm transition-colors"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDownloadPDF(po.id)}
                        disabled={downloadPDFMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
                        title="Download official PO document"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        PDF
                      </button>

                      <button
                        onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        {isExpanded ? "Hide Lines" : "View Lines"}
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Line Items Table */}
                  {isExpanded && po.lines && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Item Description</th>
                            <th className="px-3 py-2 text-right">Ordered Qty</th>
                            <th className="px-3 py-2 text-right">Unit Price</th>
                            <th className="px-3 py-2 text-right">Total Price</th>
                            <th className="px-3 py-2 text-right">Received Qty</th>
                            <th className="px-3 py-2 text-right">Open Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {po.lines.map((l) => (
                            <tr key={l.id}>
                              <td className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">{l.line_number}</td>
                              <td className="px-3 py-2 text-slate-900 dark:text-white font-medium">{l.item_description}</td>
                              <td className="px-3 py-2 text-right font-mono">{l.ordered_quantity}</td>
                              <td className="px-3 py-2 text-right font-mono">{formatCurrency(l.unit_price, po.currency)}</td>
                              <td className="px-3 py-2 text-right font-mono font-medium">{formatCurrency(l.total_price, po.currency)}</td>
                              <td className="px-3 py-2 text-right font-mono text-green-700 dark:text-green-400">{l.received_quantity}</td>
                              <td className="px-3 py-2 text-right font-mono text-amber-700 dark:text-amber-400">{l.open_quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject PO Modal */}
      {rejectModalOpen && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" />
              Reject Purchase Order
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Please provide a clear reason for rejecting PO <strong className="font-mono text-slate-800 dark:text-slate-200">{selectedPO.po_number}</strong>. This will notify the buyer immediately.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Rejection Reason *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Infeasible delivery schedule, pricing discrepancy, or capacity constraint..."
                rows={3}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setSelectedPO(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectionReason.trim() || acknowledgeMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request PO Amendment Modal (Plan 14) */}
      {amendmentModalOpen && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-indigo-600" />
              Request PO Amendment
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Submit a formal amendment proposal for PO{" "}
              <strong className="font-mono text-slate-800 dark:text-slate-200">{selectedPO.po_number}</strong>. The buyer
              will review your requested delivery date and terms.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Proposed Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={proposedDeliveryDate}
                  onChange={(e) => setProposedDeliveryDate(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Primary Amendment Reason *
                </label>
                <select
                  value={amendmentReason}
                  onChange={(e) => setAmendmentReason(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">Select reason...</option>
                  <option value="Lead time extension required due to supply chain disruption">
                    Lead time extension (Supply chain delay)
                  </option>
                  <option value="Batch / quantity split requested">
                    Quantity / Delivery batching adjustment
                  </option>
                  <option value="Specification or delivery address clarification needed">
                    Technical or delivery location clarification
                  </option>
                  <option value="Price indexation or tax rate adjustment">
                    Price indexation / statutory tax adjustment
                  </option>
                  <option value="Other contractual terms modification">
                    Other terms & conditions revision
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Detailed Explanation & Remarks
                </label>
                <textarea
                  value={proposedNotes}
                  onChange={(e) => setProposedNotes(e.target.value)}
                  placeholder="Provide full context for the buyer's procurement officer..."
                  rows={3}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAmendmentModalOpen(false);
                  setSelectedPO(null);
                  setAmendmentReason("");
                  setProposedDeliveryDate("");
                  setProposedNotes("");
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAmendmentSubmit}
                disabled={!amendmentReason.trim() || acknowledgeMutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
              >
                {acknowledgeMutation.isPending
                  ? "Submitting Request..."
                  : "Submit Amendment Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
