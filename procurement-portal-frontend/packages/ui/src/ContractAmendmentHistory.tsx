"use client";

import React, { useState } from "react";
import {
  FileDiff,
  Plus,
  History,
  ArrowRight,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  AlertCircle,
  Eye,
  X,
} from "lucide-react";
import { Button } from "./components/Button";

export interface AmendmentItem {
  id: string;
  contract_id: string;
  amendment_number: number;
  amendment_type: "VALUE_CHANGE" | "SCOPE_CHANGE" | "DATE_EXTENSION" | "CLAUSE_MODIFICATION" | string;
  changes_summary?: string | null;
  change_description?: string | null;
  field_changes?: Record<string, { old_value: any; new_value: any }> | null;
  original_snapshot?: Record<string, any>;
  amended_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
}

export interface ContractAmendmentHistoryProps {
  amendments: AmendmentItem[];
  currency?: string;
  canAmend?: boolean;
  onAmend?: (data: {
    amendment_type: "VALUE_CHANGE" | "SCOPE_CHANGE" | "DATE_EXTENSION" | "CLAUSE_MODIFICATION";
    change_description: string;
    new_total_value?: number;
    new_end_date?: string;
    field_changes?: Record<string, any>;
  }) => Promise<void> | void;
  currentValue?: number | string;
  currentEndDate?: string;
  className?: string;
}

export function ContractAmendmentHistory({
  amendments,
  currency = "INR",
  canAmend = false,
  onAmend,
  currentValue = 0,
  currentEndDate = "",
  className = "",
}: ContractAmendmentHistoryProps) {
  const [selectedAmendmentId, setSelectedAmendmentId] = useState<string | null>(
    amendments[0]?.id || null
  );
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);
  const [amendType, setAmendType] = useState<
    "VALUE_CHANGE" | "SCOPE_CHANGE" | "DATE_EXTENSION" | "CLAUSE_MODIFICATION"
  >("VALUE_CHANGE");
  const [changeDescription, setChangeDescription] = useState("");
  const [newTotalValue, setNewTotalValue] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAmendment =
    amendments.find((a) => a.id === selectedAmendmentId) || amendments[0];

  const formatCurrency = (val: number | string) => {
    const num = Number(val || 0);
    return `${currency === "INR" ? "₹" : currency + " "}${num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getBadgeClass = (type: string) => {
    switch (type) {
      case "VALUE_CHANGE":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/80";
      case "DATE_EXTENSION":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/80";
      case "SCOPE_CHANGE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80";
      case "CLAUSE_MODIFICATION":
      default:
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80";
    }
  };

  const handleAmendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAmend || !changeDescription.trim()) return;

    try {
      setIsSubmitting(true);
      const field_changes: Record<string, any> = {};

      if (amendType === "VALUE_CHANGE" && newTotalValue) {
        field_changes["total_value"] = {
          old_value: Number(currentValue || 0),
          new_value: parseFloat(newTotalValue),
        };
      }
      if (amendType === "DATE_EXTENSION" && newEndDate) {
        field_changes["end_date"] = {
          old_value: currentEndDate,
          new_value: newEndDate,
        };
      }

      await onAmend({
        amendment_type: amendType,
        change_description: changeDescription.trim(),
        new_total_value: newTotalValue ? parseFloat(newTotalValue) : undefined,
        new_end_date: newEndDate || undefined,
        field_changes: Object.keys(field_changes).length > 0 ? field_changes : undefined,
      });

      setIsAmendModalOpen(false);
      setChangeDescription("");
      setNewTotalValue("");
      setNewEndDate("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Bar */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/15 bg-white dark:bg-[#1C1C1F] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Contract Amendments & Version Lineage ({amendments.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Immutable pre-change snapshots, before/after diff audit logs, and version governance
          </p>
        </div>

        {canAmend && (
          <Button size="sm" variant="primary" onClick={() => setIsAmendModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Amendment
          </Button>
        )}
      </div>

      {amendments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/15 bg-white dark:bg-[#1C1C1F] p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
          <FileDiff className="w-10 h-10 text-slate-400 mx-auto mb-3 opacity-60" />
          No amendments have been executed on this contract. The baseline terms (v1.0) remain intact.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Version Selector Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Executed Versions
            </h4>
            <div className="space-y-2">
              {amendments.map((amend) => {
                const isSelected = amend.id === selectedAmendment?.id;
                return (
                  <div
                    key={amend.id}
                    onClick={() => setSelectedAmendmentId(amend.id)}
                    className={`cursor-pointer p-4 rounded-xl border transition-all text-left ${
                      isSelected
                        ? "bg-indigo-50/70 border-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-700 shadow-sm"
                        : "bg-white dark:bg-[#1C1C1F] border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[11px] font-mono">
                          v1.{amend.amendment_number}
                        </span>
                        Amendment #{amend.amendment_number}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getBadgeClass(
                          amend.amendment_type
                        )}`}
                      >
                        {amend.amendment_type.replace(/_/g, " ")}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">
                      {amend.change_description || amend.changes_summary || "No description logged"}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(amend.created_at).toLocaleDateString()}
                      </span>
                      {amend.approved_at && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Before / After Diff Inspector */}
          <div className="lg:col-span-8">
            {selectedAmendment ? (
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/15 bg-white dark:bg-[#1C1C1F] p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/10 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Amendment #{selectedAmendment.amendment_number} Audit Diff
                      </h4>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getBadgeClass(
                          selectedAmendment.amendment_type
                        )}`}
                      >
                        {selectedAmendment.amendment_type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Executed on {new Date(selectedAmendment.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Justification & Scope */}
                <div className="bg-slate-50 dark:bg-[#252529] p-4 rounded-xl border border-slate-200/80 dark:border-white/10 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                    Change Description & Business Justification
                  </span>
                  <p className="mt-1 text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                    {selectedAmendment.change_description || selectedAmendment.changes_summary || "No description provided."}
                  </p>
                </div>

                {/* Side-by-Side Diff Table */}
                <div>
                  <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                    Field Modifications (Before vs After)
                  </h5>

                  {selectedAmendment.field_changes &&
                  Object.keys(selectedAmendment.field_changes).length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-[#252529] text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                            <th className="py-2.5 px-4">Contract Field</th>
                            <th className="py-2.5 px-4 w-5/12 bg-red-50/40 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                              Previous Value (Original)
                            </th>
                            <th className="py-2.5 px-4 w-5/12 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                              Amended Value (Current)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80 dark:divide-white/10">
                          {Object.entries(selectedAmendment.field_changes).map(
                            ([field, change]: [string, any]) => {
                              const oldVal = change?.old_value !== undefined ? String(change.old_value) : "—";
                              const newVal = change?.new_value !== undefined ? String(change.new_value) : "—";

                              return (
                                <tr key={field} className="hover:bg-slate-50/30 dark:hover:bg-white/[0.01]">
                                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                                    {field}
                                  </td>
                                  <td className="py-3 px-4 bg-red-50/20 dark:bg-red-950/10 text-red-700 dark:text-red-300 font-mono line-through decoration-red-400">
                                    {field.includes("value") ? formatCurrency(oldVal) : oldVal}
                                  </td>
                                  <td className="py-3 px-4 bg-emerald-50/20 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                                    {field.includes("value") ? formatCurrency(newVal) : newVal}
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-white/15 text-center text-xs text-slate-400">
                      No explicit numeric/field changes recorded. Scope or clause modification logged via attached document.
                    </div>
                  )}
                </div>

                {/* Pre-Change Snapshot Metadata */}
                {selectedAmendment.original_snapshot &&
                  Object.keys(selectedAmendment.original_snapshot).length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-[#252529]/60 border border-slate-200/80 dark:border-white/10 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                        Pre-Change Contract State Snapshot
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 font-mono text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Contract Value</span>
                          <span className="text-slate-900 dark:text-slate-100 font-semibold">
                            {formatCurrency(selectedAmendment.original_snapshot.total_value || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">End Date</span>
                          <span className="text-slate-900 dark:text-slate-100 font-semibold">
                            {selectedAmendment.original_snapshot.end_date || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Contract Type</span>
                          <span className="text-slate-900 dark:text-slate-100 font-semibold">
                            {selectedAmendment.original_snapshot.contract_type || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create Amendment Modal */}
      {isAmendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-[#1C1C1F] border border-slate-200/80 dark:border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10">
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileDiff className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Initiate Contract Amendment
              </h4>
              <button
                type="button"
                onClick={() => setIsAmendModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAmendSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Amendment Type *
                </label>
                <select
                  value={amendType}
                  onChange={(e) => setAmendType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                >
                  <option value="VALUE_CHANGE">Value Ceiling Change (Increase/Decrease)</option>
                  <option value="DATE_EXTENSION">Validity Period Extension</option>
                  <option value="SCOPE_CHANGE">Scope of Work & Catalog Modification</option>
                  <option value="CLAUSE_MODIFICATION">Legal & SLA Clause Modification</option>
                </select>
              </div>

              {amendType === "VALUE_CHANGE" && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#252529] border border-slate-200/80 dark:border-white/10 space-y-2">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Current Contract Ceiling:</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {formatCurrency(currentValue)}
                    </strong>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      New Total Value ({currency}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="e.g. 750000.00"
                      value={newTotalValue}
                      onChange={(e) => setNewTotalValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1C1C1F] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              )}

              {amendType === "DATE_EXTENSION" && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#252529] border border-slate-200/80 dark:border-white/10 space-y-2">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Current Expiration Date:</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {currentEndDate || "—"}
                    </strong>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      New Expiration Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1C1C1F] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Change Description & Business Justification *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail the commercial or operational rationale requiring this amendment..."
                  value={changeDescription}
                  onChange={(e) => setChangeDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/80 dark:border-white/10">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setIsAmendModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Executing..." : "Execute Amendment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
