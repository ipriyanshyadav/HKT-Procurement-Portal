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
} from "@procurement/ui";

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
      await poMutation.mutateAsync(pr.id);
      refetch();
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <nav className="text-xs text-gray-500 mb-1">
            <Link href="/requisitions" className="hover:underline">Requisitions</Link>
            <span className="mx-2">/</span>
            <span className="font-mono text-gray-700">{pr.pr_number}</span>
          </nav>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{pr.title}</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
              {pr.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {pr.status === "DRAFT" && (
            <>
              <button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit for Approval"}
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawMutation.isPending}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
              >
                Withdraw
              </button>
            </>
          )}

          {["SUBMITTED", "PENDING_APPROVAL"].includes(pr.status) && (
            <button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-lg transition-colors"
            >
              {withdrawMutation.isPending ? "Withdrawing..." : "Withdraw Requisition"}
            </button>
          )}

          {pr.status === "APPROVED" && (
            <>
              <button
                onClick={handleConvertToRFQ}
                disabled={rfqMutation.isPending}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                {rfqMutation.isPending ? "Converting..." : "Convert to RFQ"}
              </button>
              <button
                onClick={handleConvertToPO}
                disabled={poMutation.isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                {poMutation.isPending ? "Converting..." : "Convert to PO"}
              </button>
              <button
                onClick={() => setShowSplitModal(true)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
              >
                Split PR
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lifecycle Workflow Timeline */}
      <WorkflowTimeline currentStatus={pr.status} />

      {/* Grid: Details & Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Header Metadata */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900 border-b pb-2">Requisition Information</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-500 block">PR Number</span>
              <span className="font-mono font-medium text-gray-900">{pr.pr_number}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Procurement Type</span>
              <span className="font-medium text-gray-900">{pr.procurement_type}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Currency</span>
              <span className="font-medium text-gray-900">{pr.currency}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Estimated Value</span>
              <span className="font-semibold text-gray-900">
                {pr.currency} {Number(pr.estimated_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Required By Date</span>
              <span className="text-gray-900">{pr.required_by_date ? new Date(pr.required_by_date).toLocaleDateString() : "—"}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Created At</span>
              <span className="text-gray-900">{new Date(pr.created_at).toLocaleString()}</span>
            </div>
          </div>
          {pr.description && (
            <div className="pt-2 border-t">
              <span className="text-xs text-gray-500 block mb-1">Description</span>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">{pr.description}</p>
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab("lines")}
            className={`py-3.5 px-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "lines"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Line Items ({pr.lines?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`py-3.5 px-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "audit"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Audit Trail ({auditLogs?.length || 0})
          </button>
        </div>

        <div className="p-6">
          {activeTab === "lines" ? (
            <PRLineItemTable lines={pr.lines || []} currency={pr.currency} editable={false} />
          ) : (
            <div className="space-y-4">
              {!auditLogs || auditLogs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No audit history recorded yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {auditLogs.map((log: any) => (
                    <div key={log.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-semibold text-gray-800">{log.action}</span>
                        {log.actor_email && <span className="text-xs text-gray-500 ml-2">by {log.actor_email}</span>}
                      </div>
                      <span className="text-xs text-gray-400">
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Split Requisition</h3>
            <p className="text-sm text-gray-500">
              Select line numbers and target category to branch off into a separate child PR.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Target Category ID
              </label>
              <input
                type="text"
                placeholder="Target Category UUID..."
                value={splitCategoryId}
                onChange={(e) => setSplitCategoryId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Select Lines to Split
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto border p-2 rounded-lg">
                {pr.lines.map((line) => (
                  <label key={line.line_number} className="flex items-center gap-2 text-sm">
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
                    />
                    <span>
                      Line #{line.line_number}: {line.item_description} (Qty: {line.quantity})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSplitModal(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSplitSubmit}
                disabled={splitMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
              >
                {splitMutation.isPending ? "Splitting..." : "Confirm Split"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
