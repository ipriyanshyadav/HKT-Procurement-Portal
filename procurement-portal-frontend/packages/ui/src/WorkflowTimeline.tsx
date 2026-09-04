"use client";

import React from "react";

export interface WorkflowStep {
  id: string;
  name: string;
  status: "COMPLETED" | "CURRENT" | "PENDING" | "REJECTED" | "SKIPPED";
  actorName?: string | null;
  timestamp?: string | null;
  comment?: string | null;
}

export interface WorkflowTimelineProps {
  currentStatus: string;
  steps?: WorkflowStep[];
  className?: string;
}

const DEFAULT_PR_STEPS = [
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "PENDING_APPROVAL", label: "Approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "IN_SOURCING", label: "Sourcing / RFQ" },
  { key: "CONVERTED", label: "PO Created" },
];

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  currentStatus,
  steps,
  className = "",
}) => {
  // If custom steps are provided, render them; otherwise render the standard PR lifecycle chain
  if (steps && steps.length > 0) {
    return (
      <div className={`p-4 bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
          Workflow Status Timeline
        </h3>
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
          {steps.map((step) => {
            const isCompleted = step.status === "COMPLETED";
            const isCurrent = step.status === "CURRENT";
            const isRejected = step.status === "REJECTED";

            return (
              <div key={step.id} className="relative group">
                <div
                  className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ring-4 ring-white ${
                    isCompleted
                      ? "bg-green-500"
                      : isCurrent
                      ? "bg-blue-600 animate-pulse"
                      : isRejected
                      ? "bg-red-500"
                      : "bg-gray-300"
                  }`}
                >
                  {isCompleted ? "✓" : isRejected ? "✕" : ""}
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      isCurrent ? "text-blue-600" : isCompleted ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {step.name}
                  </p>
                  {step.actorName && (
                    <p className="text-xs text-gray-500 mt-0.5">By {step.actorName}</p>
                  )}
                  {step.timestamp && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(step.timestamp).toLocaleString()}
                    </p>
                  )}
                  {step.comment && (
                    <p className="text-xs italic text-gray-600 mt-1 bg-gray-50 p-2 rounded border border-gray-100">
                      "{step.comment}"
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Linear status tracker
  const statusIndexMap: Record<string, number> = {
    DRAFT: 0,
    SUBMITTED: 1,
    PENDING_APPROVAL: 2,
    APPROVED: 3,
    IN_SOURCING: 4,
    CONVERTED: 5,
    AMENDMENT_PENDING: 2,
    REJECTED: -1,
    WITHDRAWN: -1,
    CANCELLED: -1,
    UNMAPPED: -1,
  };

  const currentIndex = statusIndexMap[currentStatus] ?? 0;
  const isTerminalNegative = ["REJECTED", "WITHDRAWN", "CANCELLED"].includes(currentStatus);

  return (
    <div className={`p-4 bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Requisition Lifecycle
        </h3>
        <span
          className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase ${
            currentStatus === "APPROVED" || currentStatus === "CONVERTED"
              ? "bg-green-100 text-green-800"
              : isTerminalNegative
              ? "bg-red-100 text-red-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {currentStatus.replace(/_/g, " ")}
        </span>
      </div>

      <div className="flex items-center justify-between w-full overflow-x-auto py-2">
        {DEFAULT_PR_STEPS.map((step, idx) => {
          const isDone = currentIndex > idx;
          const isCurrent = currentIndex === idx && !isTerminalNegative;

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center min-w-[72px] text-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? "bg-green-600 text-white shadow-sm"
                      : isCurrent
                      ? "bg-blue-600 text-white ring-4 ring-blue-100 shadow-md"
                      : "bg-gray-100 text-gray-400 border border-gray-300"
                  }`}
                >
                  {isDone ? "✓" : idx + 1}
                </div>
                <span
                  className={`text-xs mt-2 font-medium ${
                    isCurrent ? "text-blue-600 font-bold" : isDone ? "text-gray-800" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < DEFAULT_PR_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 min-w-[24px] ${
                    isDone ? "bg-green-600" : "bg-gray-200"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
