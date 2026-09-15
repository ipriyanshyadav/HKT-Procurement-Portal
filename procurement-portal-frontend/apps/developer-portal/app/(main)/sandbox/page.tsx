"use client";

import React, { useState } from "react";
import {
  useSandboxStatus,
  useResetSandbox,
  useTimeTravelSandbox,
  useAppToast,
} from "@procurement/hooks";
import {
  Box,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Loader2,
  Calendar,
  Sparkles,
  FileText,
  Package,
  Users,
  Terminal,
} from "lucide-react";

export default function SandboxConsolePage() {
  const { toast } = useAppToast();
  const { data: status, isLoading, refetch } = useSandboxStatus();
  const resetMutation = useResetSandbox();
  const timeTravelMutation = useTimeTravelSandbox();

  const [advanceDays, setAdvanceDays] = useState(14);
  const [timeTravelResult, setTimeTravelResult] = useState<any>(null);

  const handleReset = async () => {
    try {
      const res = await resetMutation.mutateAsync({ seed_demo_data: true });
      await refetch();
      toast.success("Sandbox Reset Complete", "Seeded 10 PRs, 5 POs, 8 Vendors, and 4 RFQs");
    } catch (err: any) {
      toast.error("Reset Failed", err?.message || "Failed to reset sandbox data");
    }
  };

  const handleTimeTravel = async () => {
    try {
      const res = await timeTravelMutation.mutateAsync({ advance_days: advanceDays });
      setTimeTravelResult(res);
      toast.success("Time Travel Executed", `Advanced clock by ${advanceDays} days`);
    } catch (err: any) {
      toast.error("Time Travel Failed", err?.message || "Failed to simulate time travel");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Box className="w-4 h-4" />
            <span>Developer Sandbox Engine (SPEC_28)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Interactive Sandbox Console</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Experiment with procurement APIs without fear. Reset environment data on demand and simulate future dates to test automated SLA notifications.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Isolated Sandbox Active</span>
        </div>
      </div>

      {/* Status & Volume Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Sandbox Organization</span>
          <div className="text-base font-bold text-white mt-1 line-clamp-1">
            {isLoading ? "Loading..." : status?.sandbox_org_name || "Sandbox Org"}
          </div>
          <span className="text-[10px] text-cyan-400 font-mono mt-1 block">
            ID: {status?.sandbox_org_id || "default"}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Seeded Requisitions</span>
          <div className="text-2xl font-bold text-white mt-1">
            {isLoading ? "-" : status?.seeded_counts?.requisitions ?? 10}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <FileText className="w-3 h-3 text-cyan-400" /> Across 3 business units
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Purchase Orders</span>
          <div className="text-2xl font-bold text-white mt-1">
            {isLoading ? "-" : status?.seeded_counts?.purchase_orders ?? 5}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Package className="w-3 h-3 text-amber-400" /> Live POs in dispatch
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Active Mock Vendors</span>
          <div className="text-2xl font-bold text-white mt-1">
            {isLoading ? "-" : status?.seeded_counts?.vendors ?? 8}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Users className="w-3 h-3 text-emerald-400" /> MSME & Tier-1 vendors
          </span>
        </div>
      </div>

      {/* Control Panels: Reset & Time Travel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reset Sandbox */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Reset Sandbox Data</h2>
              <p className="text-xs text-slate-400">Flush all mock mutations and reseed clean transactions</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Resetting returns your sandbox organization to a pristine baseline state. All test requisitions, bids, invoices, and webhook logs created during testing will be refreshed.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {resetMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span>Reset & Reseed Data</span>
            </button>
          </div>
        </div>

        {/* Time Travel Simulation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Simulate Time Travel</h2>
              <p className="text-xs text-slate-400">Fast-forward sandbox clock to test SLA escalations</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Advance the simulated server clock by a chosen number of days. Useful to verify invoice payment due warnings, RFQ submission deadlines, and approval auto-escalations.
          </p>

          <div className="flex items-center gap-3">
            {[7, 14, 30, 60].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setAdvanceDays(days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  advanceDays === days
                    ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600"
                }`}
              >
                +{days} Days
              </button>
            ))}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleTimeTravel}
              disabled={timeTravelMutation.isPending}
              className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {timeTravelMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              <span>Execute Time Advance</span>
            </button>
          </div>

          {timeTravelResult && (
            <div className="mt-3 p-3 bg-slate-950/80 rounded-xl border border-cyan-500/30 text-xs space-y-1">
              <div className="text-cyan-400 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Simulated Target: {new Date(timeTravelResult.simulated_date).toLocaleDateString()}</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Triggered: {timeTravelResult.expired_rfqs_count} expired RFQ bid deadlines, {timeTravelResult.due_invoices_count} overdue invoice payment terms.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
