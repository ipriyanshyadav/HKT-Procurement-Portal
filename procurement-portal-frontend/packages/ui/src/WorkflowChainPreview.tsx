"use client";

import React from "react";
export interface SimulateApprover {
  id: string;
  name: string;
  role: string | null;
}

export interface SimulateChainStep {
  step_number: number;
  step_name: string | null;
  step_type: string | null;
  approvers: SimulateApprover[] | null;
  sla_hours: number | null;
  convergence: string | null;
  condition_met: boolean;
  condition_expression: string | null;
}

export interface WorkflowChainPreviewProps {
  chain: SimulateChainStep[];
  isLoading?: boolean;
}

function ApproverBadge({ approver }: { approver: SimulateApprover }) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 mr-1">
      {approver.name}
      {approver.role && (
        <span className="ml-1 text-blue-400">({approver.role})</span>
      )}
    </span>
  );
}

function StepCard({ step, index }: { step: SimulateChainStep; index: number }) {
  const isSkipped = !step.condition_met;

  return (
    <li className={`relative flex gap-x-4 ${isSkipped ? "opacity-50" : ""}`}>
      {/* Connector line */}
      {index !== 0 && (
        <div className="absolute left-3 top-0 -mt-4 h-4 w-0.5 bg-gray-200" aria-hidden="true" />
      )}

      {/* Step indicator */}
      <div
        className={`relative flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold ${
          isSkipped
            ? "bg-gray-100 text-gray-400"
            : "bg-blue-600 text-white"
        }`}
        aria-label={`Step ${step.step_number}`}
      >
        {step.step_number}
      </div>

      {/* Step content */}
      <div className="flex-auto rounded-md p-3 ring-1 ring-inset ring-gray-200 bg-white">
        <div className="flex items-center justify-between gap-x-4">
          <p className="text-sm font-medium text-gray-900">
            {step.step_name ?? `Step ${step.step_number}`}
          </p>
          <div className="flex items-center gap-2">
            {step.step_type && (
              <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${
                step.step_type === "PARALLEL"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {step.step_type}
              </span>
            )}
            {step.convergence && (
              <span className="text-xs rounded px-1.5 py-0.5 bg-yellow-50 text-yellow-700 font-medium">
                {step.convergence}
              </span>
            )}
            {isSkipped && (
              <span className="text-xs text-gray-400 italic">Skipped</span>
            )}
          </div>
        </div>

        {isSkipped && step.condition_expression && (
          <p className="mt-1 text-xs text-gray-400">
            Condition not met: <code className="bg-gray-100 px-1 rounded">{step.condition_expression}</code>
          </p>
        )}

        {!isSkipped && step.approvers && step.approvers.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Approvers:</p>
            <div className="flex flex-wrap gap-1">
              {step.approvers.map((a) => (
                <ApproverBadge key={a.id} approver={a} />
              ))}
            </div>
          </div>
        )}

        {!isSkipped && step.approvers && step.approvers.length === 0 && (
          <p className="mt-1 text-xs text-orange-500">
            ⚠ No approvers found for this step
          </p>
        )}

        {step.sla_hours != null && !isSkipped && (
          <p className="mt-1 text-xs text-gray-500">
            SLA: <span className="font-medium">{step.sla_hours}h</span>
            {step.sla_hours >= 24 && ` (${Math.floor(step.sla_hours / 24)}d)`}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * WorkflowChainPreview — shows step-by-step approval chain with estimated SLAs.
 * Used by simulate endpoint results to preview approval flow before submission.
 */
export function WorkflowChainPreview({ chain, isLoading }: WorkflowChainPreviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading approval chain" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex gap-x-4">
            <div className="h-6 w-6 rounded-full bg-gray-200" />
            <div className="flex-1 rounded-md p-3 ring-1 ring-inset ring-gray-200">
              <div className="h-3 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!chain || chain.length === 0) {
    return (
      <div className="text-sm text-gray-500 p-4 text-center border border-dashed border-gray-200 rounded-md">
        No approval steps found for this template and context.
      </div>
    );
  }

  const activeSteps = chain.filter((s) => s.condition_met);
  const totalSLAHours = activeSteps.reduce((sum, s) => sum + (s.sla_hours ?? 0), 0);

  return (
    <div className="space-y-4">
      {totalSLAHours > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 rounded-md px-3 py-2">
          <span className="text-blue-600 font-semibold">⏱</span>
          Estimated total approval time:{" "}
          <span className="font-semibold">
            {totalSLAHours >= 24
              ? `${Math.floor(totalSLAHours / 24)}d ${totalSLAHours % 24}h`
              : `${totalSLAHours}h`}
          </span>
          <span className="text-gray-400 text-xs">({activeSteps.length} active steps)</span>
        </div>
      )}

      <ul role="list" className="space-y-4" aria-label="Approval chain">
        {chain.map((step, idx) => (
          <StepCard key={step.step_number} step={step} index={idx} />
        ))}
      </ul>
    </div>
  );
}
