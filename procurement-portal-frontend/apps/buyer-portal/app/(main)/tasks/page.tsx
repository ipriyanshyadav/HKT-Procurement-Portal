"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMyWorkflowTasks } from "@procurement/hooks";
import { SLAIndicator } from "@procurement/ui";

function EntityTypeBadge({ entityType }: { entityType: string }) {
  const colorMap: Record<string, string> = {
    REQUISITION: "bg-blue-100 text-blue-700",
    RFQ: "bg-purple-100 text-purple-700",
    PURCHASE_ORDER: "bg-green-100 text-green-700",
    VENDOR: "bg-orange-100 text-orange-700",
    CONTRACT: "bg-red-100 text-red-700",
    INVOICE: "bg-yellow-100 text-yellow-700",
    AWARD: "bg-indigo-100 text-indigo-700",
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
    <span className="text-xs text-gray-500">
      Step {stepNumber}{role ? ` · ${role}` : ""}
    </span>
  );
}

/**
 * Workflow Task Inbox — shows all pending approval tasks assigned to the current user.
 * Sorted by SLA deadline ascending (most urgent first).
 * Requires: any authenticated user (tasks are pre-filtered by backend to current user).
 */
export default function TasksPage() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const { data, isLoading, isError, error } = useMyWorkflowTasks({
    page,
    page_size: PAGE_SIZE,
  });

  const tasks = data?.tasks ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / PAGE_SIZE) : 1;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" aria-label="Loading tasks" aria-busy="true">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6" role="alert">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Failed to load tasks. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Approval Inbox</h1>
        <p className="mt-1 text-sm text-gray-500">
          {meta?.total ?? 0} pending task{(meta?.total ?? 0) !== 1 ? "s" : ""} awaiting your action
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg">
          <div className="text-4xl mb-3" aria-hidden="true">✅</div>
          <p className="text-gray-500 font-medium">All caught up!</p>
          <p className="text-gray-400 text-sm mt-1">No pending approvals at this time.</p>
        </div>
      ) : (
        <ul role="list" className="divide-y divide-gray-100 bg-white rounded-lg shadow ring-1 ring-gray-200">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/tasks/${task.id}`}
                className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
                aria-label={`Task ${task.id} — Step ${task.step_number}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StepBadge stepNumber={task.step_number} role={task.assigned_role} />
                    <span className="text-xs text-gray-400">
                      {new Date(task.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-gray-900 truncate">
                    Task #{task.id.slice(0, 8)}…
                  </p>

                  <div className="mt-2">
                    <SLAIndicator
                      slaDeadline={task.sla_deadline}
                      createdAt={task.created_at}
                      slaStatus={task.sla_status}
                    />
                  </div>
                </div>

                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <span className="text-gray-400 text-sm" aria-hidden="true">›</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="relative inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="relative inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
