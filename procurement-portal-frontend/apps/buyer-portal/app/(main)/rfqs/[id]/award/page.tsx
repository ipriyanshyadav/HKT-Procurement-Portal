"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useRfq,
  useComparativeStatement,
  useAwardRecommendation,
  useRecommendAward,
  useApproveAward,
  useVendors,
  useSendRegretLetters,
  useCreatePOFromAward,
} from "@procurement/hooks";
import { Button, Badge, Input, Textarea, PermissionGuard } from "@procurement/ui";
import { Mail, CheckCircle2, AlertCircle, Package } from "lucide-react";

interface AwardDraftItem {
  lot_id?: string | null;
  rfq_line_id?: string | null;
  vendor_id: string;
  bid_id: string;
  value: number;
  quantity: number;
  unit_price: number;
  award_type: string;
  justification: string;
}

export default function AwardRecommendationPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params?.id as string;

  const { data: rfq, isLoading: rfqLoading } = useRfq(rfqId);
  const { data: cs, isLoading: csLoading } = useComparativeStatement(rfqId);
  const { data: existingAward, isLoading: awardLoading, refetch: refetchAward } = useAwardRecommendation(cs?.id || "");
  const { data: vendorsData } = useVendors({ page: 1, page_size: 100 });

  const recommendMutation = useRecommendAward();
  const approveMutation = useApproveAward();
  const sendRegretLettersMutation = useSendRegretLetters();
  const createPOMutation = useCreatePOFromAward();

  const [awardItems, setAwardItems] = useState<AwardDraftItem[]>([]);
  const [overallJustification, setOverallJustification] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const vendorMap: Record<string, string> = {};
  if (vendorsData?.vendors) {
    for (const v of vendorsData.vendors) {
      vendorMap[v.id] = v.company_name;
    }
  }

  // Pre-fill award items from L1 rankings when CS loads and no award exists yet
  useEffect(() => {
    if (cs && cs.rankings && (!existingAward || existingAward.status === "DRAFT") && awardItems.length === 0) {
      // Find L1 per lot or overall L1
      const l1Rankings = cs.rankings.filter((r) => r.is_l1 || r.rank === 1);
      const items: AwardDraftItem[] = (l1Rankings.length > 0 ? l1Rankings : [cs.rankings[0]]).map((r) => {
        const val = Number(r.lot_total_inr || r.landed_cost || 0);
        return {
          lot_id: r.lot_id || null,
          rfq_line_id: r.rfq_line_id || null,
          vendor_id: r.vendor_id,
          bid_id: r.bid_id,
          value: val,
          quantity: 1,
          unit_price: val,
          award_type: "FULL",
          justification: `Awarded to L1 supplier based on lowest landed cost evaluation (₹${val.toLocaleString()})`,
        };
      });
      setAwardItems(items);
      setOverallJustification(
        `Award recommendation following technical qualification and commercial evaluation. Total recommended value is within estimated budget.`
      );
    }
  }, [cs, existingAward]);

  if (rfqLoading || csLoading || awardLoading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">
        Loading award recommendation console...
      </div>
    );
  }

  if (!rfq || !cs) {
    return (
      <div className="p-12 text-center text-sm text-red-500">
        Comparative Statement must be generated before recommending an award.
      </div>
    );
  }

  const handleRecommend = async () => {
    if (awardItems.length === 0) {
      alert("At least one award item must be specified.");
      return;
    }
    if (!overallJustification || overallJustification.length < 5) {
      alert("Please provide a comprehensive business justification for the award.");
      return;
    }
    try {
      await recommendMutation.mutateAsync({
        csId: cs.id,
        awards: awardItems,
        justification: overallJustification,
      });
      setFeedback("Award recommendation submitted successfully for approval!");
      refetchAward();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to submit award recommendation");
    }
  };

  const handleApprove = async () => {
    if (!existingAward) return;
    if (!confirm(`Approve award recommendation ${existingAward.arn_number}?`)) return;
    try {
      await approveMutation.mutateAsync({
        arnId: existingAward.id,
        comments: "Approved based on L1 compliance with CS statement",
      });
      setFeedback("Award recommendation approved successfully!");
      refetchAward();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to approve award");
    }
  };

  const handleDispatchRegretLetters = async () => {
    if (!cs?.id) return;
    if (
      !confirm(
        "Dispatch regret letters to all unsuccessful bidders for this RFQ? Formal non-award notices will be recorded and communicated."
      )
    ) {
      return;
    }
    try {
      await sendRegretLettersMutation.mutateAsync({ csId: cs.id });
      setFeedback("Regret letters dispatched successfully to all unawarded suppliers!");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to dispatch regret letters");
    }
  };

  const handleGeneratePurchaseOrders = async () => {
    if (!existingAward) return;
    if (!confirm(`Generate official Purchase Order(s) for Award Notice ${existingAward.arn_number}?`)) return;
    try {
      const pos = await createPOMutation.mutateAsync({
        arn_id: existingAward.id,
      });
      setFeedback(`Successfully generated ${pos.length} Purchase Order(s)!`);
      if (pos && pos.length === 1) {
        router.push(`/purchase-orders/${pos[0].id}`);
      } else {
        router.push("/purchase-orders");
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to generate Purchase Order(s)");
    }
  };

  const totalAwarded = awardItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Breadcrumb Navigation */}
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
            <Link href={`/rfqs/${rfqId}/evaluation`} className="hover:underline">
              Evaluation
            </Link>
            <span>/</span>
            <span className="font-semibold text-foreground">Award</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Award Recommendation Notice (ARN)
            </h1>
            {existingAward && (
              <Badge
                variant={
                  existingAward.status === "APPROVED"
                    ? "success"
                    : existingAward.status === "PENDING_APPROVAL"
                    ? "warning"
                    : "secondary"
                }
              >
                {existingAward.status}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/rfqs/${rfqId}/evaluation`}
            className="px-3.5 py-2 text-xs font-medium border border-border/60 rounded-xl hover:bg-muted transition"
          >
            &larr; Back to CS Table
          </Link>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="hover:opacity-75 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Existing Award Summary if already submitted */}
      {existingAward && (
        <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/30 pb-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Official Notice
              </span>
              <h3 className="text-lg font-bold font-mono text-foreground">
                {existingAward.arn_number}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Total Award Value</span>
              <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                ₹{Number(existingAward.total_awarded_value || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="text-xs text-foreground bg-muted/20 p-3.5 rounded-xl border border-border/20 space-y-1">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] block">
              Business Justification
            </span>
            <p className="leading-relaxed">{existingAward.justification}</p>
          </div>

          {/* Details Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/30 bg-muted/30 text-muted-foreground">
                  <th className="py-2.5 px-3">Vendor</th>
                  <th className="py-2.5 px-3">Lot / Line</th>
                  <th className="py-2.5 px-3 text-right">Awarded Price</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-mono">
                {existingAward.details.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 px-3 font-sans font-medium text-foreground">
                      {vendorMap[d.vendor_id] || d.vendor_id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {d.lot_id ? `Lot ${d.lot_id.slice(0, 8)}` : d.rfq_line_id ? `Line ${d.rfq_line_id.slice(0, 8)}` : "All"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                      ₹{Number(d.awarded_total).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <Badge variant="outline" className="text-[10px]">
                        {d.award_type}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-muted-foreground max-w-xs truncate" title={d.justification || ""}>
                      {d.justification || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Approver Action Bar */}
          {existingAward.status === "PENDING_APPROVAL" && (
            <div className="flex items-center justify-between pt-4 border-t border-border/30">
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                ⏳ Awaiting formal management approval before contracting.
              </span>
              <PermissionGuard permission="rfq.award">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={approveMutation.isPending}
                  onClick={handleApprove}
                >
                  {approveMutation.isPending ? "Approving..." : "Approve Award Recommendation"}
                </Button>
              </PermissionGuard>
            </div>
          )}

          {/* Approved Award Action Bar & Regret Letters (Plan 12) */}
          {existingAward.status === "APPROVED" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  Award approved. You may draft contracts or notify non-awarded bidders.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={sendRegretLettersMutation.isPending}
                  onClick={handleDispatchRegretLetters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-xl shadow-2xs transition-colors disabled:opacity-50"
                  title="Send formal regret letters to unsuccessful bidders"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {sendRegretLettersMutation.isPending ? "Dispatching Letters..." : "Dispatch Regret Letters"}
                </button>
                <PermissionGuard permission="po.create">
                  <button
                    type="button"
                    disabled={createPOMutation.isPending}
                    onClick={handleGeneratePurchaseOrders}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors disabled:opacity-50"
                    title="Generate Purchase Order(s) directly from this approved award"
                  >
                    <Package className="w-3.5 h-3.5" />
                    {createPOMutation.isPending ? "Generating PO..." : "Generate Purchase Order(s)"}
                  </button>
                </PermissionGuard>
                <Link
                  href={`/contracts/new?rfq_id=${rfqId}&vendor_id=${existingAward.details[0]?.vendor_id || ""}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors"
                >
                  Draft Contract &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Award Recommendation Form (shown when no award or revising) */}
      {(!existingAward || existingAward.status === "DRAFT") && (
        <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Configure Award Details
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Specify the awarded allocation, contract value, and vendor per lot or line item.
            </p>
          </div>

          <div className="space-y-4">
            {awardItems.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    Award Allocation #{idx + 1}
                  </span>
                  <Badge variant="info" className="text-[10px]">
                    {item.award_type}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground uppercase font-medium block mb-1">
                      Awarded Vendor
                    </label>
                    <select
                      value={item.vendor_id}
                      onChange={(e) => {
                        const vid = e.target.value;
                        const match = cs.rankings.find((r) => r.vendor_id === vid);
                        const newPrice = match ? Number(match.lot_total_inr || match.landed_cost || 0) : item.value;
                        const updated = [...awardItems];
                        updated[idx] = {
                          ...item,
                          vendor_id: vid,
                          bid_id: match ? match.bid_id : item.bid_id,
                          value: newPrice,
                          unit_price: newPrice,
                        };
                        setAwardItems(updated);
                      }}
                      className="w-full p-2 rounded-lg border border-border bg-background text-xs"
                    >
                      {cs.rankings.map((r) => (
                        <option key={r.id} value={r.vendor_id}>
                          {vendorMap[r.vendor_id] || `Vendor ${r.vendor_id.slice(0, 8)}`} (L{r.rank})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground uppercase font-medium block mb-1">
                      Award Value (INR)
                    </label>
                    <input
                      type="number"
                      value={item.value}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const updated = [...awardItems];
                        updated[idx] = { ...item, value: val, unit_price: val };
                        setAwardItems(updated);
                      }}
                      className="w-full p-2 rounded-lg border border-border bg-background font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground uppercase font-medium block mb-1">
                      Award Type
                    </label>
                    <select
                      value={item.award_type}
                      onChange={(e) => {
                        const updated = [...awardItems];
                        updated[idx] = { ...item, award_type: e.target.value };
                        setAwardItems(updated);
                      }}
                      className="w-full p-2 rounded-lg border border-border bg-background text-xs"
                    >
                      <option value="FULL">FULL (100%)</option>
                      <option value="SPLIT">SPLIT / PARTIAL</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground uppercase font-medium block mb-1">
                    Line Item Justification
                  </label>
                  <input
                    type="text"
                    value={item.justification}
                    onChange={(e) => {
                      const updated = [...awardItems];
                      updated[idx] = { ...item, justification: e.target.value };
                      setAwardItems(updated);
                    }}
                    placeholder="Specific rationale for this lot/vendor..."
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Overall Business Justification */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground block">
              Overall Business Case & Executive Justification *
            </label>
            <textarea
              rows={4}
              value={overallJustification}
              onChange={(e) => setOverallJustification(e.target.value)}
              placeholder="Detail the technical qualification, commercial ranking, savings vs budget, and reasons for selecting the vendor..."
              className="w-full p-3 rounded-xl border border-border bg-background text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Summary & Submit */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-border/30">
            <div>
              <span className="text-xs text-muted-foreground block">Total Recommended Award:</span>
              <span className="text-xl font-bold font-mono text-foreground">
                ₹{totalAwarded.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <PermissionGuard permission="rfq.award">
              <Button
                size="lg"
                disabled={recommendMutation.isPending || awardItems.length === 0}
                onClick={handleRecommend}
                className="shadow-sm"
              >
                {recommendMutation.isPending
                  ? "Submitting Recommendation..."
                  : "Submit Award Recommendation for Approval"}
              </Button>
            </PermissionGuard>
          </div>
        </div>
      )}
    </div>
  );
}
