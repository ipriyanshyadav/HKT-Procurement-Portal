"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useWorkflowInstance,
  useMyWorkflowTasks,
  useApproveTask,
  useRejectTask,
  useReturnTask,
} from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import { SLAIndicator, PermissionGuard } from "@procurement/ui";

import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  Calendar,
  User,
  Building2,
  Clock,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Layers,
  Send,
  RefreshCw,
} from "lucide-react";

type ActionType = "approve" | "reject" | "return" | null;

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800",
    CANCELLED: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    PAUSED: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    PENDING_RULE_RESOLUTION: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  };
  const cls = colorMap[status] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${cls}`}>
      {status.replace(/_/g, " ")}
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
 * Task Detail Page — shows workflow instance info + task action panel.
 * Approve / Reject / Return actions with comment input.
 * Protected: only the assigned user can act (enforced at API level too).
 */
export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.taskId as string;

  const { permissions } = useAuthStore();

  const [action, setAction] = useState<ActionType>("approve");
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Find the task from the user's pending tasks list
  const { data: tasksData, isLoading: tasksLoading } = useMyWorkflowTasks();
  const task = tasksData?.tasks?.find((t) => t.id === taskId);

  const instanceId = task?.workflow_instance_id ?? "";
  const { data: instance, isLoading: instanceLoading } = useWorkflowInstance(instanceId);

  const approveMutation = useApproveTask(instanceId, taskId);
  const rejectMutation = useRejectTask(instanceId, taskId);
  const returnMutation = useReturnTask(instanceId, taskId);

  const isSubmitting =
    approveMutation.isPending || rejectMutation.isPending || returnMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!action || !task || isSubmitting) return;

    setSubmitError(null);
    const payload = { comment };

    try {
      if (action === "approve") {
        await approveMutation.mutateAsync(payload);
      } else if (action === "reject") {
        await rejectMutation.mutateAsync(payload);
      } else if (action === "return") {
        await returnMutation.mutateAsync(payload);
      }
      router.push("/tasks");
    } catch (err) {
      setSubmitError("Failed to submit action. Please try again.");
    }
  }

  if (tasksLoading || instanceLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-40 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
          <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!task && !instanceLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto" role="alert">
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Task not found or is no longer assigned to you.
          </p>
          <Link
            href="/tasks"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl hover:bg-indigo-100 transition-colors"
          >
            ← Return to Approval Inbox
          </Link>
        </div>
      </div>
    );
  }

  const entityUrl = task ? getEntityUrl(task.entity_type, task.entity_id) : null;
  const initials = task?.raised_by_name
    ? task.raised_by_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "PR";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Approval Inbox
        </Link>
      </div>

      {/* Main Header Card */}
      {task && (
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {task.entity_type && (
                  <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {task.entity_type.replace(/_/g, " ")}
                  </span>
                )}
                {task.entity_number && (
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    {task.entity_number}
                  </span>
                )}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700">
                  Step {task.step_number}{task.assigned_role ? ` · ${task.assigned_role}` : ""}
                </span>
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
              </div>

              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {task.title || `Approval Task #${task.id.slice(0, 8)}`}
              </h1>
            </div>

            {entityUrl && (
              <Link
                href={entityUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-colors shrink-0"
              >
                <span>View Full Source Document</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Context & Workflow Progress */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Metrics & Requester */}
          {task && (
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Financial & Requester Context
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Total Value Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Authorization Amount
                  </span>
                  <p className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
                    {task.total_amount !== null && task.total_amount !== undefined ? (
                      <>
                        {task.currency === "INR" || !task.currency ? "₹" : task.currency}{" "}
                        {Number(task.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </>
                    ) : (
                      "N/A (Non-financial)"
                    )}
                  </p>
                </div>

                {/* Requester Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Requested By
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {task.raised_by_name || "Procurement User"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {task.raised_by_email || task.department || "Organization Staff"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Department</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {task.department || "Central Procurement"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Submitted On</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(task.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Workflow Tier</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {task.assigned_role || "Designated Approver"}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Workflow Progression & Audit Instance */}
          {instance && (
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Workflow Instance Execution
                  </h2>
                </div>
                <StatusBadge status={instance.status} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block mb-0.5">Current Step</span>
                  <span className="font-bold text-slate-900 dark:text-white">#{instance.current_step_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Started At</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {new Date(instance.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {instance.completed_at && (
                  <div>
                    <span className="text-slate-400 block mb-0.5">Completed</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {new Date(instance.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* SLA Tracking Indicator */}
          {task && (
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  SLA Target & Turnaround
                </h2>
              </div>
              <SLAIndicator
                slaDeadline={task.sla_deadline}
                createdAt={task.created_at}
                slaStatus={task.sla_status}
              />
            </section>
          )}
        </div>

        {/* Right Column: Decision Action Panel */}
        <div className="space-y-6">
          {task && task.status === "PENDING" && (!instance || instance.status === "ACTIVE") ? (
            <PermissionGuard permission={["pr.approve", "pr.reject", "workflow.update"]}>
              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-md space-y-5 sticky top-24">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Authorize Decision
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Actions are logged with your user signature.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Action Selector Cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAction("approve")}
                      className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-xs font-bold border transition-all ${
                        action === "approve"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span>Approve</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAction("return")}
                      className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-xs font-bold border transition-all ${
                        action === "return"
                          ? "bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20"
                          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <span>Return</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAction("reject")}
                      className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-xs font-bold border transition-all ${
                        action === "reject"
                          ? "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-300 ring-2 ring-rose-500/20"
                          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      <span>Reject</span>
                    </button>
                  </div>

                  {/* Comment box */}
                  <div className="space-y-1.5">
                    <label htmlFor="comment" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {action === "approve"
                        ? "Approval Remarks (Optional)"
                        : action === "return"
                        ? "Reason for Revision / Return (Mandatory)"
                        : "Rejection Rationale (Mandatory)"}
                    </label>
                    <textarea
                      id="comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      required={action === "reject" || action === "return"}
                      maxLength={2000}
                      placeholder={
                        action === "approve"
                          ? "e.g. Budget verified and approved per procurement policy..."
                          : action === "return"
                          ? "e.g. Please attach competitive vendor quotes before re-submitting..."
                          : "e.g. Total quote exceeds departmental quarterly allocation..."
                      }
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  {/* Error display */}
                  {submitError && (
                    <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!action || isSubmitting}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                      action === "approve"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : action === "return"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-rose-600 hover:bg-rose-700"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting Decision...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          Confirm {action === "approve" ? "Approval" : action === "return" ? "Return" : "Rejection"}
                        </span>
                      </>
                    )}
                  </button>
                </form>
              </section>
            </PermissionGuard>
          ) : (
            <section className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Decision Status
              </span>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                This task has been finalized: <span className="text-indigo-600 dark:text-indigo-400">{task?.action ?? task?.status}</span>
              </p>
              {task?.comment && (
                <p className="text-xs text-slate-600 dark:text-slate-300 italic pt-2 border-t border-slate-200 dark:border-slate-700">
                  &ldquo;{task.comment}&rdquo;
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
