"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useRfq,
  useComparativeStatement,
  useNegotiations,
  useStartNegotiation,
  useSubmitNegotiatedPrice,
  useVendors,
} from "@procurement/hooks";
import { NegotiationPriceInput, Button, Badge } from "@procurement/ui";

export default function NegotiationPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params?.id as string;

  const { data: rfq, isLoading: rfqLoading } = useRfq(rfqId);
  const { data: cs, isLoading: csLoading } = useComparativeStatement(rfqId);
  const { data: negotiations, isLoading: negLoading, refetch: refetchNegs } = useNegotiations(cs?.id || "");
  const { data: vendorsData } = useVendors({ page: 1, page_size: 100 });

  const startNegotiationMutation = useStartNegotiation();
  const submitPriceMutation = useSubmitNegotiatedPrice();

  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [negotiatedPrices, setNegotiatedPrices] = useState<Record<string, { price: number; isValid: boolean }>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const vendorMap: Record<string, string> = {};
  if (vendorsData?.vendors) {
    for (const v of vendorsData.vendors) {
      vendorMap[v.id] = v.company_name;
    }
  }

  if (rfqLoading || csLoading || negLoading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">
        Loading commercial negotiations console...
      </div>
    );
  }

  if (!rfq || !cs) {
    return (
      <div className="p-12 text-center text-sm text-red-500">
        Comparative statement must be generated before starting negotiations.
      </div>
    );
  }

  const handleStartRound = async () => {
    if (selectedVendorIds.length === 0) {
      alert("Please select at least one vendor to initiate negotiations.");
      return;
    }
    try {
      await startNegotiationMutation.mutateAsync({
        csId: cs.id,
        vendorIds: selectedVendorIds,
      });
      setFeedback(`Initiated negotiation round with ${selectedVendorIds.length} vendor(s)`);
      setSelectedVendorIds([]);
      refetchNegs();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to start negotiation");
    }
  };

  const handleSubmitPrice = async (negotiationId: string) => {
    const entry = negotiatedPrices[negotiationId];
    if (!entry || !entry.price || !entry.isValid) {
      alert("Please enter a valid negotiated price within the allowed tolerance.");
      return;
    }
    try {
      await submitPriceMutation.mutateAsync({
        negotiationId,
        negotiatedPrice: entry.price,
      });
      setFeedback("Negotiated price submitted successfully!");
      refetchNegs();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to submit negotiated price");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
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
            <span className="font-semibold text-foreground">Negotiate</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Commercial Negotiation Rounds
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Post-bid commercial discussions. Increases above 0.5% tolerance require Procurement Head approval.
          </p>
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

      {/* Start New Negotiation Round Card */}
      <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Shortlist & Initiate Negotiation
        </h3>
        <p className="text-xs text-muted-foreground">
          Select qualified suppliers from the Comparative Statement to open commercial negotiation channels.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cs.rankings.map((r) => {
            const vName = vendorMap[r.vendor_id] || `Vendor ${r.vendor_id.slice(0, 8)}`;
            const isSelected = selectedVendorIds.includes(r.vendor_id);
            const isWinner = r.is_l1 || r.rank === 1;

            return (
              <label
                key={r.id}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedVendorIds((prev) => [...prev, r.vendor_id]);
                      } else {
                        setSelectedVendorIds((prev) => prev.filter((id) => id !== r.vendor_id));
                      }
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                  />
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span>{vName}</span>
                      {isWinner && (
                        <Badge variant="success" className="text-[10px] py-0 px-1.5">
                          L1
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      ₹{Number(r.lot_total_inr || r.landed_cost).toLocaleString()}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Rank {r.rank}
                </Badge>
              </label>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            disabled={selectedVendorIds.length === 0 || startNegotiationMutation.isPending}
            onClick={handleStartRound}
          >
            {startNegotiationMutation.isPending
              ? "Opening..."
              : `Open Round with ${selectedVendorIds.length} Vendor(s)`}
          </Button>
        </div>
      </div>

      {/* Active Negotiations List */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Negotiation Rounds ({negotiations?.length || 0})
        </h3>

        {!negotiations || negotiations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
            No active negotiation rounds found for this CS. Select suppliers above to begin.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {negotiations.map((neg) => {
              const vName = vendorMap[neg.vendor_id] || `Vendor ${neg.vendor_id.slice(0, 8)}`;
              const origPrice = Number(neg.original_price || 0);
              const currentPrice = Number(neg.negotiated_price || origPrice);
              const currentEntry = negotiatedPrices[neg.id];
              const isSubmitted = neg.status === "PRICE_SUBMITTED";

              return (
                <div
                  key={neg.id}
                  className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-border/30 pb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{vName}</h4>
                      <span className="text-xs text-muted-foreground font-mono">
                        Round #{neg.round_number} &bull; ID: {neg.id.slice(0, 8)}
                      </span>
                    </div>
                    <Badge
                      variant={
                        neg.status === "PRICE_SUBMITTED"
                          ? "success"
                          : neg.status === "OPEN"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {neg.status}
                    </Badge>
                  </div>

                  {/* Negotiation Price Input with Tolerance Indicator */}
                  <NegotiationPriceInput
                    originalPrice={origPrice}
                    value={currentEntry !== undefined ? currentEntry.price : currentPrice}
                    onChange={(val, valid) => {
                      setNegotiatedPrices((prev) => ({
                        ...prev,
                        [neg.id]: { price: val, isValid: valid },
                      }));
                    }}
                  />

                  {/* Historical Submitted Data */}
                  {neg.negotiated_price && (
                    <div className="p-3 rounded-xl bg-muted/20 text-xs border border-border/20 flex items-center justify-between">
                      <span className="text-muted-foreground">Last Recorded Price:</span>
                      <span className="font-mono font-semibold text-foreground">
                        ₹{Number(neg.negotiated_price).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                        {neg.price_change_pct !== null && neg.price_change_pct !== undefined && (
                          <span
                            className={`ml-2 text-[11px] ${
                              Number(neg.price_change_pct) < 0
                                ? "text-emerald-600"
                                : Number(neg.price_change_pct) > 0
                                ? "text-amber-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            ({Number(neg.price_change_pct) > 0 ? "+" : ""}
                            {Number(neg.price_change_pct).toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      disabled={
                        submitPriceMutation.isPending ||
                        (currentEntry && !currentEntry.isValid)
                      }
                      onClick={() => handleSubmitPrice(neg.id)}
                      className="w-full sm:w-auto"
                    >
                      {submitPriceMutation.isPending ? "Submitting..." : "Submit Negotiated Price"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
