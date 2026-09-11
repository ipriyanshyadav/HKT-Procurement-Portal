"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useRfq,
  useComparativeStatement,
  useCSVersions,
  useGenerateCS,
  useSendRegretLetters,
  useVendors,
  useAwardOptimizationScenarios,
  useApplyOptimizationScenario,
} from "@procurement/hooks";
import type { AwardOptimizationScenario } from "@procurement/types";
import { ComparativeStatementTable, Button, Badge, PermissionGuard } from "@procurement/ui";
import {
  Zap,
  Sparkles,
  TrendingDown,
  Layers,
  ShieldCheck,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function EvaluationPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params?.id as string;

  const { data: rfq, isLoading: rfqLoading } = useRfq(rfqId);
  const { data: cs, isLoading: csLoading, error: csError, refetch: refetchCS } = useComparativeStatement(rfqId);
  const { data: versions } = useCSVersions(rfqId);
  const { data: vendorsData } = useVendors({ page: 1, page_size: 100 });

  const generateCSMutation = useGenerateCS();
  const sendRegretsMutation = useSendRegretLetters();
  const { data: scenariosData, isLoading: scenariosLoading, refetch: refetchScenarios } = useAwardOptimizationScenarios(cs?.id);
  const applyScenarioMutation = useApplyOptimizationScenario();

  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | null>(null);

  const handleApplyScenario = async (scenario: AwardOptimizationScenario) => {
    if (!cs) return;
    if (!confirm(`Apply "${scenario.title}" allocation scenario to this Comparative Statement? This will update line-level rankings.`)) return;
    try {
      await applyScenarioMutation.mutateAsync({
        csId: cs.id,
        data: { scenario_type: scenario.scenario_type },
      });
      setFeedbackMessage(`Sourcing optimization scenario "${scenario.title}" applied successfully!`);
      refetchCS();
      refetchScenarios();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to apply optimization scenario");
    }
  };

  const vendorMap: Record<string, string> = {};
  if (vendorsData?.vendors) {
    for (const v of vendorsData.vendors) {
      vendorMap[v.id] = v.company_name;
    }
  }

  const handleGenerateCS = async () => {
    try {
      await generateCSMutation.mutateAsync({ rfqId });
      setFeedbackMessage("Comparative Statement generated successfully!");
      refetchCS();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to generate Comparative Statement");
    }
  };

  const handleSendRegretLetters = async () => {
    if (!cs) return;
    if (!confirm("Are you sure you want to dispatch regret letters to non-awarded vendors?")) return;
    try {
      const res = await sendRegretsMutation.mutateAsync({ csId: cs.id });
      setFeedbackMessage(res?.message || "Regret letters dispatched successfully!");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to send regret letters");
    }
  };

  if (rfqLoading || csLoading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">
        Loading evaluation and comparative statement...
      </div>
    );
  }

  if (!rfq) {
    return <div className="p-12 text-center text-sm text-red-500">RFQ not found.</div>;
  }

  const bidsOpened = Boolean(rfq.bids_opened_at);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Breadcrumb Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href="/rfqs" className="hover:underline">
              RFQs
            </Link>
            <span>/</span>
            <Link href={`/rfqs/${rfqId}`} className="hover:underline font-mono">
              {rfq.rfq_number}
            </Link>
            <span>/</span>
            <span className="font-semibold text-foreground">Evaluation</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Comparative Statement & Bid Evaluation
            </h1>
            {cs && (
              <Badge variant={cs.status === "APPROVED" ? "success" : "secondary"}>
                {cs.status}
              </Badge>
            )}
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/rfqs/${rfqId}`}
            className="px-3.5 py-2 text-xs font-medium border border-border/60 rounded-xl hover:bg-muted transition"
          >
            &larr; Back to RFQ
          </Link>

          {bidsOpened && (
            <PermissionGuard permission="rfq.evaluate">
              <Button
                size="sm"
                variant={cs ? "secondary" : "primary"}
                disabled={generateCSMutation.isPending}
                onClick={handleGenerateCS}
              >
                {generateCSMutation.isPending
                  ? "Generating CS..."
                  : cs
                  ? "Re-Generate CS"
                  : "⚡ Generate Comparative Statement"}
              </Button>
            </PermissionGuard>
          )}

          {cs && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => router.push(`/rfqs/${rfqId}/evaluation/negotiate`)}
              >
                💬 Negotiate {selectedVendors.length > 0 ? `(${selectedVendors.length})` : ""}
              </Button>

              <PermissionGuard permission="rfq.award">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => router.push(`/rfqs/${rfqId}/award`)}
                >
                  🏆 Award Recommendation
                </Button>
              </PermissionGuard>

              {cs.status === "APPROVED" && (
                <PermissionGuard permission="rfq.award">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={sendRegretsMutation.isPending}
                    onClick={handleSendRegretLetters}
                  >
                    {sendRegretsMutation.isPending ? "Sending..." : "✉️ Send Regrets"}
                  </Button>
                </PermissionGuard>
              )}
            </>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
          <span>{feedbackMessage}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="hover:opacity-75 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Version History Selector */}
      {versions && versions.length > 1 && (
        <div className="flex items-center gap-2 text-xs bg-muted/20 p-2.5 rounded-xl border border-border/30">
          <span className="text-muted-foreground font-medium">Evaluation Versions:</span>
          {versions.map((v) => (
            <Badge
              key={v.id}
              variant={v.cs_version === cs?.cs_version ? "default" : "outline"}
              className="cursor-pointer font-mono text-[11px]"
            >
              v{v.cs_version} ({v.status})
            </Badge>
          ))}
        </div>
      )}

      {/* Main CS View */}
      {!bidsOpened ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center space-y-3 bg-muted/10">
          <div className="text-3xl">🔒</div>
          <h3 className="text-base font-semibold text-foreground">Bids Still Sealed</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Comparative Statement generation requires dual-authorization bid opening. Complete the bid opening ceremony before generating the CS.
          </p>
          <Link
            href={`/rfqs/${rfqId}/open-bids`}
            className="inline-block mt-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl"
          >
            Go to Bid Opening Console &rarr;
          </Link>
        </div>
      ) : !cs ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center space-y-4 bg-muted/10">
          <div className="text-3xl">📊</div>
          <h3 className="text-base font-semibold text-foreground">
            No Comparative Statement Generated Yet
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Bids have been unsealed and normalized into INR. Click below to trigger automatic commercial ranking, technical-commercial weighting, and L1 discovery.
          </p>
          <Button
            size="lg"
            disabled={generateCSMutation.isPending}
            onClick={handleGenerateCS}
            className="shadow-sm"
          >
            {generateCSMutation.isPending ? "Generating..." : "Generate Comparative Statement Now"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* CS Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md">
              <span className="text-xs text-muted-foreground block font-medium">Estimated Value</span>
              <span className="text-lg font-bold font-mono text-foreground mt-0.5 block">
                ₹{Number(cs.total_estimated_value).toLocaleString()}
              </span>
            </div>
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-semibold">
                L1 Discovered Total
              </span>
              <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                ₹{Number(cs.l1_total_value || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-4 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md">
              <span className="text-xs text-muted-foreground block font-medium">Projected Savings</span>
              <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {cs.savings_percentage ? `${Number(cs.savings_percentage).toFixed(2)}%` : "0.00%"}
              </span>
            </div>
            <div className="p-4 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md">
              <span className="text-xs text-muted-foreground block font-medium">MinIO Storage</span>
              <span className="text-xs font-mono text-muted-foreground truncate block mt-1.5" title={cs.document_path || ""}>
                {cs.document_path ? cs.document_path.split("/").pop() : "Pending generation"}
              </span>
            </div>
          </div>

          {/* ⚡ Sourcing Award Optimization Engine */}
          {scenariosData?.scenarios && scenariosData.scenarios.length > 0 && (
            <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-[#171822] dark:via-[#1C1C1F] dark:to-[#1a1c29] rounded-2xl border border-indigo-200/70 dark:border-indigo-900/40 p-6 space-y-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-indigo-100 dark:border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white">
                      <Zap className="h-3 w-3" /> Sourcing Engine
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Award Optimization Scenarios (Ariba & Coupa Inspired)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Evaluate trade-offs between single-vendor economies of scale, cherry-picking line-by-line lowest landed cost, and dual-sourcing business continuity.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 text-right">
                  Baseline Spend: <span className="font-bold text-slate-800 dark:text-slate-200">₹{Number(scenariosData.baseline_spend).toLocaleString()}</span>
                </div>
              </div>

              {/* Scenarios Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {scenariosData.scenarios.map((sc) => {
                  const isExpanded = expandedScenarioId === sc.scenario_id;
                  const isCherryPick = sc.scenario_type === "LINE_ITEM_BEST";
                  const isDualSource = sc.scenario_type === "DUAL_SOURCING_70_30";

                  return (
                    <div
                      key={sc.scenario_id}
                      className={`rounded-xl border p-5 flex flex-col justify-between transition-all relative ${
                        isCherryPick
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 shadow-xs"
                          : isDualSource
                          ? "bg-purple-50/40 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800/60"
                          : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            {sc.scenario_type.replace(/_/g, " ")}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              sc.risk_rating === "LOW"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                                : sc.risk_rating === "MEDIUM"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300"
                            }`}
                          >
                            Risk: {sc.risk_rating}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{sc.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {sc.description}
                          </p>
                        </div>

                        {/* Financial Metrics Box */}
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-1.5 font-mono text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400 font-sans">Projected Spend:</span>
                            <span className="font-bold text-slate-900 dark:text-white">₹{Number(sc.total_spend).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400 font-sans">Net Savings:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              +₹{Number(sc.projected_savings).toLocaleString()} ({sc.savings_percentage}%)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400 font-sans">Vendors Awarded:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{sc.vendor_count} Partner(s)</span>
                          </div>
                        </div>

                        {/* Advantages & Tradeoffs */}
                        <div className="space-y-2 text-xs pt-1">
                          <div className="space-y-1">
                            {sc.advantages.map((adv, idx) => (
                              <div key={idx} className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300 text-[11px]">
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                <span>{adv}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
                            {sc.tradeoffs.map((trd, idx) => (
                              <div key={idx} className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                                <span className="text-amber-500 shrink-0">•</span>
                                <span>{trd}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 space-y-2">
                        <button
                          type="button"
                          onClick={() => setExpandedScenarioId(isExpanded ? null : sc.scenario_id)}
                          className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center gap-1 transition-colors"
                        >
                          <span>{isExpanded ? "Hide Line Allocations" : "Inspect Line Allocations"}</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>

                        <PermissionGuard permission="evaluation.award">
                          <Button
                            onClick={() => handleApplyScenario(sc)}
                            disabled={applyScenarioMutation.isPending}
                            className={`w-full text-xs font-semibold py-2 shadow-xs ${
                              isCherryPick
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : isDualSource
                                ? "bg-purple-600 hover:bg-purple-700 text-white"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white"
                            }`}
                            leftIcon={<Zap className="h-3.5 w-3.5" />}
                          >
                            {applyScenarioMutation.isPending ? "Applying Scenario..." : `Apply ${sc.title}`}
                          </Button>
                        </PermissionGuard>
                      </div>

                      {/* Expanded Line Allocations Modal/Table */}
                      {isExpanded && (
                        <div className="col-span-full mt-4 p-4 rounded-xl bg-slate-900 text-white text-xs space-y-2 border border-slate-800">
                          <div className="font-semibold text-slate-200 flex items-center justify-between">
                            <span>Line Allocations Breakdown — {sc.title}</span>
                            <span className="font-mono text-emerald-400">Total: ₹{Number(sc.total_spend).toLocaleString()}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-800 text-[11px]">
                              <thead>
                                <tr className="text-slate-400 text-left">
                                  <th className="py-2 pr-2">Line #</th>
                                  <th className="py-2 px-2">Description</th>
                                  <th className="py-2 px-2 text-right">Qty</th>
                                  <th className="py-2 px-2">Assigned Vendor</th>
                                  <th className="py-2 px-2 text-right">Unit Price</th>
                                  <th className="py-2 pl-2 text-right">Line Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 font-mono">
                                {sc.allocations.map((alloc) => (
                                  <tr key={alloc.rfq_line_id} className="text-slate-300">
                                    <td className="py-2 pr-2">{alloc.line_number}</td>
                                    <td className="py-2 px-2 font-sans font-medium text-white">{alloc.item_description}</td>
                                    <td className="py-2 px-2 text-right">{alloc.quantity}</td>
                                    <td className="py-2 px-2 font-sans text-indigo-300">{alloc.allocated_vendor_name}</td>
                                    <td className="py-2 px-2 text-right">₹{alloc.unit_price.toLocaleString()}</td>
                                    <td className="py-2 pl-2 text-right font-bold text-white">₹{alloc.line_total.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comparative Statement Responsive Table */}
          <ComparativeStatementTable
            cs={cs}
            vendorNames={vendorMap}
            onShortlistChange={(vids) => setSelectedVendors(vids)}
            onNegotiateVendor={(vid) => router.push(`/rfqs/${rfqId}/evaluation/negotiate`)}
            onAwardVendor={() => router.push(`/rfqs/${rfqId}/award`)}
          />
        </div>
      )}
    </div>
  );
}
