"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useRfq,
  useAuctionRoom,
  useCurrentUser,
  useMyVendor,
  AuctionBid,
} from "@procurement/hooks";

export default function SupplierAuctionRoomPage() {
  const params = useParams();
  const rfqId = params?.id as string;

  const { data: rfq, isLoading: rfqLoading } = useRfq(rfqId);
  const { data: currentUser } = useCurrentUser();
  const { data: myVendor } = useMyVendor();

  const {
    auctionState,
    isLoading: auctionLoading,
    isConnected,
    lastBid,
    errorMessage,
    clearError,
    placeBid,
    isSubmitting,
  } = useAuctionRoom(rfqId);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState<string>("00:00:00");

  useEffect(() => {
    if (!auctionState?.ends_at) return;
    const interval = setInterval(() => {
      const remaining = new Date(auctionState.ends_at).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft("AUCTION ENDED");
      } else {
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [auctionState?.ends_at]);

  // Bid form state
  const currentLowest = auctionState?.current_lowest_bid ?? 100000;
  const minDecrement = auctionState?.min_decrement ?? 1000;
  const maxEligibleBid = Math.max(0, currentLowest - minDecrement);

  const [bidAmount, setBidAmount] = useState<string>("");
  const [bidRemarks, setBidRemarks] = useState<string>("");
  const [bidSuccessAlert, setBidSuccessAlert] = useState<string | null>(null);

  // Determine if this supplier is leading
  const isLeading =
    auctionState?.leading_bidder_id === currentUser?.id ||
    (myVendor && auctionState?.leading_bidder_name?.includes(myVendor.company_name));

  const handlePlaceBid = async (amountToSubmit?: number) => {
    const amt = amountToSubmit ?? parseFloat(bidAmount);
    if (isNaN(amt) || amt >= currentLowest) {
      alert(
        `Your bid (₹${amt.toLocaleString()}) must be lower than the current leading bid (₹${currentLowest.toLocaleString()}).`
      );
      return;
    }

    try {
      await placeBid(amt, bidRemarks || undefined);
      setBidSuccessAlert(`Your counter-bid of ₹${amt.toLocaleString()} is now the leading quote!`);
      setBidAmount("");
      setBidRemarks("");
      setTimeout(() => setBidSuccessAlert(null), 4000);
    } catch {
      // Error message tracked in hook
    }
  };

  if (rfqLoading || auctionLoading) {
    return (
      <div className="max-w-5xl mx-auto p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-80 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/rfqs" className="hover:underline">RFQs</Link>
            <span>/</span>
            <span className="font-mono">{rfq?.rfq_number || rfqId.slice(0, 8)}</span>
            <span>/</span>
            <span className="text-gray-800 font-semibold">Live Reverse Auction</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Reverse Auction Bidding Terminal
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
              {isConnected ? "LIVE WEBSOCKET" : "CONNECTING..."}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {rfq?.title || "Active Sourcing Tender"} · Lowest price submitted wins evaluation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/rfqs/${rfqId}/bid`}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            Sealed Bid Form
          </Link>
          <Link
            href="/rfqs"
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
          >
            ← Tender List
          </Link>
        </div>
      </div>

      {/* Success Notification */}
      {bidSuccessAlert && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-sm">
          <span>✓ {bidSuccessAlert}</span>
          <button onClick={() => setBidSuccessAlert(null)} className="font-bold opacity-70 hover:opacity-100 ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Error notification */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between shadow-sm">
          <span>⚠ {errorMessage}</span>
          <button onClick={clearError} className="font-bold opacity-70 hover:opacity-100 ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Supplier Status Banner */}
      <div
        className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between shadow-sm ${
          isLeading
            ? "bg-emerald-50 border-emerald-300 text-emerald-900"
            : "bg-amber-50 border-amber-300 text-amber-900"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isLeading ? "🏆" : "⚡"}</span>
          <div>
            <p className="font-bold text-base">
              {isLeading
                ? "You Are Currently in the Lead (L1)"
                : "You Are Currently Outbid — Submit Counter-Bid"}
            </p>
            <p className="text-xs font-normal opacity-90">
              {isLeading
                ? "Your organization currently holds the lowest price in this auction."
                : `The current market lowest bid is ₹${currentLowest.toLocaleString()}. Lower your price to take L1 status.`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-normal block opacity-80">Time Left</span>
          <span className="text-xl font-extrabold font-mono tracking-tight">{timeLeft}</span>
        </div>
      </div>

      {/* Live Bidding Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Pricing & Counter-Bid Terminal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticker Card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                Current Leading Market Price
              </span>
              <span className="text-xs font-mono bg-white/10 px-2.5 py-0.5 rounded text-gray-300">
                Currency: {auctionState?.currency || "INR"}
              </span>
            </div>

            <div className="text-4xl sm:text-5xl font-extrabold text-emerald-300 font-mono tracking-tight">
              ₹{currentLowest.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs">
              <div>
                <span className="text-gray-400 block">Max Next Eligible Bid</span>
                <span className="font-mono font-bold text-white text-sm">
                  ₹{maxEligibleBid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">Min Required Decrement</span>
                <span className="font-mono font-semibold text-gray-200">
                  ₹{minDecrement.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Place Counter-Bid Box */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-gray-900">Instant Counter-Bid Terminal</h2>

            {/* Quick Decrement Buttons */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">
                Quick Decrement Shortcuts
              </label>
              <div className="flex flex-wrap gap-2">
                {[minDecrement, minDecrement * 2.5, minDecrement * 5].map((drop) => {
                  const targetAmt = Math.max(0, currentLowest - drop);
                  return (
                    <button
                      key={drop}
                      type="button"
                      onClick={() => setBidAmount(String(targetAmt))}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold font-mono transition shadow-xs"
                    >
                      -₹{drop.toLocaleString()} (₹{targetAmt.toLocaleString()})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual Bid Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Your New Bid Amount (₹)
                </label>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`Must be ≤ ₹${maxEligibleBid.toLocaleString()}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={bidRemarks}
                  onChange={(e) => setBidRemarks(e.target.value)}
                  placeholder="e.g. Volume discount applied"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="button"
              onClick={() => handlePlaceBid()}
              disabled={isSubmitting || !bidAmount}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Transmitting Bid...</span>
              ) : (
                <span>
                  🚀 Place Counter-Bid {bidAmount ? `(₹${parseFloat(bidAmount).toLocaleString()})` : ""}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right Col: Live Feed & Room Stats */}
        <div className="space-y-6">
          {/* Room Summary */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider">
              Auction Room Summary
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Total Bids:</span>
                <span className="font-mono font-bold text-gray-800">{auctionState?.total_bids || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Min Decrement:</span>
                <span className="font-mono font-semibold text-gray-800">₹{minDecrement.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Connection Status:</span>
                <span className="font-semibold text-emerald-600">
                  {isConnected ? "Connected (Realtime)" : "Connecting..."}
                </span>
              </div>
            </div>
          </div>

          {/* Waterfall Bid History */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider">
              Recent Price Reductions
            </h3>
            {(!auctionState?.bids || auctionState.bids.length === 0) ? (
              <p className="text-xs text-gray-400 italic">No counter-bids placed yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {auctionState.bids.slice(0, 10).map((b: AuctionBid, index: number) => {
                  const isTop = index === 0;
                  return (
                    <div
                      key={b.id}
                      className={`p-2.5 rounded-lg border text-xs transition ${
                        isTop ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-gray-900">
                          ₹{b.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(b.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-gray-500 mt-1">
                        <span>{b.bidder_name}</span>
                        {isTop && (
                          <span className="text-[10px] font-bold text-emerald-700">👑 LEADER</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
