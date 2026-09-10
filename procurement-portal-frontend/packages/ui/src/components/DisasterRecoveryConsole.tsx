"use client";

import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Activity,
  HardDrive,
  Play,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Database,
  Server,
  Zap,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  useDRPosture,
  useDRCheckpoints,
  useDRDrills,
  useTriggerPITRSnapshot,
  useVerifyCheckpoint,
  useRunFailoverDrill,
} from "@procurement/hooks";
import type { DRBackupCheckpoint, DRFailoverDrill, DRPostureMetrics } from "@procurement/types";

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const cfg: Record<string, string> = {
    HEALTHY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    VERIFIED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    PASSED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    WARNING: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    CRITICAL: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    SCHEDULED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    ABORTED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  const cls = cfg[status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

interface RPOGaugeProps {
  current: number;
  target: number;
  label: string;
  unit?: string;
}

function SLAGauge({ current, target, label, unit = "min" }: RPOGaugeProps) {
  const pct = Math.min(100, Math.round((current / (target * 2)) * 100));
  const isOk = current <= target;
  const isWarn = current <= target * 1.5 && !isOk;
  const color = isOk ? "from-emerald-500 to-emerald-400" : isWarn ? "from-amber-500 to-amber-400" : "from-rose-500 to-rose-400";
  const textColor = isOk ? "text-emerald-600 dark:text-emerald-400" : isWarn ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>{current}{unit}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-slate-400">Target: ≤ {target}{unit}</div>
    </div>
  );
}

interface CheckpointRowProps {
  checkpoint: DRBackupCheckpoint;
  onVerify: (id: string) => void;
  isVerifying: boolean;
}

function CheckpointRow({ checkpoint, onVerify, isVerifying }: CheckpointRowProps) {
  const sizeLabel = checkpoint.size_bytes > 1_000_000
    ? `${(checkpoint.size_bytes / 1_048_576).toFixed(1)} MB`
    : `${(checkpoint.size_bytes / 1024).toFixed(0)} KB`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1e] hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#252529] flex items-center justify-center shrink-0">
          <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{checkpoint.checkpoint_type.replace(/_/g, " ")}</span>
            <StatusBadge status={checkpoint.status} />
            {checkpoint.worm_locked && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 text-[10px] font-bold">
                <Lock className="w-2.5 h-2.5" /> WORM
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-xs">
            {checkpoint.storage_location.split("/").slice(-1)[0]}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="text-xs text-slate-500 dark:text-slate-400">{sizeLabel}</div>
          <div className="text-[10px] text-slate-400 font-mono">{checkpoint.checksum_sha256.slice(0, 8)}…</div>
        </div>
        {checkpoint.status !== "VERIFIED" && (
          <button
            onClick={() => onVerify(checkpoint.id)}
            disabled={isVerifying}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
          >
            <ShieldCheck className="w-3 h-3" />
            {isVerifying ? "Verifying…" : "Verify"}
          </button>
        )}
      </div>
    </div>
  );
}

interface DrillRowProps {
  drill: DRFailoverDrill;
  isExpanded: boolean;
  onToggle: () => void;
}

function DrillRow({ drill, isExpanded, onToggle }: DrillRowProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white dark:bg-[#1a1a1e] hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#252529] flex items-center justify-center shrink-0">
            <Play className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{drill.drill_code}</span>
              <StatusBadge status={drill.status} />
              {drill.rpo_compliant && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">RPO ✓</span>}
              {drill.rto_compliant && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">RTO ✓</span>}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{drill.drill_name}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {drill.actual_rpo_minutes != null && (
            <div className="text-right text-xs">
              <div className="text-slate-500 dark:text-slate-400">RPO: {Number(drill.actual_rpo_minutes).toFixed(1)}m</div>
              <div className="text-slate-500 dark:text-slate-400">RTO: {Number(drill.actual_rto_minutes).toFixed(1)}m</div>
            </div>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111114] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {drill.drill_phases.map((phase, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 bg-white dark:bg-[#1a1a1e] rounded-lg border border-slate-200 dark:border-white/10">
                {phase.status === "PASSED"
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{phase.phase_name.replace(/_/g, " ")}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{phase.duration_seconds}s • {phase.description.slice(0, 60)}…</div>
                </div>
              </div>
            ))}
          </div>
          {drill.audit_report.executive_summary && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">Executive Audit Summary</span>
              </div>
              <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">{drill.audit_report.executive_summary}</p>
              {drill.audit_report.sha256_audit_seal && (
                <div className="mt-2 font-mono text-[9px] text-indigo-400">
                  SHA-256 Seal: {drill.audit_report.sha256_audit_seal}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DisasterRecoveryConsole() {
  const [activeTab, setActiveTab] = useState<"posture" | "checkpoints" | "drills">("posture");
  const [expandedDrill, setExpandedDrill] = useState<string | null>(null);
  const [showDrillForm, setShowDrillForm] = useState(false);
  const [drillName, setDrillName] = useState("Quarterly Multi-Region Datacenter Blackout Drill");
  const [drillScenario, setDrillScenario] = useState("PRIMARY_REGION_OUTAGE");

  const { data: posture, isLoading: postureLoading, refetch: refetchPosture } = useDRPosture();
  const { data: checkpoints, isLoading: checkpointsLoading } = useDRCheckpoints();
  const { data: drills, isLoading: drillsLoading } = useDRDrills();

  const triggerSnapshot = useTriggerPITRSnapshot();
  const verifyCheckpoint = useVerifyCheckpoint();
  const runDrill = useRunFailoverDrill();

  const handleTriggerSnapshot = async (type: string) => {
    try {
      await triggerSnapshot.mutateAsync({
        checkpoint_type: type,
        storage_tier: "HOT_STANDBY",
        worm_locked: true,
        retention_days: 30,
      });
    } catch {
      alert("Failed to trigger snapshot. Check API status.");
    }
  };

  const handleVerify = async (id: string) => {
    try {
      await verifyCheckpoint.mutateAsync(id);
    } catch {
      alert("Verification failed. Checkpoint may be inaccessible.");
    }
  };

  const handleRunDrill = async () => {
    if (!drillName.trim()) return;
    try {
      await runDrill.mutateAsync({
        drill_name: drillName,
        simulated_disaster_scenario: drillScenario,
        target_rpo_minutes: 60,
        target_rto_minutes: 240,
      });
      setShowDrillForm(false);
    } catch {
      alert("Drill execution failed. Ensure secondary cluster is configured.");
    }
  };

  const readinessColor = posture?.dr_readiness_status === "HEALTHY"
    ? "text-emerald-600 dark:text-emerald-400"
    : posture?.dr_readiness_status === "WARNING"
    ? "text-amber-600 dark:text-amber-400"
    : "text-rose-600 dark:text-rose-400";

  const readinessBorder = posture?.dr_readiness_status === "HEALTHY"
    ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20"
    : posture?.dr_readiness_status === "WARNING"
    ? "border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20"
    : "border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/20";

  type TabDef = { id: "posture" | "checkpoints" | "drills"; label: string; icon: React.FC<any>; badge?: number };
  const tabs: TabDef[] = [
    { id: "posture", label: "DR Posture", icon: Shield },
    { id: "checkpoints", label: "Backup Checkpoints", icon: HardDrive, badge: checkpoints?.length },
    { id: "drills", label: "Failover Drills", icon: Activity, badge: drills?.length },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Disaster Recovery Orchestrator
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            PITR WAL Archive Tracker · MinIO WORM Integrity · RPO/RTO SLA Gauges · Automated Failover Drill Execution
          </p>
        </div>
        <button
          onClick={() => refetchPosture()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#252529] dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Posture Banner */}
      {posture && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${readinessBorder}`}>
          <div className="flex items-center gap-3">
            {posture.dr_readiness_status === "HEALTHY"
              ? <ShieldCheck className={`w-6 h-6 ${readinessColor}`} />
              : posture.dr_readiness_status === "WARNING"
              ? <AlertTriangle className={`w-6 h-6 ${readinessColor}`} />
              : <ShieldAlert className={`w-6 h-6 ${readinessColor}`} />}
            <div>
              <div className={`text-sm font-bold ${readinessColor}`}>
                DR Readiness: {posture.dr_readiness_status}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Secondary Cluster: {posture.secondary_cluster_status.replace(/_/g, " ")} · DNS Failover TTL: {posture.dns_failover_ttl_seconds}s
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>{posture.recent_drills_passed}/{posture.recent_drills_total} drills passed</span>
            <span>{posture.total_checkpoints_count} checkpoints</span>
            <span>{Number(posture.worm_locked_percentage).toFixed(0)}% WORM-locked</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-white/10">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === id
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {badge != null && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-[#333338] text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ——— POSTURE TAB ——— */}
      {activeTab === "posture" && (
        <div className="space-y-6">
          {postureLoading ? (
            <div className="p-20 text-center text-slate-400">Loading DR posture…</div>
          ) : posture ? (
            <>
              {/* SLA Gauges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-white dark:bg-[#1a1a1e] rounded-2xl border border-slate-200 dark:border-white/10">
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-4 uppercase tracking-wide">RPO / RTO SLA Status</h3>
                  <div className="space-y-5">
                    <SLAGauge
                      current={Number(posture.current_rpo_minutes)}
                      target={posture.target_rpo_minutes}
                      label="Current RPO (Recovery Point Objective)"
                    />
                    <SLAGauge
                      current={Math.floor(Number(posture.current_rpo_minutes) * 3.8)}
                      target={posture.target_rto_minutes}
                      label="Estimated RTO (Recovery Time Objective)"
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-4 uppercase tracking-wide">Storage & WORM Integrity</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#111114] border border-slate-200 dark:border-white/10">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-violet-500" />
                        <span className="text-xs text-slate-600 dark:text-slate-300">WORM Lock Coverage</span>
                      </div>
                      <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{Number(posture.worm_locked_percentage).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#111114] border border-slate-200 dark:border-white/10">
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-xs text-slate-600 dark:text-slate-300">Total Checkpoints</span>
                      </div>
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{posture.total_checkpoints_count}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#111114] border border-slate-200 dark:border-white/10">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs text-slate-600 dark:text-slate-300">Total Backup Storage</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {posture.total_storage_bytes > 1_000_000_000
                          ? `${(posture.total_storage_bytes / 1_073_741_824).toFixed(2)} GB`
                          : `${(posture.total_storage_bytes / 1_048_576).toFixed(0)} MB`}
                      </span>
                    </div>
                    {posture.last_verified_checksum && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
                        <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mb-1">Last Verified Checksum</div>
                        <div className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 break-all">{posture.last_verified_checksum}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-4 bg-slate-50 dark:bg-[#111114] rounded-xl border border-slate-200 dark:border-white/10">
                <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">On-Demand Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleTriggerSnapshot("POSTGRES_PITR_WAL")}
                    disabled={triggerSnapshot.isPending}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    <Database className="w-3.5 h-3.5" />
                    {triggerSnapshot.isPending ? "Triggering…" : "Trigger PITR WAL Snapshot"}
                  </button>
                  <button
                    onClick={() => handleTriggerSnapshot("MINIO_WORM_SNAPSHOT")}
                    disabled={triggerSnapshot.isPending}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {triggerSnapshot.isPending ? "Triggering…" : "Capture MinIO WORM Snapshot"}
                  </button>
                  <button
                    onClick={() => { setActiveTab("drills"); setShowDrillForm(true); }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Run Simulated Failover Drill
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ——— CHECKPOINTS TAB ——— */}
      {activeTab === "checkpoints" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              PITR WAL Archives & Immutable Storage Snapshots
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleTriggerSnapshot("POSTGRES_PITR_WAL")}
                disabled={triggerSnapshot.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                <Database className="w-3 h-3" />
                {triggerSnapshot.isPending ? "Archiving…" : "New PITR Snapshot"}
              </button>
              <button
                onClick={() => handleTriggerSnapshot("MINIO_WORM_SNAPSHOT")}
                disabled={triggerSnapshot.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                <Lock className="w-3 h-3" />
                WORM Snapshot
              </button>
            </div>
          </div>
          {checkpointsLoading ? (
            <div className="p-20 text-center text-slate-400">Loading checkpoints…</div>
          ) : (checkpoints ?? []).length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <HardDrive className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>No backup checkpoints found. Trigger an on-demand snapshot to begin.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(checkpoints ?? []).map((cp) => (
                <CheckpointRow
                  key={cp.id}
                  checkpoint={cp}
                  onVerify={handleVerify}
                  isVerifying={verifyCheckpoint.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ——— DRILLS TAB ——— */}
      {activeTab === "drills" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Automated Failover Drill History & Executive Audit Reports
            </h2>
            <button
              onClick={() => setShowDrillForm(!showDrillForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
            >
              <Zap className="w-3 h-3" />
              Run New Drill
            </button>
          </div>

          {/* Drill Form */}
          {showDrillForm && (
            <div className="p-4 bg-white dark:bg-[#1a1a1e] rounded-2xl border border-slate-200 dark:border-white/10 space-y-3">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Configure Failover Drill</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Drill Name</label>
                  <input
                    value={drillName}
                    onChange={(e) => setDrillName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#111114] text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Disaster Scenario</label>
                  <select
                    value={drillScenario}
                    onChange={(e) => setDrillScenario(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#111114] text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PRIMARY_REGION_OUTAGE">Primary Region Outage</option>
                    <option value="DATABASE_CORRUPTION">Database Corruption</option>
                    <option value="RANSOMWARE_EVENT">Ransomware Event</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDrillForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:underline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRunDrill}
                  disabled={runDrill.isPending || !drillName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  <Play className="w-3 h-3" />
                  {runDrill.isPending ? "Executing Drill…" : "Execute Failover Drill"}
                </button>
              </div>
            </div>
          )}

          {drillsLoading ? (
            <div className="p-20 text-center text-slate-400">Loading drill history…</div>
          ) : (drills ?? []).length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <Server className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>No disaster recovery drills executed yet. Run a simulated failover drill to validate your RPO/RTO SLAs.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(drills ?? []).map((drill) => (
                <DrillRow
                  key={drill.id}
                  drill={drill}
                  isExpanded={expandedDrill === drill.id}
                  onToggle={() => setExpandedDrill(expandedDrill === drill.id ? null : drill.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
