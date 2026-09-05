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

type ActionType = "approve" | "reject" | "return" | null;

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    ACTIVE: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-100 text-gray-700",
    PAUSED: "bg-yellow-100 text-yellow-700",
    PENDING_RULE_RESOLUTION: "bg-orange-100 text-orange-700",
  };
  const cls = colorMap[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
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

  const [action, setAction] = useState<ActionType>(null);
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Find the task from the user's pending tasks list
  const { data: tasksData } = useMyWorkflowTasks();
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
    if (!action || !task) return;

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

  if (!task && !instanceLoading) {
    return (
      <div className="p-6" role="alert">
        <div className="rounded-md bg-yellow-50 p-4">
          <p className="text-sm text-yellow-700">
            Task not found or not assigned to you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <div>
        <Link href="/tasks" className="text-xs text-blue-600 hover:underline mb-1 inline-block">
          ← Back to Tasks List
        </Link>
      </div>

      {/* Instance details */}
      {instance && (
        <section className="bg-white rounded-lg shadow ring-1 ring-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Workflow Instance
            </h1>
            <StatusBadge status={instance.status} />
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Entity Type</dt>
              <dd className="font-medium text-gray-900">{instance.entity_type}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Current Step</dt>
              <dd className="font-medium text-gray-900">#{instance.current_step_number}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Started</dt>
              <dd className="font-medium text-gray-900">
                {new Date(instance.started_at).toLocaleString()}
              </dd>
            </div>
            {instance.completed_at && (
              <div>
                <dt className="text-gray-500">Completed</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(instance.completed_at).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* SLA bar */}
      {task && (
        <section className="bg-white rounded-lg shadow ring-1 ring-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-3">SLA Status</h2>
          <SLAIndicator
            slaDeadline={task.sla_deadline}
            createdAt={task.created_at}
            slaStatus={task.sla_status}
          />
        </section>
      )}

      {/* Action panel — only show if task is still pending */}
      {task && task.status === "PENDING" && instance?.status === "ACTIVE" && (
        <PermissionGuard permission={["pr.approve", "pr.reject", "workflow.update"]}>
          <section className="bg-white rounded-lg shadow ring-1 ring-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Your Action
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Action selector */}
              <fieldset>
                <legend className="sr-only">Select action</legend>
                <div className="flex gap-3" role="group" aria-label="Task action">
                  {(["approve", "reject", "return"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAction(a)}
                      aria-pressed={action === a}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold capitalize ring-1 ring-inset transition-colors ${
                        action === a
                          ? a === "approve"
                            ? "bg-green-600 text-white ring-green-600"
                            : a === "reject"
                            ? "bg-red-600 text-white ring-red-600"
                            : "bg-yellow-500 text-white ring-yellow-500"
                          : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Comment box */}
              <div>
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                  Comment {action === "reject" || action === "return" ? "(required)" : "(optional)"}
                </label>
                <textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  required={action === "reject" || action === "return"}
                  maxLength={2000}
                  placeholder="Add a comment..."
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              {/* Error */}
              {submitError && (
                <div role="alert" className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-600">{submitError}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!action || isSubmitting}
                className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting…" : "Submit Decision"}
              </button>
            </form>
          </section>
        </PermissionGuard>
      )}

      {/* Task already actioned */}
      {task && task.status !== "PENDING" && (
        <section className="bg-gray-50 rounded-lg p-5 ring-1 ring-gray-200">
          <p className="text-sm text-gray-600">
            This task has already been actioned: <span className="font-semibold">{task.action ?? task.status}</span>
            {task.comment && (
              <span className="block mt-1 text-gray-500">Comment: {task.comment}</span>
            )}
          </p>
        </section>
      )}
    </div>
  );
}
