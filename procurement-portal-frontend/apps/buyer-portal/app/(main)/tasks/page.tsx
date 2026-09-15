"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  useMyWorkflowTasks,
  useBatchApproveTasks,
  useMyDelegations,
  useCreateDelegation,
  useDeleteDelegation,
  useUsers,
  useAppToast,
  getErrorMessage,
} from "@procurement/hooks";
import { SLAIndicator, useConfirm } from "@procurement/ui";

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
  Search,
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

function getEntityUrl(entityType?: string | null, entityId?: string | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType.toUpperCase()) {
    case "REQUISITION": return `/requisitions/${entityId}`;
    case "RFQ": return `/rfqs/${entityId}`;
    case "PURCHASE_ORDER":
    case "PO": return `/purchase-orders/${entityId}`;
    case "INVOICE": return `/invoices/${entityId}`;
    case "CONTRACT": return `/contracts/${entityId}`;
    case "VENDOR": return `/vendors/${entityId}`;
    default: return null;
  }
}

/**
 * Workflow Task Inbox — shows all pending approval tasks assigned to the current user.
 * Supports:
 * 1. Multi-select Batch Approval
 * 2. Out of Office / Approval Delegation Rules
 */
export default function TasksPage() {
  const { toast } = useAppToast();
  const confirm = useConfirm();
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

  // Filter & Search states — defined before handleSelectAll so filteredTasks is accessible
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTasks = tasks.filter((t) => {
    if (filterType !== "ALL" && t.entity_type?.toUpperCase() !== filterType) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.title?.toLowerCase().includes(query) ||
      t.entity_number?.toLowerCase().includes(query) ||
      t.raised_by_name?.toLowerCase().includes(query) ||
      t.department?.toLowerCase().includes(query) ||
      t.id.toLowerCase().includes(query)
    );
  });

  // Clear selection whenever filter or search changes to prevent stale batch operations
  useEffect(() => {
    setSelectedTaskIds([]);
  }, [filterType, searchQuery]);

  const handleSelectAll = () => {
    if (selectedTaskIds.length === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t.id));
    }
  };

  const handleBatchApproveSubmit = async () => {
    const selectedTasks = filteredTasks.filter((t) => selectedTaskIds.includes(t.id));
    if (selectedTasks.length === 0 || batchApproveMutation.isPending) return;

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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to batch approve selected tasks"));
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
    if (new Date(validUntil) <= new Date(validFrom)) {
      setDelegationError("End date must be after start date.");
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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create delegation rule."));
    }
  };

  const handleDeleteDelegation = async (ruleId: string) => {
    const ok = await confirm({
      title: "Revoke Delegation",
      description: "Are you sure you want to revoke this approval delegation rule?",
      confirmLabel: "Revoke",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await deleteDelegationMutation.mutateAsync(ruleId);
      refetchDelegations();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to revoke delegation."));
    }
  };


  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-6xl mx-auto" role="alert">
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            Failed to load tasks. Please refresh the page.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 rounded-xl hover:bg-red-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header and Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400">
              <CheckSquare className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Approval Inbox
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {meta?.total ?? tasks.length} Pending
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review, authorize, or return procurement workflows assigned to your approval tier.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <Link
            href="/tasks/delegation"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 shadow-xs transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            SoD Matrix & Rules
          </Link>

          <button
            onClick={() => setShowDelegationModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-xs transition-colors"
          >
            <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Out of Office
            {delegations.some((d) => d.is_active) && (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active delegation enabled" />
            )}
          </button>

          {selectedTaskIds.length > 0 && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors animate-in fade-in"
            >
              <CheckCircle2 className="w-4 h-4" />
              Batch Approve ({selectedTaskIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/90 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Type pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { label: "All Tasks", value: "ALL" },
            { label: "Requisitions", value: "REQUISITION" },
            { label: "Purchase Orders", value: "PURCHASE_ORDER" },
            { label: "Invoices", value: "INVOICE" },
            { label: "RFQs", value: "RFQ" },
          ].map((tab) => {
            const isActive = filterType === tab.value;
            const count = tab.value === "ALL" 
              ? tasks.length 
              : tasks.filter(t => t.entity_type?.toUpperCase() === tab.value).length;
            return (
              <button
                key={tab.value}
                onClick={() => setFilterType(tab.value)}
                aria-pressed={isActive}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Search tasks, IDs, users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="absolute left-3 top-2 text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Select All Toolbar */}
      {filteredTasks.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={filteredTasks.length > 0 && selectedTaskIds.length === filteredTasks.length}
              onChange={handleSelectAll}
              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
            />
            <span>Select all {filteredTasks.length} visible items</span>
          </label>
          {selectedTaskIds.length > 0 && (
            <button
              onClick={() => setSelectedTaskIds([])}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              Clear selection ({selectedTaskIds.length})
            </button>
          )}
        </div>
      )}

      {/* Empty State */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center mx-auto mb-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-slate-800 dark:text-white font-bold text-base">All Caught Up!</p>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 max-w-sm mx-auto">
            {searchQuery || filterType !== "ALL"
              ? "No pending approvals match your filter or search criteria."
              : "There are no pending approvals awaiting your sign-off at this time."}
          </p>
          {(searchQuery || filterType !== "ALL") && (
            <button
              onClick={() => { setFilterType("ALL"); setSearchQuery(""); }}
              className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* Modern Cards Grid */
        <div className="grid grid-cols-1 gap-4">
          {filteredTasks.map((task) => {
            const isSelected = selectedTaskIds.includes(task.id);
            const entityUrl = getEntityUrl(task.entity_type, task.entity_id);
            const initials = task.raised_by_name
              ? task.raised_by_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
              : "PR";

            return (
              <div
                key={task.id}
                className={`relative group bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-150 p-5 shadow-xs hover:shadow-md ${
                  isSelected
                    ? "border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20"
                    : "border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Selection + Document Info */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleTask(task.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer mt-1"
                        aria-label={`Select task ${task.id}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Top Badges Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.entity_type && <EntityTypeBadge entityType={task.entity_type} />}
                        {task.entity_number && (
                          entityUrl ? (
                            <Link
                              href={entityUrl}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50/80 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-200/80 dark:border-indigo-800"
                            >
                              {task.entity_number}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                              {task.entity_number}
                            </span>
                          )
                        )}
                        <StepBadge stepNumber={task.step_number} role={task.assigned_role} />
                        {task.priority && (
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold tracking-wider rounded-md uppercase ${
                              task.priority === "CRITICAL"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                                : task.priority === "HIGH"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {task.priority}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-mono ml-auto">
                          {new Date(task.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>

                      {/* Title */}
                      <Link href={`/tasks/${task.id}`} className="block">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {task.title || `Approval Task #${task.id.slice(0, 8)}`}
                        </h2>
                      </Link>

                      {/* Requester & Dept meta */}
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center">
                            {initials}
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {task.raised_by_name || "Procurement Specialist"}
                          </span>
                          {task.raised_by_email && (
                            <span className="text-slate-400 text-[11px] hidden sm:inline">({task.raised_by_email})</span>
                          )}
                        </div>

                        {task.department && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px]">
                            {task.department}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Financial Amount, SLA, and Action Button */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="text-left lg:text-right">
                      {task.total_amount !== null && task.total_amount !== undefined ? (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">Total Value</span>
                          <span className="font-mono text-base font-extrabold text-slate-900 dark:text-white">
                            {task.currency === "INR" || !task.currency ? "₹" : task.currency}{" "}
                            {Number(task.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">No monetary value</div>
                      )}
                    </div>

                    <div className="w-full lg:w-48">
                      <SLAIndicator
                        slaDeadline={task.sla_deadline}
                        createdAt={task.created_at}
                        slaStatus={task.sla_status}
                      />
                    </div>

                    <Link
                      href={`/tasks/${task.id}`}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors shrink-0"
                    >
                      Review & Decide →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-between pt-2" aria-label="Pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center rounded-xl bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center rounded-xl bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
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
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto overscroll-contain apple-scroll-container">
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
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
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
