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
} from "@procurement/hooks";
import { ComparativeStatementTable } from "@procurement/ui";
import { Button, Badge } from "@procurement/ui";

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

  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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

              <Button
                size="sm"
                variant="primary"
                onClick={() => router.push(`/rfqs/${rfqId}/award`)}
              >
                🏆 Award Recommendation
              </Button>

              {cs.status === "APPROVED" && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={sendRegretsMutation.isPending}
                  onClick={handleSendRegretLetters}
                >
                  {sendRegretsMutation.isPending ? "Sending..." : "✉️ Send Regrets"}
                </Button>
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
