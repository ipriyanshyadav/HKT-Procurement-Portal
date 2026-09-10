"use client";

import React, { useState } from "react";
import { CheckCircle2, Clock, AlertCircle, Calendar, User, ArrowRight, Award, Plus, Filter, X } from "lucide-react";
import { Button } from "./components/Button";

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
  canAdd?: boolean;
  onAddMilestone?: (data: {
    title: string;
    description?: string;
    due_date: string;
    responsible_party: "BUYER" | "SUPPLIER" | "BOTH";
    milestone_weight?: number;
  }) => Promise<void> | void;
  isAdding?: boolean;
  className?: string;
}

export function MilestoneTracker({
  milestones,
  canComplete = false,
  onCompleteMilestone,
  isCompleting = false,
  canAdd = false,
  onAddMilestone,
  isAdding = false,
  className = "",
}: MilestoneTrackerProps) {
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [partyFilter, setPartyFilter] = useState<"ALL" | "BUYER" | "SUPPLIER">("ALL");

  // Add milestone modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newParty, setNewParty] = useState<"BUYER" | "SUPPLIER" | "BOTH">("BUYER");
  const [newWeight, setNewWeight] = useState("");

  const filteredMilestones = React.useMemo(() => {
    let list = [...milestones];
    if (partyFilter !== "ALL") {
      list = list.filter(
        (m) =>
          m.responsible_party === partyFilter ||
          m.responsible_party === "BOTH" ||
          (partyFilter === "SUPPLIER" && m.responsible_party === "VENDOR")
      );
    }
    return list.sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
  }, [milestones, partyFilter]);

  const completedCount = milestones.filter((m) => m.status === "COMPLETED").length;
  const totalCount = milestones.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const totalWeight = milestones.reduce((acc, m) => acc + (m.milestone_weight || 0), 0);
  const completedWeight = milestones
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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddMilestone || !newTitle.trim() || !newDueDate) return;
    try {
      await onAddMilestone({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        due_date: newDueDate,
        responsible_party: newParty,
        milestone_weight: newWeight ? parseFloat(newWeight) : undefined,
      });
      setIsAddModalOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewDueDate("");
      setNewWeight("");
    } catch {
      // handled by caller
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 dark:border-white/15 bg-white dark:bg-[#1C1C1F] shadow-sm p-6 ${className}`}
    >
      {/* Header & Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200/80 dark:border-white/10 gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Milestones & Deliverable Obligations
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track contractual milestones, responsible parties, weights, and completion timestamps
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
          <div className="w-24 bg-slate-100 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {canAdd && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsAddModalOpen(true)}
              className="ml-2"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Milestone
            </Button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 mt-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
          <Filter className="w-3.5 h-3.5" /> Filter:
        </span>
        {(["ALL", "BUYER", "SUPPLIER"] as const).map((party) => (
          <button
            key={party}
            type="button"
            onClick={() => setPartyFilter(party)}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
              partyFilter === party
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
            }`}
          >
            {party === "ALL" ? "All Parties" : party === "BUYER" ? "Buyer Tasks" : "Supplier Deliverables"}
          </button>
        ))}
      </div>

      {/* Milestones Timeline */}
      {filteredMilestones.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
          No milestones found matching the selected filter.
        </div>
      ) : (
        <div className="mt-6 flow-root">
          <ul className="-mb-8">
            {filteredMilestones.map((milestone, idx) => {
              const isLast = idx === filteredMilestones.length - 1;
              const isCompleted = milestone.status === "COMPLETED";
              const isOverdue =
                !isCompleted &&
                new Date(milestone.due_date).getTime() < Date.now();

              return (
                <li key={milestone.id}>
                  <div className="relative pb-8">
                    {!isLast && (
                      <span
                        className={`absolute left-4 top-4 -ml-px h-full w-0.5 ${
                          isCompleted
                            ? "bg-emerald-500"
                            : "bg-slate-200 dark:bg-white/15"
                        }`}
                        aria-hidden="true"
                      />
                    )}

                    <div className="relative flex items-start space-x-3">
                      {/* Icon Status */}
                      <div>
                        {isCompleted ? (
                          <span className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center ring-8 ring-white dark:ring-[#1C1C1F]">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </span>
                        ) : isOverdue ? (
                          <span className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center ring-8 ring-white dark:ring-[#1C1C1F] animate-pulse">
                            <AlertCircle className="h-4 w-4 text-white" />
                          </span>
                        ) : (
                          <span className="h-8 w-8 rounded-full bg-slate-200 dark:bg-white/15 flex items-center justify-center ring-8 ring-white dark:ring-[#1C1C1F]">
                            <Clock className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                          </span>
                        )}
                      </div>

                      {/* Content Card */}
                      <div className="min-w-0 flex-1 bg-slate-50 dark:bg-[#252529] rounded-xl p-4 border border-slate-200/80 dark:border-white/10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {milestone.title}
                            </span>
                            {milestone.milestone_weight !== null && milestone.milestone_weight !== undefined && (
                              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                {milestone.milestone_weight}% weight
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                isCompleted
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80"
                                  : isOverdue
                                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/80"
                                  : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/15"
                              }`}
                            >
                              {isOverdue ? "OVERDUE" : milestone.status}
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
                            Party:{" "}
                            <strong className="font-semibold text-slate-700 dark:text-slate-300">
                              {milestone.responsible_party}
                            </strong>
                          </span>

                          {isCompleted && milestone.completed_at && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Completed on {new Date(milestone.completed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {milestone.completion_notes && (
                          <div className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-[#1C1C1F] p-2.5 rounded-lg border border-slate-200/80 dark:border-white/10">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Completion Notes: </span>
                            {milestone.completion_notes}
                          </div>
                        )}

                        {/* Complete Milestone Action */}
                        {!isCompleted && canComplete && (
                          <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
                            {selectedMilestoneId === milestone.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  placeholder="Add completion notes (optional)..."
                                  value={notes}
                                  onChange={(e) => setNotes(e.target.value)}
                                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1C1C1F] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleCompleteSubmit(milestone.id)}
                                    disabled={submittingId === milestone.id || isCompleting}
                                  >
                                    {submittingId === milestone.id ? "Completing..." : "Confirm Complete"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedMilestoneId(null);
                                      setNotes("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedMilestoneId(milestone.id)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline"
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

      {/* Add Milestone Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#1C1C1F] border border-slate-200/80 dark:border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10">
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Add Contract Milestone
              </h4>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Milestone Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Factory Acceptance Test Sign-off"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional deliverables description or acceptance criteria..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Responsible Party *
                  </label>
                  <select
                    value={newParty}
                    onChange={(e) => setNewParty(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="BUYER">Buyer</option>
                    <option value="SUPPLIER">Supplier</option>
                    <option value="BOTH">Joint / Both</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Weight (% of total contract)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 20"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/80 dark:border-white/10">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  disabled={isAdding}
                >
                  {isAdding ? "Adding..." : "Add Milestone"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

