"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  DollarSign,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  XCircle,
} from "lucide-react";
import {
  useMaverickClusters,
  useDetectMaverickAnomalies,
  useUpdateMaverickClusterStatus,
} from "@procurement/hooks";
import type { MaverickSpendCluster } from "@procurement/types";

export interface MaverickIntelligenceWorkbenchProps {
  currency?: string;
  className?: string;
}

export function MaverickIntelligenceWorkbench({
  currency = "₹",
  className = "",
}: MaverickIntelligenceWorkbenchProps) {
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data, isLoading, refetch } = useMaverickClusters();
  const detectMutation = useDetectMaverickAnomalies();
  const statusMutation = useUpdateMaverickClusterStatus();

  const clusters = useMemo(() => {
    return data?.clusters ?? [];
  }, [data]);

  const filteredClusters = useMemo(() => {
    return clusters.filter((c) => {
      const matchType = selectedType === "ALL" || c.cluster_type === selectedType;
      const matchStatus = selectedStatus === "ALL" || c.status === selectedStatus;
      const matchSearch =
        searchQuery === "" ||
        c.cluster_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.root_cause_analysis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.ai_recommendation.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchStatus && matchSearch;
    });
  }, [clusters, selectedType, selectedStatus, searchQuery]);

  const formatCurrency = (val: number) => {
    if (val >= 10_000_000) return `${currency}${(val / 10_000_000).toFixed(2)}Cr`;
    if (val >= 100_000) return `${currency}${(val / 100_000).toFixed(1)}L`;
    if (val >= 1_000) return `${currency}${(val / 1_000).toFixed(1)}k`;
    return `${currency}${val.toLocaleString()}`;
  };

  const handleStatusChange = async (clusterId: string, nextStatus: string) => {
    await statusMutation.mutateAsync({
      clusterId,
      status: nextStatus,
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#1A1A1E] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Total Anomaly Clusters</span>
            <BrainCircuit className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {data?.total_clusters ?? 0}
            </span>
            <span className="text-xs text-neutral-400">active patterns</span>
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-300">High & Critical Risk</span>
            <ShieldAlert className="h-5 w-5 text-red-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-red-400">
              {(data?.critical_count ?? 0) + (data?.high_count ?? 0)}
            </span>
            <span className="text-xs text-red-400/80">urgent triage</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-300">Total Leaked Spend</span>
            <TrendingDown className="h-5 w-5 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-amber-400">
              {formatCurrency(data?.total_leaked_spend ?? 0)}
            </span>
            <span className="text-xs text-amber-400/80">maverick volume</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-300">Projected Recovery Savings</span>
            <DollarSign className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-400">
              {formatCurrency(data?.projected_savings_recovery ?? 0)}
            </span>
            <span className="text-xs text-emerald-400/80">negotiation ROI</span>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#1A1A1E] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search anomalies, root causes, AI actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#252529] py-2 pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#252529] px-3 py-2 text-xs text-neutral-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">All Cluster Types</option>
            <option value="RETROACTIVE_PO">Retroactive POs</option>
            <option value="SPLIT_PURCHASE_ORDER">Split Orders (&lt;₹50k)</option>
            <option value="OFF_CONTRACT_LEAKAGE">Off-Contract Leakage</option>
            <option value="PRICE_VARIANCE_DISPERSION">Price Variance Dispersion</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#252529] px-3 py-2 text-xs text-neutral-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">All Triage Statuses</option>
            <option value="DETECTED">Detected</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
            <option value="FALSE_POSITIVE">False Positive</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#252529] px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => detectMutation.mutate()}
            disabled={detectMutation.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
          >
            <Sparkles className={`h-3.5 w-3.5 ${detectMutation.isPending ? "animate-spin" : ""}`} />
            {detectMutation.isPending ? "Scanning Spend Engine..." : "Run AI Anomaly Scan"}
          </button>
        </div>
      </div>

      {/* Cluster List */}
      <div className="space-y-4">
        {filteredClusters.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#1A1A1E] p-12 text-center">
            <BrainCircuit className="mx-auto h-10 w-10 text-neutral-600" />
            <p className="mt-3 text-sm font-medium text-neutral-400">No maverick spend clusters match current filters.</p>
            <p className="mt-1 text-xs text-neutral-500">
              Click &quot;Run AI Anomaly Scan&quot; to evaluate active purchase orders and invoices.
            </p>
          </div>
        ) : (
          filteredClusters.map((cluster) => {
            const isCritical = cluster.severity === "CRITICAL";
            const isHigh = cluster.severity === "HIGH";

            return (
              <div
                key={cluster.id}
                className="rounded-2xl border border-white/10 bg-[#1A1A1E] p-5 shadow-sm transition-all hover:border-white/20"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          isCritical
                            ? "border border-red-500/30 bg-red-500/10 text-red-400"
                            : isHigh
                            ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                            : "border border-blue-500/30 bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {cluster.severity}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono font-medium text-neutral-300">
                        {cluster.cluster_type}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          cluster.status === "RESOLVED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : cluster.status === "INVESTIGATING"
                            ? "bg-blue-500/20 text-blue-300"
                            : cluster.status === "FALSE_POSITIVE"
                            ? "bg-neutral-500/20 text-neutral-400"
                            : "bg-purple-500/20 text-purple-300"
                        }`}
                      >
                        {cluster.status}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-white">{cluster.cluster_title}</h3>
                  </div>

                  {/* Spend Impact & Actions */}
                  <div className="flex flex-wrap items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                    <div className="text-right">
                      <div className="text-xs text-neutral-400">Leaked Spend Impact</div>
                      <div className="text-base font-bold text-amber-400">{formatCurrency(cluster.affected_spend)}</div>
                      <div className="text-[11px] text-emerald-400 font-medium">
                        Potential Savings: {formatCurrency(cluster.potential_savings)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {cluster.status !== "INVESTIGATING" && (
                        <button
                          onClick={() => handleStatusChange(cluster.id, "INVESTIGATING")}
                          disabled={statusMutation.isPending}
                          className="rounded-lg border border-white/10 bg-[#252529] px-2.5 py-1 text-[11px] font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
                        >
                          Investigate
                        </button>
                      )}
                      {cluster.status !== "RESOLVED" && (
                        <button
                          onClick={() => handleStatusChange(cluster.id, "RESOLVED")}
                          disabled={statusMutation.isPending}
                          className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Resolve
                        </button>
                      )}
                      {cluster.status !== "FALSE_POSITIVE" && (
                        <button
                          onClick={() => handleStatusChange(cluster.id, "FALSE_POSITIVE")}
                          disabled={statusMutation.isPending}
                          className="rounded-lg border border-white/10 bg-[#252529] px-2.5 py-1 text-[11px] font-medium text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                        >
                          False Positive
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Analysis & AI Recommendations */}
                <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-white/5 bg-[#252529]/60 p-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      Root Cause Analysis
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{cluster.root_cause_analysis}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      AI Recommended Countermeasure
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{cluster.ai_recommendation}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
