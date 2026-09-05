"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useUnmappedPRs,
  useUnmappedPRDashboard,
  useMapPR,
  useAutoMapPR,
  useSuggestMapping,
  UnmappedPRException,
} from "@procurement/hooks";
import { CategoryTreeSelect, Badge, Button } from "@procurement/ui";
import { Sparkles, Sliders } from "lucide-react";

export default function UnmappedPRsDashboardPage() {
  const [page, setPage] = useState(1);
  const [selectedException, setSelectedException] = useState<UnmappedPRException | null>(null);
  const [manualCategoryId, setManualCategoryId] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const { data: listData, isLoading, refetch } = useUnmappedPRs({ page, page_size: 20 });
  const { data: dashboard } = useUnmappedPRDashboard();

  const mapMutation = useMapPR();
  const autoMapMutation = useAutoMapPR();

  const exceptions = listData?.exceptions ?? [];

  const getSlaBadge = (level: number) => {
    switch (level) {
      case 4:
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-900 text-white animate-pulse">
            TIER 4 (Critical &gt;48h)
          </span>
        );
      case 3:
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-600 text-white">
            TIER 3 (Breached &gt;24h)
          </span>
        );
      case 2:
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500 text-white">
            TIER 2 (Warning 8–24h)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-600 text-white">
            TIER 1 (&lt;4h Within SLA)
          </span>
        );
    }
  };

  const handleManualMapSubmit = async () => {
    if (!selectedException || !manualCategoryId) return;
    try {
      await mapMutation.mutateAsync({
        id: selectedException.id,
        payload: {
          mappings: [
            {
              field: "category_id",
              value: manualCategoryId,
              label: "Manually Mapped Category",
            },
          ],
          notes: manualNotes,
        },
      });
      setSelectedException(null);
      setManualCategoryId("");
      setManualNotes("");
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to map PR");
    }
  };

  const handleAutoMap = async (exceptionId: string) => {
    try {
      await autoMapMutation.mutateAsync(exceptionId);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Auto-mapping rejected: confidence below 0.85 threshold");
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Unmapped PR Exceptions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Resolve unmapped material groups, missing plant codes, and SLA breaches from ERP imports.
          </p>
        </div>
      </div>

      {/* SLA Metrics Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-xs text-gray-500 block">Total Pending</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard?.total_pending ?? 0}</span>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs text-emerald-700 font-semibold block">Tier 1 (&lt;4h)</span>
          <span className="text-2xl font-bold text-emerald-800">{dashboard?.tier_1_count ?? 0}</span>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs text-amber-700 font-semibold block">Tier 2 (4–8h)</span>
          <span className="text-2xl font-bold text-amber-800">{dashboard?.tier_2_count ?? 0}</span>
        </div>
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs text-red-700 font-semibold block">Tier 3 (8–24h)</span>
          <span className="text-2xl font-bold text-red-800">{dashboard?.tier_3_count ?? 0}</span>
        </div>
        <div className="bg-rose-100 border border-rose-300 p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs text-rose-800 font-bold block">Tier 4 (&gt;48h)</span>
          <span className="text-2xl font-bold text-rose-900">{dashboard?.tier_4_count ?? 0}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-xs text-gray-500 block">Blocked Value</span>
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            ₹{Number(dashboard?.total_blocked_value || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Exception List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3.5 font-semibold">SLA Status</th>
                <th className="px-4 py-3.5 font-semibold">PR Number</th>
                <th className="px-4 py-3.5 font-semibold">Failed Fields</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Age</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    Loading exceptions...
                  </td>
                </tr>
              ) : exceptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No unmapped PR exceptions pending resolution.
                  </td>
                </tr>
              ) : (
                exceptions.map((exc) => {
                  const hoursElapsed = Math.round(
                    (new Date().getTime() - new Date(exc.created_at).getTime()) / (1000 * 3600)
                  );
                  const failedKeys = Array.isArray(exc.failed_fields)
                    ? exc.failed_fields.map((f: any) => f.field || JSON.stringify(f))
                    : Object.keys(exc.failed_fields || {});

                  return (
                    <tr key={exc.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50/75 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3.5">{getSlaBadge(exc.sla_breach_level)}</td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-blue-600">
                        {exc.requisition?.pr_number || "PR-ERP-TEMP"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {failedKeys.map((k, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-mono"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={exc.status === "RESOLVED" ? "approved" : exc.status === "PENDING_ERP" ? "review" : "pending"}>
                          {exc.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">{hoursElapsed}h ago</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {exc.status !== "RESOLVED" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAutoMap(exc.id)}
                                disabled={autoMapMutation.isPending}
                                icon={<Sparkles className="w-3.5 h-3.5" />}
                              >
                                Auto-Map
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedException(exc)}
                                icon={<Sliders className="w-3.5 h-3.5" />}
                              >
                                Manual Map
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Mapping Modal */}
      {selectedException && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Map Unmapped Exception</h3>
            <p className="text-sm text-gray-500">
              Assign procurement category and business unit mapping for exception ID:{" "}
              <span className="font-mono text-xs text-gray-700">{selectedException.id}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Assign Category *
                </label>
                <CategoryTreeSelect
                  value={manualCategoryId}
                  onChange={setManualCategoryId}
                  placeholder="Select target category..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Resolution Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for manual assignment..."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedException(null)}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleManualMapSubmit}
                disabled={!manualCategoryId || mapMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {mapMutation.isPending ? "Applying..." : "Apply Mapping"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
