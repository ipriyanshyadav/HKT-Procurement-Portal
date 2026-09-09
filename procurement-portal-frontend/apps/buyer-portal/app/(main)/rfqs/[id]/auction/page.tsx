"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useRfq,
  useLiveAuctions,
  useLiveAuction,
  useCreateLiveAuction,
  useOpenLiveAuction,
  useCancelLiveAuction,
  useReleaseLiveAuctionResults,
  useAuctionLeaderboard,
  useAuctionBidHistory,
  useAuctionSocket,
  AuctionConfig,
} from "@procurement/hooks";
import { PriceLeaderboard, AuctionCountdownTimer, Button, Badge } from "@procurement/ui";
import { ArrowLeft, Play, XCircle, Share2, BarChart3, Zap, Clock, ShieldCheck } from "lucide-react";

export default function BuyerAuctionRoomPage() {
  const params = useParams();
  const rfqId = params?.id as string;

  const { data: rfq, isLoading: rfqLoading } = useRfq(rfqId);
  const {
    data: auctions,
    isLoading: auctionsLoading,
  } = useLiveAuctions({ rfq_id: rfqId });

  const activeAuction = auctions?.[0];

  // Auction creation form state
  const [scheduledStart, setScheduledStart] = useState<string>(
    new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [reservePrice, setReservePrice] = useState<string>("");
  const [minDecrementType, setMinDecrementType] = useState<"PERCENTAGE" | "ABSOLUTE">("PERCENTAGE");
  const [minDecrementValue, setMinDecrementValue] = useState<number>(0.5);
  const [rankVisibility, setRankVisibility] = useState<"RANK_ONLY" | "PRICE_AND_RANK" | "NO_RANK">("RANK_ONLY");
  const [autoExtend, setAutoExtend] = useState<boolean>(true);
  const [triggerMinutes, setTriggerMinutes] = useState<number>(5);
  const [extendDuration, setExtendDuration] = useState<number>(10);
  const [maxExtensions, setMaxExtensions] = useState<number>(3);
  const [allowProxyBid, setAllowProxyBid] = useState<boolean>(false);

  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Mutations
  const createMutation = useCreateLiveAuction();
  const openMutation = useOpenLiveAuction();
  const cancelMutation = useCancelLiveAuction();
  const releaseMutation = useReleaseLiveAuctionResults();

  // Active auction details & live socket
  const { data: auctionDetail } = useLiveAuction(activeAuction?.id || "");
  const currentAuction = auctionDetail || activeAuction;

  const {
    connected,
    rankings: wsRankings,
    l1Price: wsL1,
    totalBids: wsTotalBids,
    closeAt: wsCloseAt,
    extensionCount: wsExtCount,
    auctionStatus: wsStatus,
  } = useAuctionSocket(currentAuction?.id || "");

  const { data: leaderboardData } = useAuctionLeaderboard(currentAuction?.id || "");
  const { data: bidsData } = useAuctionBidHistory(currentAuction?.id || "");

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    const config: AuctionConfig = {
      auction_start_at: new Date(scheduledStart).toISOString(),
      auction_duration_minutes: durationMinutes,
      reserve_price_inr: reservePrice ? parseFloat(reservePrice) : undefined,
      min_decrement_type: minDecrementType,
      min_decrement_value: minDecrementValue,
      rank_visibility: rankVisibility,
      auto_extend: autoExtend,
      auto_extend_trigger_minutes: triggerMinutes,
      auto_extend_duration_minutes: extendDuration,
      max_extensions: maxExtensions,
      allow_proxy_bid: allowProxyBid,
      require_all_lots: true,
    };

    try {
      await createMutation.mutateAsync({ rfq_id: rfqId, config });
    } catch {
      // Error handled by mutation state
    }
  };

  const handleOpenAuction = async () => {
    if (!currentAuction) return;
    try {
      await openMutation.mutateAsync(currentAuction.id);
    } catch {
      // Handled
    }
  };

  const handleConfirmCancel = async () => {
    if (!currentAuction || !cancelReason.trim()) return;
    try {
      await cancelMutation.mutateAsync({ auctionId: currentAuction.id, reason: cancelReason.trim() });
      setShowCancelModal(false);
      setCancelReason("");
    } catch {
      // Handled
    }
  };

  const handleReleaseResults = async () => {
    if (!currentAuction) return;
    try {
      await releaseMutation.mutateAsync(currentAuction.id);
    } catch {
      // Handled
    }
  };

  if (rfqLoading || auctionsLoading) {
    return (
      <div className="max-w-6xl mx-auto p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
        <div className="h-64 bg-gray-100 dark:bg-gray-900 rounded-2xl" />
        <div className="h-96 bg-gray-100 dark:bg-gray-900 rounded-2xl" />
      </div>
    );
  }

  const effectiveStatus = wsStatus || currentAuction?.status;
  const currentLeaderboard = wsRankings.length > 0 ? wsRankings : leaderboardData || [];
  const currentL1Price = wsL1 != null ? wsL1 : currentLeaderboard[0]?.bid_amount_inr ?? null;
  const reservePriceInr = currentAuction?.config?.reserve_price_inr;
  const effectiveCloseAt = wsCloseAt || currentAuction?.current_close_at;
  const effectiveExtensions = wsExtCount ?? currentAuction?.extension_count ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/rfqs" className="hover:underline">RFQs</Link>
            <span>/</span>
            <Link href={`/rfqs/${rfqId}`} className="hover:underline font-mono">
              {rfq?.rfq_number || rfqId.slice(0, 8)}
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">Live Reverse Auction</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Reverse Auction Live Room
            </h1>
            {currentAuction && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                {connected ? "LIVE SOCKET" : "CONNECTING..."}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time reverse auction bidding engine with immutable audit trail and anti-sniping protection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/rfqs/${rfqId}`}>
            <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back to RFQ Overview
            </Button>
          </Link>
        </div>
      </div>

      {/* CASE 1: No Auction Configured Yet */}
      {!currentAuction && (
        <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 p-8 shadow-sm">
          <div className="max-w-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Schedule Live Reverse Auction
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Configure parameters for RFQ #{rfq?.rfq_number || rfqId.slice(0, 8)}. Participating vendors will receive invitation notices and live room access.
            </p>

            <form onSubmit={handleCreateAuction} className="mt-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Scheduled Start Time (UTC / Local)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledStart}
                    onChange={(e) => setScheduledStart(e.target.value)}
                    required
                    className="w-full border border-gray-300 dark:border-gray-700 bg-transparent rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="480"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 60)}
                    required
                    className="w-full border border-gray-300 dark:border-gray-700 bg-transparent rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Hidden Reserve Ceiling (₹ INR, Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 5000000"
                    value={reservePrice}
                    onChange={(e) => setReservePrice(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-700 bg-transparent rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-[10px] text-gray-400">Strictly hidden from suppliers; quotes above this are rejected.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Minimum Decrement Type
                  </label>
                  <select
                    value={minDecrementType}
                    onChange={(e) => setMinDecrementType(e.target.value as "PERCENTAGE" | "ABSOLUTE")}
                    className="w-full border border-gray-300 dark:border-gray-700 bg-transparent rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="ABSOLUTE">Absolute Amount (₹ INR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Decrement Value ({minDecrementType === "PERCENTAGE" ? "%" : "₹"})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={minDecrementValue}
                    onChange={(e) => setMinDecrementValue(parseFloat(e.target.value) || 0.5)}
                    required
                    className="w-full border border-gray-300 dark:border-gray-700 bg-transparent rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Supplier Rank Visibility
                  </label>
                  <select
                    value={rankVisibility}
                    onChange={(e) => setRankVisibility(e.target.value as any)}
                    className="w-full border border-gray-300 dark:border-gray-700 bg-transparent rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
                  >
                    <option value="RANK_ONLY">Rank Only (e.g. L1, L2)</option>
                    <option value="PRICE_AND_RANK">Price & Rank (L1 Price + Rank)</option>
                    <option value="NO_RANK">Blind (No Rank Displayed)</option>
                  </select>
                </div>
              </div>

              {/* Anti-sniping auto-extension */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoExtend"
                    checked={autoExtend}
                    onChange={(e) => setAutoExtend(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="autoExtend" className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    Enable Anti-Sniping Dynamic Extension
                  </label>
                </div>
                {autoExtend && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    <div>
                      <label className="text-gray-500 block mb-1">Trigger Window (mins)</label>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={triggerMinutes}
                        onChange={(e) => setTriggerMinutes(parseInt(e.target.value) || 5)}
                        className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 block mb-1">Extension Time (mins)</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={extendDuration}
                        onChange={(e) => setExtendDuration(parseInt(e.target.value) || 10)}
                        className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 block mb-1">Max Extensions</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={maxExtensions}
                        onChange={(e) => setMaxExtensions(parseInt(e.target.value) || 3)}
                        className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowProxyBid"
                  checked={allowProxyBid}
                  onChange={(e) => setAllowProxyBid(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="allowProxyBid" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Allow Suppliers to set confidential Automated Proxy Floor Bids
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={createMutation.isPending}
                loading={createMutation.isPending}
                size="md"
              >
                {createMutation.isPending ? "Configuring Auction..." : "Create & Schedule Live Auction"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* CASE 2: Auction Configured */}
      {currentAuction && (
        <>
          {/* Status & Lifecycle Controls Banner */}
          <div className="p-5 bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                effectiveStatus === "OPEN"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  : effectiveStatus === "SCHEDULED"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                  : effectiveStatus === "CLOSED"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                  : effectiveStatus === "RESULTS_RELEASED"
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
              }`}>
                {effectiveStatus}
              </span>

              {effectiveExtensions > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  ⏱ Extended {effectiveExtensions}/{currentAuction.config?.max_extensions ?? 3} times
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {effectiveStatus === "SCHEDULED" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenAuction}
                  disabled={openMutation.isPending}
                  loading={openMutation.isPending}
                  icon={<Play className="w-3.5 h-3.5" />}
                >
                  Open Auction Now
                </Button>
              )}

              {(effectiveStatus === "SCHEDULED" || effectiveStatus === "OPEN") && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowCancelModal(true)}
                  icon={<XCircle className="w-3.5 h-3.5" />}
                >
                  Cancel Auction
                </Button>
              )}

              {effectiveStatus === "CLOSED" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReleaseResults}
                  disabled={releaseMutation.isPending}
                  loading={releaseMutation.isPending}
                  icon={<Share2 className="w-3.5 h-3.5" />}
                >
                  Release Results to Suppliers
                </Button>
              )}

              {effectiveStatus === "RESULTS_RELEASED" && (
                <Link href={`/rfqs/${rfqId}/evaluation`}>
                  <Button variant="primary" size="sm" icon={<BarChart3 className="w-3.5 h-3.5" />}>
                    View Comparative Statement (CS) &rarr;
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Metrics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* L1 Lowest Price Card */}
            <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Leading Lowest Price (L1)
                </span>
                <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-gray-300">
                  INR
                </span>
              </div>

              <div className="my-4">
                <div className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono text-emerald-300">
                  {currentL1Price != null
                    ? `₹${Number(currentL1Price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                    : "Pending Bids"}
                </div>
                <p className="text-xs text-gray-300 mt-2 flex items-center gap-1.5">
                  <span>Current Leader:</span>
                  <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded">
                    {currentLeaderboard[0]?.vendor_name || "Reserve Ceiling"}
                  </span>
                </p>
              </div>

              <div className="text-[11px] text-gray-400 pt-3 border-t border-white/10 flex justify-between items-center">
                <span>
                  Reserve Ceiling: {reservePriceInr ? `₹${Number(reservePriceInr).toLocaleString("en-IN")}` : "None"}
                </span>
                {reservePriceInr && currentL1Price && (
                  <span className="text-emerald-400 font-semibold">
                    Savings: ₹{(Number(reservePriceInr) - Number(currentL1Price)).toLocaleString("en-IN")} (
                    {(((Number(reservePriceInr) - Number(currentL1Price)) / Number(reservePriceInr)) * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>

            {/* Time Remaining Card */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Time Remaining
                </span>
                <div className="mt-2">
                  {effectiveStatus === "OPEN" && effectiveCloseAt ? (
                    <AuctionCountdownTimer closeAt={effectiveCloseAt} />
                  ) : (
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200 font-mono">
                      {effectiveStatus}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-800">
                Closes at:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {effectiveCloseAt ? new Date(effectiveCloseAt).toLocaleTimeString() : "—"}
                </span>
              </div>
            </div>

            {/* Total Bids Card */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Bids Placed
                </span>
                <div className="text-3xl font-extrabold text-blue-600 font-mono mt-2 tracking-tight">
                  {wsTotalBids || bidsData?.length || 0}
                </div>
              </div>
              <div className="text-xs text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-800">
                Min. Decrement:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {currentAuction.config?.min_decrement_value}{" "}
                  {currentAuction.config?.min_decrement_type === "PERCENTAGE" ? "%" : "₹"}
                </span>
              </div>
            </div>
          </div>

          {/* Unmasked Buyer Price Leaderboard & Waterfall Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Live Price Leaderboard (Unmasked Buyer View)
                </h2>
                <span className="text-xs text-gray-400">
                  {currentLeaderboard.length} ranked vendor{currentLeaderboard.length === 1 ? "" : "s"}
                </span>
              </div>
              <PriceLeaderboard
                rankings={currentLeaderboard.map((r: any) => ({
                  rank: r.rank,
                  vendor_id: r.vendor_id,
                  vendor_name: r.vendor_name,
                  bid_amount_inr: Number(r.bid_amount_inr),
                  submitted_at: r.submitted_at,
                }))}
                isBuyer={true}
              />
            </div>

            {/* Chronological Bid Waterfall */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Live Audit Trail
                </h2>
                <span className="text-xs font-mono text-gray-400">
                  {bidsData?.length || 0} events
                </span>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 max-h-96 overflow-y-auto space-y-2 text-xs">
                {(!bidsData || bidsData.length === 0) ? (
                  <p className="text-gray-400 italic text-center py-6">
                    No bids recorded yet.
                  </p>
                ) : (
                  bidsData.map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {b.vendor_name || `Vendor ${b.vendor_id.slice(0, 8)}`}
                          {b.is_proxy_bid && (
                            <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                              Auto-Proxy
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400">
                          Seq #{b.bid_sequence} • {new Date(b.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{Number(b.bid_amount_inr).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1C1F] border border-slate-200 dark:border-white/15 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Cancel Live Reverse Auction
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This action terminates the auction session immediately and notifies all participating suppliers. A documented reason is required for the audit trail.
            </p>
            <textarea
              rows={3}
              placeholder="Enter mandatory cancellation justification..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg p-3 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
              >
                Dismiss
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmCancel}
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                loading={cancelMutation.isPending}
                icon={<XCircle className="w-3.5 h-3.5" />}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
