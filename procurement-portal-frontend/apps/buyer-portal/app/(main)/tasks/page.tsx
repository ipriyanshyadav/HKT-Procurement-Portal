"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useMyWorkflowTasks,
  useBatchApproveTasks,
  useMyDelegations,
  useCreateDelegation,
  useDeleteDelegation,
  useUsers,
} from "@procurement/hooks";
import { SLAIndicator } from "@procurement/ui";
import {
  CheckCircle2,
  Clock,
  Calendar,
  UserCheck,
  X,
  Trash2,
  ShieldCheck,
  CheckSquare,
  Square,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

function EntityTypeBadge({ entityType }: { entityType: string }) {
  const colorMap: Record<string, string> = {
    REQUISITION: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    RFQ: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    PURCHASE_ORDER: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    VENDOR: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    CONTRACT: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    INVOICE: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    AWARD: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  };
  const cls = colorMap[entityType] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {entityType.replace("_", " ")}
    </span>
  );
}

function StepBadge({ stepNumber, role }: { stepNumber: number; role: string | null }) {
  return (
    <span className="text-xs text-gray-500 dark:text-gray-400">
      Step {stepNumber}{role ? ` · ${role}` : ""}
    </span>
  );
}

/**
 * Workflow Task Inbox — shows all pending approval tasks assigned to the current user.
 * Supports:
 * 1. Multi-select Batch Approval
 * 2. Out of Office / Approval Delegation Rules
 */
export default function TasksPage() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const { data, isLoading, isError, refetch } = useMyWorkflowTasks({
    page,
    page_size: PAGE_SIZE,
  });

  const tasks = data?.tasks ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / PAGE_SIZE) : 1;

  // Selection & Batch Approval state
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchComment, setBatchComment] = useState("Batch approved");
  const batchApproveMutation = useBatchApproveTasks();

  // Out of Office / Delegation state
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [delegateId, setDelegateId] = useState("");
  const [delegationReason, setDelegationReason] = useState("");
  const [validFrom, setValidFrom] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 16);
  });
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [delegationError, setDelegationError] = useState<string | null>(null);

  const { data: delegations = [], refetch: refetchDelegations } = useMyDelegations();
  const { data: users = [] } = useUsers();
  const createDelegationMutation = useCreateDelegation();
  const deleteDelegationMutation = useDeleteDelegation();

  const handleToggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.length === tasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(tasks.map((t) => t.id));
    }
  };

  const handleBatchApproveSubmit = async () => {
    const selectedTasks = tasks.filter((t) => selectedTaskIds.includes(t.id));
    if (selectedTasks.length === 0) return;

    try {
      await batchApproveMutation.mutateAsync(
        selectedTasks.map((t) => ({
          instanceId: t.workflow_instance_id,
          taskId: t.id,
          comment: batchComment || "Batch approved",
        }))
      );
      setSelectedTaskIds([]);
      setShowBatchModal(false);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to batch approve selected tasks");
    }
  };

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateId) {
      setDelegationError("Please select a delegate user.");
      return;
    }
    if (!delegationReason.trim()) {
      setDelegationError("Please provide a reason for delegation.");
      return;
    }

    try {
      setDelegationError(null);
      await createDelegationMutation.mutateAsync({
        delegate_id: delegateId,
        reason: delegationReason.trim(),
        valid_from: new Date(validFrom).toISOString(),
        valid_until: new Date(validUntil).toISOString(),
      });
      setDelegateId("");
      setDelegationReason("");
      refetchDelegations();
    } catch (err: any) {
      setDelegationError(
        err?.response?.data?.error?.message || err?.message || "Failed to create delegation rule."
      );
    }
  };

  const handleDeleteDelegation = async (ruleId: string) => {
    if (!confirm("Revoke this delegation rule?")) return;
    try {
      await deleteDelegationMutation.mutateAsync(ruleId);
      refetchDelegations();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to revoke delegation.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto" aria-label="Loading tasks" aria-busy="true">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-4xl mx-auto" role="alert">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Failed to load tasks. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header and Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-indigo-600" />
            Approval Inbox
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {meta?.total ?? 0} pending task{(meta?.total ?? 0) !== 1 ? "s" : ""} awaiting your action
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/tasks/delegation"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 shadow-xs transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Delegation & SoD Matrix
          </Link>

          <button
            onClick={() => setShowDelegationModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors"
          >
            <UserCheck className="w-4 h-4 text-indigo-600" />
            Quick Out of Office
            {delegations.some((d) => d.is_active) && (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Active delegation enabled" />
            )}
          </button>

          {selectedTaskIds.length > 0 && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Batch Approve ({selectedTaskIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Select All Toolbar */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={tasks.length > 0 && selectedTaskIds.length === tasks.length}
              onChange={handleSelectAll}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            Select All on this page
          </label>
          {selectedTaskIds.length > 0 && (
            <button
              onClick={() => setSelectedTaskIds([])}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
            >
              Clear selection
            </button>
          )}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <div className="text-4xl mb-3" aria-hidden="true">✅</div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">All caught up!</p>
          <p className="text-gray-400 text-sm mt-1">No pending approvals at this time.</p>
        </div>
      ) : (
        <ul role="list" className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow ring-1 ring-gray-200 dark:ring-slate-800 overflow-hidden">
          {tasks.map((task) => {
            const isSelected = selectedTaskIds.includes(task.id);
            return (
              <li key={task.id} className={`transition-colors ${isSelected ? "bg-indigo-50/40 dark:bg-indigo-950/20" : "hover:bg-gray-50 dark:hover:bg-slate-800/50"}`}>
                <div className="flex items-start gap-3 p-4">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleTask(task.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      aria-label={`Select task ${task.id}`}
                    />
                  </div>

                  <Link
                    href={`/tasks/${task.id}`}
                    className="flex-1 flex items-start gap-4 min-w-0"
                    aria-label={`Task ${task.id} — Step ${task.step_number}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <StepBadge stepNumber={task.step_number} role={task.assigned_role} />
                        <span className="text-xs text-gray-400">
                          {new Date(task.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        Approval Task #{task.id.slice(0, 8)}…
                      </p>

                      <div className="mt-2">
                        <SLAIndicator
                          slaDeadline={task.sla_deadline}
                          createdAt={task.created_at}
                          slaStatus={task.sla_status}
                        />
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center self-center text-gray-400 text-sm pr-2">
                      ›
                    </div>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="relative inline-flex items-center rounded-xl bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="relative inline-flex items-center rounded-xl bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </nav>
      )}

      {/* Batch Approval Confirmation Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Batch Approve Tasks
              </h3>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              You are about to approve <strong>{selectedTaskIds.length}</strong> selected tasks simultaneously.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Approval Remarks / Comments
              </label>
              <textarea
                value={batchComment}
                onChange={(e) => setBatchComment(e.target.value)}
                rows={3}
                placeholder="Enter approval comments..."
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBatchApproveSubmit}
                disabled={batchApproveMutation.isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 flex items-center gap-2"
              >
                {batchApproveMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Out of Office / Delegations Modal */}
      {showDelegationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 dark:border-slate-800 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-600" />
                  Out of Office & Delegations
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Temporarily transfer approval authority while away on leave.
                </p>
              </div>
              <button
                onClick={() => setShowDelegationModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing Active Delegations */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active & Upcoming Delegations
              </h4>
              {delegations.length === 0 ? (
                <div className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                  No active approval delegations configured.
                </div>
              ) : (
                <div className="space-y-2">
                  {delegations.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                          <span>{rule.delegate_name || rule.delegate_email || rule.delegate_id}</span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              rule.is_active
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {rule.is_active ? "Active" : "Revoked"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(rule.valid_from).toLocaleString()} → {new Date(rule.valid_until).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                          &ldquo;{rule.reason}&rdquo;
                        </p>
                      </div>

                      {rule.is_active && (
                        <button
                          onClick={() => handleDeleteDelegation(rule.id)}
                          className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create New Delegation Rule Form */}
            <form onSubmit={handleCreateDelegation} className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Set New Delegation
              </h4>

              {delegationError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {delegationError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Select Delegate User
                  </label>
                  <select
                    value={delegateId}
                    onChange={(e) => setDelegateId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Choose a colleague to delegate to...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Valid From
                  </label>
                  <input
                    type="datetime-local"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="datetime-local"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Reason / Remarks
                  </label>
                  <input
                    type="text"
                    value={delegationReason}
                    onChange={(e) => setDelegationReason(e.target.value)}
                    placeholder="e.g. Annual leave / out of office"
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDelegationModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={createDelegationMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 flex items-center gap-2"
                >
                  {createDelegationMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Delegation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
