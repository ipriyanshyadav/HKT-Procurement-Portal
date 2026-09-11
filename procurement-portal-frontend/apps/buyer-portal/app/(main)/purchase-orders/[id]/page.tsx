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
  useAmendPO,
} from "@procurement/hooks";
import type { POLineUpdate } from "@procurement/types";
import {
  DeliveryScheduleTable,
  DocumentList,
  PermissionGuard,
  UnderlineTabs,
  Button,
  Badge,
} from "@procurement/ui";
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
  Edit3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  React.useEffect(() => {
    if (id === "new") {
      router.replace("/purchase-orders/new");
    }
  }, [id, router]);

  const { data: po, isLoading, isError, refetch } = usePurchaseOrder(id);
  const { data: grns = [], isLoading: isLoadingGRNs } = useGRNs({ po_id: id });

  const approveMutation = useApprovePO();
  const sendToVendorMutation = useSendPOToVendor();
  const cancelMutation = useCancelPO();
  const downloadPDFMutation = useDownloadPOPDF();
  const amendMutation = useAmendPO();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [activeTab, setActiveTab] = useState<"lines" | "grn" | "amendments" | "documents">("lines");

  const [amendModalOpen, setAmendModalOpen] = useState(false);
  const [amendReason, setAmendReason] = useState("");
  const [lineEdits, setLineEdits] = useState<Record<string, { quantity: number; unit_price: number; delivery_date: string }>>({});
  const [expandedAmendmentId, setExpandedAmendmentId] = useState<string | null>(null);

  const openAmendModal = () => {
    if (!po?.lines) return;
    const initial: Record<string, { quantity: number; unit_price: number; delivery_date: string }> = {};
    for (const line of po.lines) {
      initial[line.id] = {
        quantity: Number(line.ordered_quantity),
        unit_price: Number(line.unit_price),
        delivery_date: line.delivery_date ? line.delivery_date.slice(0, 10) : "",
      };
    }
    setLineEdits(initial);
    setAmendReason("");
    setAmendModalOpen(true);
  };

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
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Purchase Order Not Found</h2>
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

  const currentTotal = Number(po.total_value);
  const projectedTotal = (po.lines || []).reduce((sum, line) => {
    const edit = lineEdits[line.id];
    const qty = edit?.quantity !== undefined ? edit.quantity : Number(line.ordered_quantity);
    const price = edit?.unit_price !== undefined ? edit.unit_price : Number(line.unit_price);
    return sum + (qty * price);
  }, 0);

  const totalDelta = projectedTotal - currentTotal;
  const deltaPct = currentTotal > 0 ? (Math.abs(totalDelta) / currentTotal) * 100 : 0;
  const willTriggerReapproval = deltaPct > 10;

  const handleAmendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendReason.trim()) return;

    for (const line of po.lines || []) {
      const edit = lineEdits[line.id];
      if (edit && edit.quantity < Number(line.received_quantity || 0)) {
        alert(`Line ${line.line_number}: Cannot reduce ordered quantity to ${edit.quantity} below received quantity ${line.received_quantity}`);
        return;
      }
    }

    const line_updates: POLineUpdate[] = (po.lines || [])
      .filter((line) => {
        const edit = lineEdits[line.id];
        if (!edit) return false;
        return (
          edit.quantity !== Number(line.ordered_quantity) ||
          edit.unit_price !== Number(line.unit_price) ||
          (edit.delivery_date && edit.delivery_date !== (line.delivery_date ? line.delivery_date.slice(0, 10) : ""))
        );
      })
      .map((line) => {
        const edit = lineEdits[line.id];
        return {
          po_line_id: line.id,
          ordered_quantity: edit.quantity,
          unit_price: edit.unit_price,
          delivery_date: edit.delivery_date || null,
        };
      });

    try {
      await amendMutation.mutateAsync({
        id: po.id,
        payload: {
          reason: amendReason,
          line_updates,
        },
      });
      setAmendModalOpen(false);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to amend purchase order");
    }
  };

  const formatCurrency = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return "0.00";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "0.00" : `${po.currency} ${num.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/purchase-orders"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Purchase Orders
        </Link>
        <div className="flex items-center gap-2">
          {po.status === "PENDING_APPROVAL" && (
            <PermissionGuard permission="po.approve">
              <Button
                variant="primary"
                size="sm"
                onClick={handleApprove}
                loading={approveMutation.isPending}
                icon={<CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              >
                Approve PO
              </Button>
            </PermissionGuard>
          )}
          {po.status === "APPROVED" && (
            <PermissionGuard permission="po.update">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendToVendor}
                loading={sendToVendorMutation.isPending}
                icon={<Send className="h-3.5 w-3.5 mr-1.5" />}
              >
                Send to Vendor
              </Button>
            </PermissionGuard>
          )}
          {(po.status === "APPROVED" ||
            po.status === "SENT_TO_VENDOR" ||
            po.status === "VENDOR_ACKNOWLEDGED" ||
            po.status === "PARTIALLY_RECEIVED" ||
            po.status === "RECEIVED") && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadPDF}
              loading={downloadPDFMutation.isPending}
              icon={<Download className="h-3.5 w-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />}
            >
              Download PDF
            </Button>
          )}
          {(po.status === "RELEASED" ||
            po.status === "APPROVED" ||
            po.status === "SENT_TO_VENDOR" ||
            po.status === "VENDOR_ACKNOWLEDGED" ||
            po.status === "PARTIALLY_RECEIVED") && (
            <PermissionGuard permission="po.update">
              <Button
                variant="secondary"
                size="sm"
                onClick={openAmendModal}
                icon={<Edit3 className="h-3.5 w-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />}
              >
                Amend PO
              </Button>
            </PermissionGuard>
          )}
          {(po.status === "SENT_TO_VENDOR" ||
            po.status === "VENDOR_ACKNOWLEDGED" ||
            po.status === "PARTIALLY_RECEIVED") && (
            <PermissionGuard permission="grn.create">
              <Link href={`/grn/new?po_id=${po.id}`}>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Truck className="h-3.5 w-3.5 mr-1.5" />}
                >
                  Create GRN
                </Button>
              </Link>
            </PermissionGuard>
          )}
          {po.status !== "CANCELLED" && po.status !== "CLOSED" && (
            <PermissionGuard permission="po.cancel">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCancelModalOpen(true)}
                icon={<XCircle className="h-3.5 w-3.5 mr-1.5" />}
              >
                Cancel PO
              </Button>
            </PermissionGuard>
          )}
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-slate-200/80 dark:border-white/10 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{po.po_number}</h1>
              {po.amendment_count > 0 && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
                  Version {po.amendment_count + 1}
                </span>
              )}
              <Badge variant={po.status.toLowerCase()}>
                {po.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-base font-medium text-slate-700 dark:text-slate-200 mt-1">{po.title}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Order Value</div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {formatCurrency(po.total_value)}
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-white/10 text-sm">
          <div>
            <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Vendor ID</span>
            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold">{po.vendor_id}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Expected Delivery</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {po.expected_delivery_date
                ? new Date(po.expected_delivery_date).toLocaleDateString()
                : "Not Specified"}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Created Date</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {po.created_at ? new Date(po.created_at).toLocaleDateString() : "—"}
            </span>
          </div>
          {po.source_pr_id ? (
            <div>
              <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Source Requisition</span>
              <Link
                href={`/requisitions/${po.source_pr_id}`}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono font-semibold inline-flex items-center gap-1 mt-0.5"
              >
                <FileText className="w-3.5 h-3.5" /> View Source PR
              </Link>
            </div>
          ) : (
            <div>
              <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Sent to Vendor</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {po.sent_at ? new Date(po.sent_at).toLocaleDateString() : "Not Sent"}
              </span>
            </div>
          )}
        </div>

        {po.vendor_rejection_reason && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-lg text-rose-800 dark:text-rose-200 text-sm">
            <span className="font-bold">Vendor Rejection Reason:</span> {po.vendor_rejection_reason}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="w-full">
        <UnderlineTabs
          tabs={[
            { id: "lines", label: `Delivery Schedule & Lines (${po.lines?.length || 0})`, icon: <Package className="h-4 w-4 shrink-0" /> },
            { id: "grn", label: `GRN Receipts (${grns.length})`, icon: <Truck className="h-4 w-4 shrink-0" /> },
            ...(po.amendments && po.amendments.length > 0
              ? [{ id: "amendments", label: `Amendments (${po.amendments.length})`, icon: <FileCheck className="h-4 w-4 shrink-0" /> }]
              : []),
            { id: "documents", label: "Documents & Attachments", icon: <FileText className="h-4 w-4 shrink-0" /> },
          ]}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as any)}
          ariaLabel="PO Tabs"
        />
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
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading GRN receipts...</div>
          ) : grns.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <Truck className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No GRNs recorded yet</h3>
              <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">Goods receipt notes will show up here as deliveries arrive.</p>
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
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-5 py-3">GRN Number</th>
                    <th scope="col" className="px-5 py-3">Challan / LR #</th>
                    <th scope="col" className="px-5 py-3">Receipt Date</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                    <th scope="col" className="px-5 py-3">Confirmed At</th>
                    <th scope="col" className="px-5 py-3 text-right">Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grns.map((grn) => (
                    <tr key={grn.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {grn.grn_number}
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                        <div>{grn.challan_number || "—"}</div>
                        {grn.transporter_name && (
                          <div className="text-xs text-slate-400">{grn.transporter_name}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                        {new Date(grn.receipt_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            grn.status === "CONFIRMED"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : grn.status === "PENDING_QC"
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {grn.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                        {grn.confirmed_at ? new Date(grn.confirmed_at).toLocaleDateString() : "Pending"}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
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
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3">Amendment #</th>
                  <th scope="col" className="px-5 py-3">Reason</th>
                  <th scope="col" className="px-5 py-3">Changed Amount</th>
                  <th scope="col" className="px-5 py-3">Re-Approval</th>
                  <th scope="col" className="px-5 py-3">Created At</th>
                  <th scope="col" className="px-5 py-3 text-right">Modifications</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {po.amendments.map((am) => {
                  const isExpanded = expandedAmendmentId === am.id;
                  const lineChanges = (am.field_changes as any)?.line_changes as Array<any> | undefined;

                  return (
                    <React.Fragment key={am.id}>
                      <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          Amendment #{am.amendment_number}
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{am.reason}</td>
                        <td className="px-5 py-4 font-mono text-slate-900 dark:text-slate-100 font-medium">
                          {formatCurrency(am.value_change)}
                        </td>
                        <td className="px-5 py-4">
                          {am.re_approval_required ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              Workflow Re-Approval
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Auto-Approved
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                          {am.created_at ? new Date(am.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {lineChanges && lineChanges.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedAmendmentId(isExpanded ? null : am.id)}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-medium"
                            >
                              <span>{isExpanded ? "Hide Line Diffs" : `${lineChanges.length} Line Change(s)`}</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && lineChanges && (
                        <tr className="bg-slate-50 dark:bg-slate-800/30">
                          <td colSpan={6} className="px-5 py-3 border-y border-slate-200 dark:border-slate-800">
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                              Line Modifications Applied:
                            </div>
                            <div className="space-y-1.5 font-mono text-xs">
                              {lineChanges.map((lc, idx) => (
                                <div key={idx} className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                                  <span className="font-bold text-slate-900 dark:text-white font-sans">Line #{lc.line_number}</span>
                                  {lc.ordered_quantity && (
                                    <span className="text-slate-600 dark:text-slate-400">
                                      Qty: <del className="text-rose-500">{lc.ordered_quantity.before}</del> &rarr; <strong className="text-emerald-600 dark:text-emerald-400">{lc.ordered_quantity.after}</strong>
                                    </span>
                                  )}
                                  {lc.unit_price && (
                                    <span className="text-slate-600 dark:text-slate-400">
                                      Price: <del className="text-rose-500">₹{lc.unit_price.before}</del> &rarr; <strong className="text-emerald-600 dark:text-emerald-400">₹{lc.unit_price.after}</strong>
                                    </span>
                                  )}
                                  {lc.delivery_date && (
                                    <span className="text-slate-600 dark:text-slate-400">
                                      Date: <del className="text-rose-500">{lc.delivery_date.before || "None"}</del> &rarr; <strong className="text-emerald-600 dark:text-emerald-400">{lc.delivery_date.after}</strong>
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cancel Purchase Order</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to cancel this purchase order? This action will set the status to CANCELLED and notify all parties.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cancellation Reason *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Provide a valid cancellation reason..."
                rows={3}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
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

      {/* ⚡ Amend PO / Change Order Modal */}
      {amendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Edit3 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Amend PO / Change Order</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Order #{po.po_number} (Amendment #{po.amendment_count + 1})</p>
                </div>
              </div>
              <button
                onClick={() => setAmendModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAmendSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amendment Reason / Change Order Justification *
                </label>
                <input
                  type="text"
                  required
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                  placeholder="e.g. Scope adjustment, unit price renegotiation, delivery schedule revision"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Line item editing table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Modify Line Items
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {(po.lines || []).map((line) => {
                    const edit = lineEdits[line.id] || {
                      quantity: Number(line.ordered_quantity),
                      unit_price: Number(line.unit_price),
                      delivery_date: line.delivery_date ? line.delivery_date.slice(0, 10) : "",
                    };
                    const received = Number(line.received_quantity || 0);

                    return (
                      <div key={line.id} className="p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between font-medium text-slate-900 dark:text-white">
                          <span>Line #{line.line_number}: {line.item_description}</span>
                          <span className="text-slate-400 text-[11px]">
                            Received: <strong className="text-slate-700 dark:text-slate-300">{received}</strong> | Open: {Number(line.open_quantity || 0)}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase font-semibold">Ordered Quantity</label>
                            <input
                              type="number"
                              min={received}
                              step="any"
                              value={edit.quantity}
                              onChange={(e) =>
                                setLineEdits((prev) => ({
                                  ...prev,
                                  [line.id]: { ...edit, quantity: parseFloat(e.target.value) || 0 },
                                }))
                              }
                              className="w-full mt-1 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-800 font-mono"
                            />
                            {edit.quantity < received && (
                              <span className="text-[10px] text-rose-500 block mt-0.5">Cannot be below received ({received})</span>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase font-semibold">Unit Price ({po.currency})</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={edit.unit_price}
                              onChange={(e) =>
                                setLineEdits((prev) => ({
                                  ...prev,
                                  [line.id]: { ...edit, unit_price: parseFloat(e.target.value) || 0 },
                                }))
                              }
                              className="w-full mt-1 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-800 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase font-semibold">Delivery Date</label>
                            <input
                              type="date"
                              value={edit.delivery_date}
                              onChange={(e) =>
                                setLineEdits((prev) => ({
                                  ...prev,
                                  [line.id]: { ...edit, delivery_date: e.target.value },
                                }))
                              }
                              className="w-full mt-1 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs bg-white dark:bg-slate-800"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial Impact & Re-Approval Warning */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600 dark:text-slate-300 font-sans">
                  <span>Current Order Total:</span>
                  <span>{formatCurrency(currentTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-900 dark:text-white font-bold font-sans">
                  <span>Revised Projected Total:</span>
                  <span>{formatCurrency(projectedTotal)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1">
                  <span className="font-sans text-slate-600 dark:text-slate-300">Net Delta:</span>
                  <span className={`font-bold ${totalDelta >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {totalDelta >= 0 ? "+" : ""}{formatCurrency(totalDelta)} ({deltaPct.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {willTriggerReapproval && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <span className="text-base">⚠️</span>
                  <div>
                    <strong className="font-semibold block">Major Amendment Notice (&gt; 10% Threshold):</strong>
                    This change alters the total purchase order value by {deltaPct.toFixed(1)}%. Per organizational policy, saving this amendment will reset PO status to <strong>PENDING_APPROVAL</strong> and re-route through the approval chain.
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAmendModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={!amendReason.trim() || amendMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2"
                >
                  {amendMutation.isPending ? "Submitting Change Order..." : "Apply & Commit Amendment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
