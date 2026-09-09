"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useRequisition,
  useSubmitRequisition,
  useWithdrawRequisition,
  useConvertToRFQ,
  useConvertToPO,
  usePRAuditTrail,
  useSplitRequisition,
} from "@procurement/hooks";
import {
  WorkflowTimeline,
  PRLineItemTable,
  BudgetIndicator,
  PermissionGuard,
  UnderlineTabs,
  Button,
  Badge,
  Card,
} from "@procurement/ui";
import {
  CheckCircle2,
  Send,
  XCircle,
  ShoppingCart,
  TrendingDown,
  Split,
  ArrowRight,
  ArrowLeft,
  FileText,
} from "lucide-react";

export default function RequisitionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: pr, isLoading, isError, refetch } = useRequisition(id);
  const { data: auditLogs } = usePRAuditTrail(id);

  const submitMutation = useSubmitRequisition();
  const withdrawMutation = useWithdrawRequisition();
  const rfqMutation = useConvertToRFQ();
  const poMutation = useConvertToPO();
  const splitMutation = useSplitRequisition();

  const [activeTab, setActiveTab] = useState<"lines" | "audit">("lines");
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitCategoryId, setSplitCategoryId] = useState("");
  const [splitLines, setSplitLines] = useState<number[]>([]);

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center text-gray-500">
        Loading requisition details...
      </div>
    );
  }

  if (isError || !pr) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center space-y-4">
        <p className="text-red-600 font-semibold">Requisition not found or access denied.</p>
        <Link href="/requisitions" className="text-blue-600 text-sm hover:underline">
          ← Back to Requisitions
        </Link>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!confirm("Submit this requisition for approval?")) return;
    try {
      await submitMutation.mutateAsync(pr.id);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to submit PR");
    }
  };

  const handleWithdraw = async () => {
    if (!confirm("Are you sure you want to withdraw this requisition?")) return;
    try {
      await withdrawMutation.mutateAsync(pr.id);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to withdraw PR");
    }
  };

  const handleConvertToRFQ = async () => {
    try {
      await rfqMutation.mutateAsync(pr.id);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to convert to RFQ");
    }
  };

  const handleConvertToPO = async () => {
    try {
      const res = await poMutation.mutateAsync(pr.id);
      refetch();
      if (res?.po_id) {
        router.push(`/purchase-orders/${res.po_id}`);
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to convert to PO");
    }
  };

  const handleSplitSubmit = async () => {
    if (splitLines.length === 0 || !splitCategoryId) {
      alert("Please select category and lines to split");
      return;
    }
    const remainingLines = pr.lines
      .map((l) => l.line_number)
      .filter((n) => !splitLines.includes(n));

    if (remainingLines.length === 0) {
      alert("Cannot split all lines away without remaining items");
      return;
    }

    try {
      await splitMutation.mutateAsync({
        id: pr.id,
        payload: {
          splits: [
            { category_id: splitCategoryId, line_numbers: splitLines, title: `${pr.title} (Split Part A)` },
            { category_id: pr.category_id, line_numbers: remainingLines, title: `${pr.title} (Split Part B)` },
          ],
        },
      });
      setShowSplitModal(false);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to split PR");
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 pb-4">
        <div>
          <Link
            href="/requisitions"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mb-1 inline-flex items-center gap-1 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Requisitions List
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{pr.title}</h1>
            <Badge variant={pr.status.toLowerCase()}>
              {pr.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {pr.status === "DRAFT" && (
            <>
              <PermissionGuard permission="pr.submit">
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  loading={submitMutation.isPending}
                  icon={<Send className="w-4 h-4 mr-1.5" />}
                >
                  Submit for Approval
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="pr.cancel">
                <Button
                  variant="secondary"
                  onClick={handleWithdraw}
                  disabled={withdrawMutation.isPending}
                  icon={<XCircle className="w-4 h-4 mr-1.5" />}
                >
                  Withdraw
                </Button>
              </PermissionGuard>
            </>
          )}

          {["SUBMITTED", "PENDING_APPROVAL"].includes(pr.status) && (
            <PermissionGuard permission="pr.cancel">
              <Button
                variant="destructive"
                onClick={handleWithdraw}
                loading={withdrawMutation.isPending}
                icon={<XCircle className="w-4 h-4 mr-1.5" />}
              >
                Withdraw Requisition
              </Button>
            </PermissionGuard>
          )}

          {pr.status === "APPROVED" && (
            <>
              <PermissionGuard permission="rfq.create">
                <Button
                  variant="secondary"
                  onClick={handleConvertToRFQ}
                  loading={rfqMutation.isPending}
                  icon={<TrendingDown className="w-4 h-4 mr-1.5 text-purple-500" />}
                >
                  Convert to RFQ
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="po.create">
                <Button
                  variant="primary"
                  onClick={handleConvertToPO}
                  loading={poMutation.isPending}
                  icon={<ShoppingCart className="w-4 h-4 mr-1.5" />}
                >
                  Convert to PO
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="pr.create">
                <Button
                  variant="ghost"
                  onClick={() => setShowSplitModal(true)}
                  icon={<Split className="w-4 h-4 mr-1.5" />}
                >
                  Split PR
                </Button>
              </PermissionGuard>
            </>
          )}

          {pr.status === "CONVERTED" && pr.po_id && (
            <Link href={`/purchase-orders/${pr.po_id}`}>
              <Button variant="primary" icon={<ShoppingCart className="w-4 h-4 mr-1.5" />}>
                View Purchase Order
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* PO Conversion Success Banner */}
      {pr.status === "CONVERTED" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-xl gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Requisition Converted to Purchase Order
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Purchase Order {pr.po_number ? <span className="font-mono font-semibold">{pr.po_number}</span> : "has been created"} and forwarded to procurement operations.
              </p>
            </div>
          </div>
          {pr.po_id && (
            <Link href={`/purchase-orders/${pr.po_id}`}>
              <Button variant="secondary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5 ml-1.5" />}>
                Open PO Details
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Lifecycle Workflow Timeline */}
      <WorkflowTimeline currentStatus={pr.status} />

      {/* Grid: Details & Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Header Metadata */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1C1C1F] p-6 rounded-xl border border-slate-200 dark:border-white/15 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-white/10 pb-2">Requisition Information</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">PR Number</span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{pr.pr_number}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Procurement Type</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{pr.procurement_type}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Currency</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{pr.currency}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Estimated Value</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                {pr.currency} {Number(pr.estimated_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Required By Date</span>
              <span className="text-slate-900 dark:text-slate-100">{pr.required_by_date ? new Date(pr.required_by_date).toLocaleDateString() : "—"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Created At</span>
              <span className="text-slate-900 dark:text-slate-100">{new Date(pr.created_at).toLocaleString()}</span>
            </div>
          </div>
          {pr.description && (
            <div className="pt-2 border-t border-slate-100 dark:border-white/10">
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-medium">Description</span>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#252529] p-3 rounded-lg border border-slate-200 dark:border-white/10">{pr.description}</p>
            </div>
          )}
        </div>

        {/* Budget Check Card */}
        <div>
          <BudgetIndicator
            estimatedTotal={Number(pr.estimated_value)}
            availableBudget={500000}
            budgetStatus={pr.budget_check_status}
            currency={pr.currency}
          />
        </div>
      </div>

      {/* Tabs: Line Items & Audit Trail */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 shadow-sm overflow-hidden">
        <UnderlineTabs
          tabs={[
            { id: "lines", label: "Line Items", badge: pr.lines?.length || 0 },
            { id: "audit", label: "Audit Trail", badge: auditLogs?.length || 0 },
          ]}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as any)}
          ariaLabel="Requisition Detail Tabs"
        />

        <div className="p-6">
          {activeTab === "lines" ? (
            <PRLineItemTable lines={pr.lines || []} currency={pr.currency} editable={false} />
          ) : (
            <div className="space-y-4">
              {!auditLogs || auditLogs.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">No audit history recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/10">
                  {auditLogs.map((log: any) => (
                    <div key={log.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{log.action}</span>
                        {log.actor_email && <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">by {log.actor_email}</span>}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Split Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-slate-200/80 dark:border-white/10 max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Split Requisition</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select line numbers and target category to branch off into a separate child PR.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Category ID
              </label>
              <input
                type="text"
                placeholder="Target Category UUID..."
                value={splitCategoryId}
                onChange={(e) => setSplitCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/15 rounded-lg bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Select Lines to Split
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-white/10 p-2.5 rounded-lg bg-slate-50/30 dark:bg-white/[0.02]">
                {pr.lines.map((line) => (
                  <label key={line.line_number} className="flex items-center gap-2.5 text-sm p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={splitLines.includes(line.line_number)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSplitLines([...splitLines, line.line_number]);
                        } else {
                          setSplitLines(splitLines.filter((n) => n !== line.line_number));
                        }
                      }}
                      className="rounded border-slate-300 dark:border-white/20 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      Line #{line.line_number}: {line.item_description} (Qty: {line.quantity})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/10">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowSplitModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSplitSubmit}
                loading={splitMutation.isPending}
                icon={<Split className="w-4 h-4 mr-1.5" />}
              >
                Confirm Split
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
