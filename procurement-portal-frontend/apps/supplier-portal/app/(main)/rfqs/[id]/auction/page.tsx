"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useRfq,
  useCurrentUser,
  useMyVendor,
  useLiveAuctions,
  useLiveAuction,
  useAuctionMyRank,
  useAuctionSocket,
  useSetProxyFloor,
} from "@procurement/hooks";
import { PriceLeaderboard, AuctionCountdownTimer, BidEntryPanel } from "@procurement/ui";

export default function SupplierAuctionRoomPage() {
  const params = useParams();
  const rfqId = params?.id as string;

  const { data: rfq, isLoading: rfqLoading } = useRfq(rfqId);
  const { data: currentUser } = useCurrentUser();
  const { data: myVendor } = useMyVendor();

  const {
    data: auctions,
    isLoading: auctionsLoading,
  } = useLiveAuctions({ rfq_id: rfqId });

  const activeAuction = auctions?.[0];

  // Active auction details & live socket
  const { data: auctionDetail } = useLiveAuction(activeAuction?.id || "");
  const currentAuction = auctionDetail || activeAuction;

  const { data: restMyRank } = useAuctionMyRank(currentAuction?.id || "");

  const {
    connected,
    rankings: wsRankings,
    myRank: wsMyRank,
    l1Price: wsL1,
    totalBids: wsTotalBids,
    closeAt: wsCloseAt,
    extensionCount: wsExtCount,
    auctionStatus: wsStatus,
    rejectionReason,
    clearRejection,
    sendBid,
  } = useAuctionSocket(currentAuction?.id || "");

  const proxyFloorMutation = useSetProxyFloor();

  // Proxy floor input state
  const [proxyFloorInput, setProxyFloorInput] = useState<string>("");
  const [proxyFloorSuccess, setProxyFloorSuccess] = useState<boolean>(false);

  // Success alert
  const [bidSuccessAlert, setBidSuccessAlert] = useState<string | null>(null);

  const effectiveStatus = wsStatus || currentAuction?.status;
  const effectiveCloseAt = wsCloseAt || currentAuction?.current_close_at;
  const effectiveExtensions = wsExtCount ?? currentAuction?.extension_count ?? 0;

  // Derive current supplier rank and L1 price
  const rankInfo = wsMyRank || restMyRank;
  const currentRank = rankInfo?.your_rank;
  const myCurrentBid = rankInfo?.your_bid_inr;
  const currentL1Price = wsL1 != null ? wsL1 : rankInfo?.l1_price_inr ?? null;

  const minDecrementType = currentAuction?.config?.min_decrement_type || "PERCENTAGE";
  const minDecrementValue = currentAuction?.config?.min_decrement_value || 0.5;
  const allowProxy = Boolean(currentAuction?.config?.allow_proxy_bid);
  const rankVisibility = currentAuction?.config?.rank_visibility || "RANK_ONLY";

  const isAuctionOpen = effectiveStatus === "OPEN";
  const isAuctionClosed = effectiveStatus === "CLOSED" || effectiveStatus === "CANCELLED" || effectiveStatus === "RESULTS_RELEASED";

  const handlePlaceBid = (lotId: string | null, amount: number) => {
    sendBid(lotId, amount);
    setBidSuccessAlert(`Bid of ₹${amount.toLocaleString("en-IN")} submitted to auction engine.`);
    setTimeout(() => setBidSuccessAlert(null), 4000);
  };

  const handleSetProxyFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAuction || !proxyFloorInput) return;
    const floorAmount = parseFloat(proxyFloorInput);
    if (isNaN(floorAmount) || floorAmount <= 0) return;

    try {
      await proxyFloorMutation.mutateAsync({
        auctionId: currentAuction.id,
        floorAmountInr: floorAmount,
      });
      setProxyFloorSuccess(true);
      setProxyFloorInput("");
      setTimeout(() => setProxyFloorSuccess(false), 4000);
    } catch {
      // Handled by mutation
    }
  };

  if (rfqLoading || auctionsLoading) {
    return (
      <div className="max-w-5xl mx-auto p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
        <div className="h-48 bg-gray-100 dark:bg-gray-900 rounded-2xl" />
        <div className="h-80 bg-gray-100 dark:bg-gray-900 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/rfqs" className="hover:underline">RFQs</Link>
            <span>/</span>
            <span className="font-mono">{rfq?.rfq_number || rfqId.slice(0, 8)}</span>
            <span>/</span>
            <span className="text-gray-800 dark:text-gray-200 font-semibold">Live Reverse Auction</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              Reverse Auction Bidding Terminal
            </h1>
            {currentAuction && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                {connected ? "LIVE WEBSOCKET" : "CONNECTING..."}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {rfq?.title || "Active Sourcing Tender"} · Lowest price submitted wins evaluation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/rfqs/${rfqId}/bid`}
            className="px-3.5 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            Sealed Bid Form
          </Link>
          <Link
            href="/rfqs"
            className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition"
          >
            ← Tender List
          </Link>
        </div>
      </div>

      {/* CASE 1: No auction created yet */}
      {!currentAuction && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center text-xl font-bold">
            ⏱
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            No Reverse Auction Scheduled Yet
          </h2>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            The buyer has not yet opened or scheduled a live reverse auction for this RFQ. If you haven&apos;t submitted your initial sealed bid, please complete the sealed bid form.
          </p>
          <div className="pt-2">
            <Link
              href={`/rfqs/${rfqId}/bid`}
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold shadow hover:opacity-90 transition"
            >
              Go to Sealed Bid Submission
            </Link>
          </div>
        </div>
      )}

      {/* CASE 2: Live Auction Room Active */}
      {currentAuction && (
        <>
          {/* Notifications */}
          {bidSuccessAlert && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-sm">
              <span>✓ {bidSuccessAlert}</span>
              <button onClick={() => setBidSuccessAlert(null)} className="font-bold opacity-70 hover:opacity-100 ml-2">
                ✕
              </button>
            </div>
          )}

          {rejectionReason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium flex items-center justify-between shadow-sm">
              <span>⚠ Bid Rejected: {rejectionReason}</span>
              <button onClick={clearRejection} className="font-bold opacity-70 hover:opacity-100 ml-2">
                ✕
              </button>
            </div>
          )}

          {effectiveExtensions > 0 && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <span className="text-base">⏱</span>
              <span>
                <strong>Anti-Sniping Triggered:</strong> Auction extended by {currentAuction.config?.auto_extend_duration_minutes} minutes ({effectiveExtensions}/{currentAuction.config?.max_extensions} extensions used).
              </span>
            </div>
          )}

          {/* Supplier Status & Rank Banner */}
          <div
            className={`p-5 rounded-2xl border text-sm font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
              currentRank === 1
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
                : currentRank != null
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100"
                : "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentRank === 1 ? "🏆" : "⚡"}</span>
              <div>
                <p className="font-bold text-base">
                  {currentRank === 1
                    ? "You Are Currently Leading (L1)"
                    : currentRank != null
                    ? `You Are Currently at Rank L${currentRank}`
                    : effectiveStatus === "SCHEDULED"
                    ? "Auction Scheduled to Open Soon"
                    : "Place Your Bid to Enter Leaderboard"}
                </p>
                <p className="text-xs font-normal opacity-90">
                  {currentRank === 1
                    ? "Your organization currently holds the lowest price quote in this auction."
                    : currentL1Price != null
                    ? `Current market L1 quote is ₹${Number(currentL1Price).toLocaleString("en-IN")}. Submit a decrement to take the lead.`
                    : "Quotes will update dynamically as participants submit downward decrements."}
                </p>
              </div>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="text-xs font-normal block opacity-80">
                {isAuctionOpen ? "Time Remaining" : "Status"}
              </span>
              <div className="mt-1">
                {isAuctionOpen && effectiveCloseAt ? (
                  <AuctionCountdownTimer closeAt={effectiveCloseAt} />
                ) : (
                  <span className="text-lg font-bold font-mono uppercase">{effectiveStatus}</span>
                )}
              </div>
            </div>
          </div>

          {/* Pricing & Bidding Console Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Bid Entry & Automated Proxy */}
            <div className="lg:col-span-2 space-y-6">
              {/* Decrement & Market Info Card */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                    Market Best Offer (L1)
                  </span>
                  <span className="text-xs font-mono bg-white/10 px-2.5 py-0.5 rounded text-gray-300">
                    INR
                  </span>
                </div>

                <div className="text-4xl sm:text-5xl font-extrabold text-emerald-300 font-mono tracking-tight">
                  {currentL1Price != null
                    ? `₹${Number(currentL1Price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                    : "Pending Bids"}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-gray-400 block">Your Best Bid</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {myCurrentBid ? `₹${Number(myCurrentBid).toLocaleString("en-IN")}` : "No bid yet"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Min Decrement</span>
                    <span className="font-mono font-semibold text-gray-200">
                      {minDecrementValue} {minDecrementType === "PERCENTAGE" ? "%" : "₹"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Visibility</span>
                    <span className="font-mono font-semibold text-gray-200">
                      {rankVisibility.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instant Counter-Bid Terminal Component */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Instant Counter-Bid Terminal
                </h3>
                <BidEntryPanel
                  lotId={null}
                  currentL1Inr={currentL1Price != null ? Number(currentL1Price) : null}
                  minDecrementType={minDecrementType}
                  minDecrementValue={minDecrementValue}
                  auctionClosed={!isAuctionOpen}
                  onSubmit={handlePlaceBid}
                />
              </div>

              {/* Automated Proxy Bidding Floor Card (SPEC_11B) */}
              {allowProxy && (
                <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        Automated Proxy Bidding (Confidential Floor)
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Set your lowest acceptable price. The auction engine will automatically submit minimal decrements to defend your L1 rank without exceeding your floor.
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                      SPEC_11B
                    </span>
                  </div>

                  {proxyFloorSuccess && (
                    <div className="p-2.5 bg-green-50 text-green-800 rounded-lg text-xs">
                      ✓ Automated floor price saved successfully! Engine will auto-bid to protect your position.
                    </div>
                  )}

                  <form onSubmit={handleSetProxyFloor} className="flex gap-2 pt-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="Enter minimum acceptable floor price (₹)"
                      value={proxyFloorInput}
                      onChange={(e) => setProxyFloorInput(e.target.value)}
                      disabled={!isAuctionOpen}
                      className="flex-1 border border-gray-300 dark:border-gray-700 bg-transparent rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="submit"
                      disabled={!isAuctionOpen || !proxyFloorInput || proxyFloorMutation.isPending}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow disabled:opacity-50"
                    >
                      {proxyFloorMutation.isPending ? "Setting..." : "Save Proxy Floor"}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Right Col: Masked Leaderboard & Stats */}
            <div className="space-y-6">
              {/* Masked Leaderboard */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Leaderboard (Supplier Masked View)
                  </h3>
                  <span className="text-xs text-gray-400">
                    {wsTotalBids} bids recorded
                  </span>
                </div>

                <PriceLeaderboard
                  rankings={wsRankings.map((r) => ({
                    rank: r.rank,
                    vendor_id: r.vendor_id,
                    vendor_name: r.vendor_id === myVendor?.id ? "Your Organization" : `Bidder ${r.rank}`,
                    bid_amount_inr: Number(r.bid_amount_inr),
                    submitted_at: r.submitted_at,
                  }))}
                  isBuyer={false}
                />
              </div>

              {/* Auction Specs Reference Card */}
              <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2 text-xs">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider text-[11px]">
                  Auction Protocol Rules
                </h4>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-600 dark:text-gray-400">
                  <div className="py-2 flex justify-between">
                    <span>Rank Visibility:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{rankVisibility}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span>Min Decrement:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {minDecrementValue} {minDecrementType === "PERCENTAGE" ? "%" : "₹"}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span>Anti-Sniping:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {currentAuction.config?.auto_extend ? `+${currentAuction.config.auto_extend_duration_minutes}m on last-min bid` : "Disabled"}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span>Audit Trail:</span>
                    <span className="font-semibold text-emerald-600">Database & Redis Logged</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
