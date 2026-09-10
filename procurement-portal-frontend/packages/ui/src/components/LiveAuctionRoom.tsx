"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Gavel,
  Clock,
  TrendingDown,
  AlertTriangle,
  Play,
  XCircle,
  Award,
  Users,
  Send,
  Zap,
  CheckCircle2,
  RefreshCw,
  Lock,
  Sliders,
} from "lucide-react";
import {
  useLiveAuction,
  useOpenLiveAuction,
  useCancelLiveAuction,
  useReleaseLiveAuctionResults,
  useSetProxyFloor,
  useAuctionMyRank,
  useAuctionLeaderboard,
  useAuctionBidHistory,
  useAuctionSocket,
} from "@procurement/hooks";

interface LiveAuctionRoomProps {
  auctionId: string;
  isHost?: boolean;
}

export function LiveAuctionRoom({ auctionId, isHost = false }: LiveAuctionRoomProps) {
  // Query baseline data
  const { data: auction, isLoading: loadingAuction, refetch } = useLiveAuction(auctionId);
  const { data: myRankData, refetch: refetchRank } = useAuctionMyRank(auctionId);
  const { data: leaderboardData = [], refetch: refetchLeaderboard } = useAuctionLeaderboard(auctionId);
  const { data: bidHistory = [], refetch: refetchHistory } = useAuctionBidHistory(auctionId);

  // Mutations
  const openAuctionMutation = useOpenLiveAuction();
  const cancelAuctionMutation = useCancelLiveAuction();
  const releaseResultsMutation = useReleaseLiveAuctionResults();
  const setProxyFloorMutation = useSetProxyFloor();

  // Local Bidding States
  const [customBidAmount, setCustomBidAmount] = useState<string>("");
  const [proxyFloorAmount, setProxyFloorAmount] = useState<string>("");
  const [proxySetSuccess, setProxySetSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [timeRemainingSecs, setTimeRemainingSecs] = useState<number>(0);

  // Real-time WebSocket hook
  const {
    connected,
    l1Price,
    rankings,
    myRank,
    closeAt,
    rejectionReason,
    sendBid,
    sendProxyFloor,
  } = useAuctionSocket(auctionId, {
    onNewBid: () => {
      refetchLeaderboard();
      refetchHistory();
      refetchRank();
    },
    onAuctionExtended: () => {
      refetch();
    },
    onAuctionClosed: () => {
      refetch();
    },
  });

  // Derived Values
  const currentLeaderPrice = useMemo(() => {
    if (l1Price != null) return l1Price;
    if (leaderboardData.length > 0 && leaderboardData[0]?.bid_amount_inr != null) {
      return leaderboardData[0].bid_amount_inr;
    }
    return 1000000;
  }, [l1Price, leaderboardData]);

  const minDecrement = useMemo(() => {
    if (!auction?.config) return 1000;
    if (auction.config.min_decrement_type === "ABSOLUTE") {
      return auction.config.min_decrement_value;
    }
    if (auction.config.min_decrement_type === "PERCENTAGE" && currentLeaderPrice > 0) {
      return (currentLeaderPrice * auction.config.min_decrement_value) / 100;
    }
    return 1000;
  }, [auction, currentLeaderPrice]);

  const nextMaxBidAllowed = useMemo(() => {
    return Math.max(0, currentLeaderPrice - minDecrement);
  }, [currentLeaderPrice, minDecrement]);

  // Timer countdown loop
  useEffect(() => {
    const targetCloseStr = closeAt || auction?.current_close_at;
    if (!targetCloseStr) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const end = new Date(targetCloseStr).getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setTimeRemainingSecs(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [closeAt, auction?.current_close_at]);

  // Quick Decrement Handlers
  const handlePlaceBid = (amount: number) => {
    setActionError(null);
    try {
      sendBid(null, amount);
      setCustomBidAmount("");
    } catch (err: any) {
      setActionError(err?.message || "Failed to place bid via WebSocket");
    }
  };

  const handleSetProxy = async () => {
    if (!proxyFloorAmount || Number(proxyFloorAmount) <= 0) return;
    try {
      sendProxyFloor(null, Number(proxyFloorAmount));
      await setProxyFloorMutation.mutateAsync({
        auctionId,
        floorAmountInr: Number(proxyFloorAmount),
      });
      setProxySetSuccess(true);
      setTimeout(() => setProxySetSuccess(false), 3000);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || "Failed to set proxy floor");
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loadingAuction && !auction) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-[#2e2e32] bg-[#1C1C1F]">
        <div className="flex flex-col items-center gap-2 text-sm text-[#8E8E93]">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
          <span>Connecting to Live Auction Floor...</span>
        </div>
      </div>
    );
  }

  const isLive = auction?.status === "OPEN";
  const effectiveRankings = rankings.length > 0 ? rankings : leaderboardData;
  const userRank = myRank?.your_rank ?? myRankData?.your_rank;
  const userBid = myRank?.your_bid_inr ?? myRankData?.your_bid_inr;

  return (
    <div className="space-y-6">
      {/* Top Header & Floor Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2e2e32] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Gavel className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-white tracking-tight">
                  {auction?.rfq_title || `Live Reverse Auction #${auctionId.slice(0, 8)}`}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isLive
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse"
                      : auction?.status === "SCHEDULED"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      : "bg-[#252529] text-[#8E8E93] border border-[#2e2e32]"
                  }`}
                >
                  {isLive ? "● LIVE BIDDING" : auction?.status}
                </span>
                {connected ? (
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    WS Synchronized
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Polling Active
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[#8E8E93]">
                RFQ #{auction?.rfq_number || "RFQ"} &bull; Reverse English Auction with Anti-Sniping Protection
              </p>
            </div>
          </div>
        </div>

        {/* Timer & Overtime Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-center ${
              timeRemainingSecs < 120 && isLive
                ? "border-rose-500/40 bg-rose-950/20 text-rose-400 animate-pulse"
                : timeRemainingSecs < 300 && isLive
                ? "border-amber-500/40 bg-amber-950/20 text-amber-400"
                : "border-[#2e2e32] bg-[#1C1C1F] text-white"
            }`}
          >
            <Clock className="h-5 w-5" />
            <div>
              <div className="font-mono text-xl font-bold tracking-wider">
                {isLive ? formatTimer(timeRemainingSecs) : "00:00"}
              </div>
              <span className="text-[9px] uppercase tracking-wider text-[#8E8E93]">
                {isLive ? (timeRemainingSecs < 120 ? "SOFT-CLOSE ZONE" : "TIME REMAINING") : "AUCTION STOPPED"}
              </span>
            </div>
          </div>

          {/* Host Controls */}
          {isHost && (
            <div className="flex items-center gap-2">
              {auction?.status === "SCHEDULED" && (
                <button
                  onClick={() => openAuctionMutation.mutate(auctionId)}
                  disabled={openAuctionMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
                >
                  <Play className="h-3.5 w-3.5" />
                  Open Floor
                </button>
              )}
              {isLive && (
                <button
                  onClick={() => cancelAuctionMutation.mutate({ auctionId, reason: "Buyer emergency stop" })}
                  disabled={cancelAuctionMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-500"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel
                </button>
              )}
              {auction?.status === "CLOSED" && (
                <button
                  onClick={() => releaseResultsMutation.mutate(auctionId)}
                  disabled={releaseResultsMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
                >
                  <Award className="h-3.5 w-3.5" />
                  Release Results
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Anti-sniping Overtime Banner */}
      {auction?.extension_count && auction.extension_count > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Anti-Sniping Soft-Close Triggered:</strong> Extended {auction.extension_count} time(s) (+
            {(auction.config?.auto_extend_duration_minutes || 3) * auction.extension_count} mins total) due to late bidding activity.
          </span>
        </div>
      ) : null}

      {/* Main Grid: Bidding Console (Left) + Leaderboard/History (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Bidding Station */}
        <div className="lg:col-span-2 space-y-6">
          {/* L1 & Personal Rank Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* L1 Best Price */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400 block mb-1">
                Current Best Bid (L1 Lowest)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-white">
                  ₹{currentLeaderPrice.toLocaleString("en-IN")}
                </span>
                <span className="text-xs text-emerald-400 font-medium">INR</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[#8E8E93]">
                <span>Min Decrement: ₹{minDecrement.toLocaleString("en-IN")}</span>
                <span>Next Valid: ≤ ₹{nextMaxBidAllowed.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* User Standing (Supplier Mode) */}
            {!isHost && (
              <div className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8E8E93] block mb-1">
                  Your Current Standing
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`font-mono text-3xl font-bold ${
                          userRank === 1 ? "text-emerald-400" : userRank ? "text-amber-400" : "text-[#8E8E93]"
                        }`}
                      >
                        {userRank ? `Rank #${userRank}` : "Not Ranked"}
                      </span>
                    </div>
                    <span className="text-xs text-[#8E8E93]">
                      Your Bid: ₹{userBid ? userBid.toLocaleString("en-IN") : "---"}
                    </span>
                  </div>
                  {userRank === 1 ? (
                    <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-400 border border-emerald-500/20">
                      <Award className="h-6 w-6" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-amber-500/10 p-3 text-amber-400 border border-amber-500/20">
                      <TrendingDown className="h-6 w-6" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Console: Bidding Input (Supplier) */}
          {!isHost && (
            <div className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Rapid-Fire Decrement Console
                  </h3>
                  <p className="text-xs text-[#8E8E93] mt-0.5">
                    Click a preset decrement button to submit an instantaneous compliant bid, or type a custom amount.
                  </p>
                </div>
              </div>

              {(actionError || rejectionReason) && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300 flex items-center gap-2">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>{actionError || rejectionReason}</span>
                </div>
              )}

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-3 gap-3">
                {[minDecrement, minDecrement * 2, minDecrement * 5].map((dec, idx) => {
                  const targetBid = Math.max(0, currentLeaderPrice - dec);
                  return (
                    <button
                      key={idx}
                      onClick={() => handlePlaceBid(targetBid)}
                      disabled={!isLive || targetBid <= 0}
                      className="flex flex-col items-center justify-center rounded-xl border border-[#2e2e32] bg-[#252529] p-3 text-center transition-colors hover:border-emerald-500/50 hover:bg-[#2e2e32] disabled:opacity-40"
                    >
                      <span className="text-[11px] font-medium text-[#8E8E93]">
                        -₹{dec.toLocaleString("en-IN")}
                      </span>
                      <span className="font-mono text-sm font-bold text-white mt-1">
                        ₹{targetBid.toLocaleString("en-IN")}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Bid Input */}
              <div className="flex items-center gap-3 pt-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-[#8E8E93]">₹</span>
                  <input
                    type="number"
                    value={customBidAmount}
                    onChange={(e) => setCustomBidAmount(e.target.value)}
                    placeholder={`Enter bid ≤ ₹${nextMaxBidAllowed.toLocaleString("en-IN")}`}
                    className="w-full rounded-xl border border-[#2e2e32] bg-[#252529] pl-7 pr-4 py-2.5 text-sm text-white font-mono placeholder:text-[#636366] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => handlePlaceBid(Number(customBidAmount))}
                  disabled={
                    !isLive ||
                    !customBidAmount ||
                    Number(customBidAmount) > nextMaxBidAllowed
                  }
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit Bid
                </button>
              </div>

              {/* Automated Proxy Bidding Floor */}
              <div className="border-t border-[#2e2e32] pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#8E8E93]">
                    <Sliders className="h-4 w-4 text-blue-400" />
                    <span>Automated Proxy Floor:</span>
                  </div>
                  {proxySetSuccess && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Proxy Floor Active
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-xs text-[#8E8E93]">₹</span>
                    <input
                      type="number"
                      value={proxyFloorAmount}
                      onChange={(e) => setProxyFloorAmount(e.target.value)}
                      placeholder="Enter lowest amount bot will bid on your behalf..."
                      className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] pl-7 pr-3 py-1.5 text-xs text-white font-mono placeholder:text-[#636366] focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSetProxy}
                    disabled={setProxyFloorMutation.isPending || !proxyFloorAmount}
                    className="rounded-lg border border-[#2e2e32] bg-[#252529] px-3.5 py-1.5 text-xs font-medium text-[#E5E5EA] hover:bg-[#2e2e32]"
                  >
                    Set Floor
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Real-time Bid Log Stream */}
          <div className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              Live Bid Feed (Audit Verified)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#2e2e32] text-[#8E8E93] uppercase font-semibold">
                  <tr>
                    <th className="py-2.5">Seq #</th>
                    <th className="py-2.5">Participant</th>
                    <th className="py-2.5">Bid Amount</th>
                    <th className="py-2.5">Type</th>
                    <th className="py-2.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2e2e32] font-mono">
                  {bidHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[#8E8E93] font-sans">
                        No live bids submitted yet. Waiting for opening bids...
                      </td>
                    </tr>
                  ) : (
                    bidHistory.slice(0, 10).map((b: any) => (
                      <tr key={b.id} className="hover:bg-[#252529]/40">
                        <td className="py-2.5 text-[#8E8E93]">#{b.bid_sequence}</td>
                        <td className="py-2.5 text-white font-sans font-medium">
                          {b.vendor_name || `Bidder #${b.vendor_id.slice(0, 4)}`}
                        </td>
                        <td className="py-2.5 font-bold text-emerald-400">
                          ₹{b.bid_amount_inr.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 text-[#8E8E93]">
                          {b.is_proxy_bid ? "Proxy Bot" : "Manual"}
                        </td>
                        <td className="py-2.5 text-right text-[#8E8E93]">
                          {new Date(b.created_at).toLocaleTimeString("en-IN")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Anonymized Leaderboard */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-5">
            <div className="flex items-center justify-between border-b border-[#2e2e32] pb-3 mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                Live Standings (Leaderboard)
              </h3>
              <span className="text-[10px] text-[#8E8E93] font-mono">
                {effectiveRankings.length} active
              </span>
            </div>

            <div className="space-y-2">
              {effectiveRankings.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#8E8E93]">
                  Awaiting opening bids from admitted suppliers.
                </div>
              ) : (
                effectiveRankings.map((r: any, idx: number) => {
                  const isTop = idx === 0;
                  return (
                    <div
                      key={r.vendor_id || idx}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        isTop
                          ? "border-emerald-500/40 bg-emerald-950/20 text-white"
                          : "border-[#2e2e32] bg-[#252529]/60 text-[#E5E5EA]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-bold ${
                            isTop ? "bg-emerald-500 text-black" : "bg-[#2e2e32] text-[#8E8E93]"
                          }`}
                        >
                          {r.rank || idx + 1}
                        </span>
                        <div>
                          <span className="font-medium text-xs block">
                            {r.vendor_name || `Participant #${idx + 1}`}
                          </span>
                          <span className="text-[10px] text-[#8E8E93]">
                            {new Date(r.submitted_at).toLocaleTimeString("en-IN")}
                          </span>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <span className={`text-sm font-bold ${isTop ? "text-emerald-400" : "text-white"}`}>
                          ₹{r.bid_amount_inr ? r.bid_amount_inr.toLocaleString("en-IN") : "---"}
                        </span>
                        {isTop && (
                          <span className="text-[9px] uppercase tracking-wider text-emerald-400 block font-sans">
                            L1 Leader
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#2e2e32] text-[11px] text-[#8E8E93] flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-blue-400" />
              <span>Identity masking active per CVC Guidelines</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
