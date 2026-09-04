"use client";

import React, { useState } from "react";
import { CheckCircle2, Clock, AlertCircle, Calendar, User, ArrowRight, Award } from "lucide-react";

export interface MilestoneItem {
  id: string;
  contract_id: string;
  title: string;
  description?: string | null;
  due_date: string;
  responsible_party: "BUYER" | "SUPPLIER" | "BOTH" | string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE" | string;
  milestone_weight?: number | null;
  completed_at?: string | null;
  completion_notes?: string | null;
}

export interface MilestoneTrackerProps {
  milestones: MilestoneItem[];
  canComplete?: boolean;
  onCompleteMilestone?: (milestoneId: string, notes?: string) => Promise<void> | void;
  isCompleting?: boolean;
  className?: string;
}

export function MilestoneTracker({
  milestones,
  canComplete = false,
  onCompleteMilestone,
  isCompleting = false,
  className = "",
}: MilestoneTrackerProps) {
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const sortedMilestones = React.useMemo(() => {
    return [...milestones].sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
  }, [milestones]);

  const completedCount = sortedMilestones.filter((m) => m.status === "COMPLETED").length;
  const totalCount = sortedMilestones.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const totalWeight = sortedMilestones.reduce((acc, m) => acc + (m.milestone_weight || 0), 0);
  const completedWeight = sortedMilestones
    .filter((m) => m.status === "COMPLETED")
    .reduce((acc, m) => acc + (m.milestone_weight || 0), 0);

  const handleCompleteSubmit = async (milestoneId: string) => {
    if (!onCompleteMilestone) return;
    try {
      setSubmittingId(milestoneId);
      await onCompleteMilestone(milestoneId, notes.trim() || undefined);
      setSelectedMilestoneId(null);
      setNotes("");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 ${className}`}>
      {/* Header & Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800 gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Milestones & Deliverables
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track key contractual milestones, responsible parties, and SLA commitments
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Progress</span>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {completedCount} of {totalCount} ({progressPercent}%)
            </div>
            {totalWeight > 0 && (
              <div className="text-[11px] text-slate-400">
                Weight: {completedWeight}% / {totalWeight}%
              </div>
            )}
          </div>
          <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Milestones List */}
      {sortedMilestones.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
          No milestones defined for this contract.
        </div>
      ) : (
        <div className="mt-6 flow-root">
          <ul className="-mb-8">
            {sortedMilestones.map((milestone, idx) => {
              const isLast = idx === sortedMilestones.length - 1;
              const isCompleted = milestone.status === "COMPLETED";
              const isOverdue =
                !isCompleted &&
                new Date(milestone.due_date).getTime() < Date.now();
              const isPending = !isCompleted && !isOverdue;

              return (
                <li key={milestone.id}>
                  <div className="relative pb-8">
                    {!isLast && (
                      <span
                        className={`absolute left-4 top-4 -ml-px h-full w-0.5 ${
                          isCompleted
                            ? "bg-emerald-500"
                            : "bg-slate-200 dark:bg-slate-800"
                        }`}
                        aria-hidden="true"
                      />
                    )}

                    <div className="relative flex items-start space-x-3">
                      {/* Icon Status */}
                      <div>
                        {isCompleted ? (
                          <span className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center ring-8 ring-white dark:ring-slate-900">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </span>
                        ) : isOverdue ? (
                          <span className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center ring-8 ring-white dark:ring-slate-900">
                            <AlertCircle className="h-4 w-4 text-white" />
                          </span>
                        ) : (
                          <span className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-8 ring-white dark:ring-slate-900">
                            <Clock className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                          </span>
                        )}
                      </div>

                      {/* Content Card */}
                      <div className="min-w-0 flex-1 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {milestone.title}
                            </span>
                            {milestone.milestone_weight !== null && milestone.milestone_weight !== undefined && (
                              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                                {milestone.milestone_weight}% weight
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                isCompleted
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                                  : isOverdue
                                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400"
                                  : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {milestone.status}
                            </span>
                          </div>
                        </div>

                        {milestone.description && (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {milestone.description}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Due: {new Date(milestone.due_date).toLocaleDateString()}
                          </span>

                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            Party: <strong className="font-medium text-slate-700 dark:text-slate-300">{milestone.responsible_party}</strong>
                          </span>

                          {isCompleted && milestone.completed_at && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Completed on {new Date(milestone.completed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {milestone.completion_notes && (
                          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Completion Notes: </span>
                            {milestone.completion_notes}
                          </div>
                        )}

                        {/* Complete Milestone Action */}
                        {!isCompleted && canComplete && (
                          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                            {selectedMilestoneId === milestone.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  placeholder="Add completion notes (optional)..."
                                  value={notes}
                                  onChange={(e) => setNotes(e.target.value)}
                                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteSubmit(milestone.id)}
                                    disabled={submittingId === milestone.id || isCompleting}
                                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
                                  >
                                    {submittingId === milestone.id ? "Completing..." : "Confirm Complete"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedMilestoneId(null);
                                      setNotes("");
                                    }}
                                    className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:underline"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedMilestoneId(milestone.id)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline"
                              >
                                Mark as Complete <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
