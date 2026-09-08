"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Timer, Save, CheckCircle, Loader2 } from "lucide-react";
import { useTicketSLAConfigs, useUpdateTicketSLAConfigs } from "@procurement/hooks";
import type { TicketSLAConfigRequest, TicketPriority } from "@procurement/types";

interface SLAFormRow {
  priority: TicketPriority;
  first_response_hours: number;
  resolution_hours: number;
  escalation_hours: number;
  escalate_to_role?: string | null;
}

const DEFAULT_ROWS: SLAFormRow[] = [
  { priority: "CRITICAL", first_response_hours: 1, resolution_hours: 4, escalation_hours: 3, escalate_to_role: "finance_approver" },
  { priority: "HIGH", first_response_hours: 4, resolution_hours: 24, escalation_hours: 18, escalate_to_role: "procurement_lead" },
  { priority: "MEDIUM", first_response_hours: 8, resolution_hours: 72, escalation_hours: 48, escalate_to_role: "procurement_lead" },
  { priority: "LOW", first_response_hours: 24, resolution_hours: 168, escalation_hours: 120, escalate_to_role: null },
];

export default function AdminTicketSLAConfigPage() {
  const { data: serverConfigs = [], isLoading } = useTicketSLAConfigs();
  const updateMutation = useUpdateTicketSLAConfigs();

  const [rows, setRows] = useState<SLAFormRow[]>(DEFAULT_ROWS);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (serverConfigs.length > 0) {
      const mapped = DEFAULT_ROWS.map((def) => {
        const found = serverConfigs.find((s) => s.priority === def.priority);
        if (found) {
          return {
            priority: found.priority as TicketPriority,
            first_response_hours: found.first_response_hours,
            resolution_hours: found.resolution_hours,
            escalation_hours: (found as any).escalation_hours ?? def.escalation_hours,
            escalate_to_role: (found as any).escalate_to_role ?? def.escalate_to_role,
          };
        }
        return def;
      });
      setRows(mapped);
    }
  }, [serverConfigs]);

  const handleChange = (index: number, field: keyof SLAFormRow, value: any) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);

    const payload: TicketSLAConfigRequest[] = rows.map((r) => ({
      priority: r.priority,
      first_response_hours: Number(r.first_response_hours),
      resolution_hours: Number(r.resolution_hours),
      escalation_hours: Number(r.escalation_hours),
      escalate_to_role: r.escalate_to_role || undefined,
    }));

    await updateMutation.mutateAsync(payload);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tickets</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Timer className="w-6 h-6 text-blue-600" />
          <span>Service Level Agreement (SLA) Configuration</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure guaranteed response times and resolution target hours per ticket priority.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>SLA configurations updated successfully. New timers will apply immediately.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">1st Response (Hours)</th>
                <th className="p-3.5">Target Resolution (Hours)</th>
                <th className="p-3.5">Escalation Alert (Hours)</th>
                <th className="p-3.5">Escalate To Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr key={row.priority} className="hover:bg-slate-50/60">
                  <td className="p-3.5 font-bold text-slate-900">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        row.priority === "CRITICAL"
                          ? "bg-rose-100 text-rose-800"
                          : row.priority === "HIGH"
                          ? "bg-amber-100 text-amber-800"
                          : row.priority === "MEDIUM"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {row.priority}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <input
                      type="number"
                      min={1}
                      value={row.first_response_hours}
                      onChange={(e) => handleChange(idx, "first_response_hours", e.target.value)}
                      className="w-24 text-sm px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="p-3.5">
                    <input
                      type="number"
                      min={1}
                      value={row.resolution_hours}
                      onChange={(e) => handleChange(idx, "resolution_hours", e.target.value)}
                      className="w-28 text-sm px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="p-3.5">
                    <input
                      type="number"
                      min={1}
                      value={row.escalation_hours}
                      onChange={(e) => handleChange(idx, "escalation_hours", e.target.value)}
                      className="w-28 text-sm px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="p-3.5">
                    <input
                      type="text"
                      value={row.escalate_to_role || ""}
                      onChange={(e) => handleChange(idx, "escalate_to_role", e.target.value)}
                      placeholder="Role (e.g. procurement_lead)"
                      className="w-48 text-sm px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            * Changes affect all future and in-progress tickets in the organization.
          </span>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save SLA Policies</span>
          </button>
        </div>
      </form>
    </div>
  );
}
