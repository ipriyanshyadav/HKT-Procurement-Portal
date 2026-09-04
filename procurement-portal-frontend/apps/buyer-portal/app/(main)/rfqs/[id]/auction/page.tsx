"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRfq, useAuctionRoom, AuctionBid } from "@procurement/hooks";

export default function BuyerAuctionRoomPage() {
  const params = useParams();
  const rfqId = params?.id as string;

  const { data: rfq, isLoading: rfqLoading } = useRfq(rfqId);
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

  // Time remaining calculation
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

  // Simulation state for buyer testing
  const [testSimAmount, setTestSimAmount] = useState<string>("");
  const [showSimModal, setShowSimModal] = useState(false);

  const currentLowest = auctionState?.current_lowest_bid ?? 100000;
  const minDecrement = auctionState?.min_decrement ?? 1000;

  const handleSimulateBid = async () => {
    const amt = parseFloat(testSimAmount);
    if (isNaN(amt) || amt >= currentLowest) {
      alert(`Simulation bid must be lower than current lowest price (₹${currentLowest.toLocaleString()})`);
      return;
    }
    try {
      await placeBid(amt, "Simulated buyer counter-bid");
      setShowSimModal(false);
      setTestSimAmount("");
    } catch {
      // Error handled in hook
    }
  };

  if (rfqLoading || auctionLoading) {
    return (
      <div className="max-w-6xl mx-auto p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
        <div className="h-96 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Breadcrumb & Live Room Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/rfqs" className="hover:underline">RFQs</Link>
            <span>/</span>
            <Link href={`/rfqs/${rfqId}`} className="hover:underline font-mono">
              {rfq?.rfq_number || rfqId.slice(0, 8)}
            </Link>
            <span>/</span>
            <span className="text-gray-800 font-semibold">Live Reverse Auction</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Reverse Auction Live Room
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
              {isConnected ? "LIVE WEBSOCKET" : "CONNECTING..."}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Real-time dynamic downward ticker monitoring. Lowest quote takes precedence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setTestSimAmount(String(Math.max(1, currentLowest - minDecrement)));
              setShowSimModal(true);
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            + Test Counter-Bid
          </button>
          <Link
            href={`/rfqs/${rfqId}`}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            Back to RFQ Overview
          </Link>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={clearError} className="text-xs opacity-70 hover:opacity-100 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Hero Live Ticker Board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Leading Lowest Price Card */}
        <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Current Leading Lowest Price
            </span>
            <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-gray-300">
              {auctionState?.currency || "INR"}
            </span>
          </div>

          <div className="my-4">
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono text-emerald-300">
              ₹{currentLowest.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-300 mt-2 flex items-center gap-1.5">
              <span>Leader:</span>
              <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded">
                {auctionState?.leading_bidder_name || "Reserve Ceiling Price"}
              </span>
            </p>
          </div>

          <div className="text-[11px] text-gray-400 pt-3 border-t border-white/10 flex justify-between items-center">
            <span>Min. Decrement: ₹{minDecrement.toLocaleString()}</span>
            <span>Last Activity: {lastBid ? new Date(lastBid.timestamp).toLocaleTimeString() : "Pending bids"}</span>
          </div>
        </div>

        {/* Time Remaining Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Time Remaining
            </span>
            <div className="text-3xl font-extrabold text-gray-900 font-mono mt-2 tracking-tight">
              {timeLeft}
            </div>
          </div>
          <div className="text-xs text-gray-500 pt-4 border-t border-gray-100">
            Ends at:{" "}
            <span className="font-medium text-gray-800">
              {auctionState?.ends_at ? new Date(auctionState.ends_at).toLocaleTimeString() : "—"}
            </span>
          </div>
        </div>

        {/* Total Bids Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Bids Placed
            </span>
            <div className="text-3xl font-extrabold text-blue-600 font-mono mt-2 tracking-tight">
              {auctionState?.total_bids || 0}
            </div>
          </div>
          <div className="text-xs text-gray-500 pt-4 border-t border-gray-100">
            Activity:{" "}
            <span className="font-medium text-emerald-600">
              {isConnected ? "Active Feed" : "Reconnecting"}
            </span>
          </div>
        </div>
      </div>

      {/* Live Waterfall Feed */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Live Bid Stream (Real-Time Feed)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Chronological log of incoming price reductions broadcasted to all room participants.
            </p>
          </div>
          <span className="text-xs font-mono text-gray-400">
            {auctionState?.bids?.length || 0} event{auctionState?.bids?.length === 1 ? "" : "s"}
          </span>
        </div>

        {(!auctionState?.bids || auctionState.bids.length === 0) ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            No counter-bids placed yet. The auction room is open at the reserve ceiling price.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="p-3.5"># Rank</th>
                  <th className="p-3.5">Time</th>
                  <th className="p-3.5">Bidder</th>
                  <th className="p-3.5 text-right">Offer Amount</th>
                  <th className="p-3.5 text-right">Drop vs Ceiling</th>
                  <th className="p-3.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {auctionState.bids.map((b: AuctionBid, index: number) => {
                  const isTop = index === 0;
                  return (
                    <tr
                      key={b.id}
                      className={`transition-colors ${
                        isTop ? "bg-emerald-50/50 font-semibold text-emerald-950" : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <td className="p-3.5">
                        {isTop ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                            👑 LEADER
                          </span>
                        ) : (
                          <span className="text-gray-400">#{index + 1}</span>
                        )}
                      </td>
                      <td className="p-3.5 text-gray-500 text-[11px]">
                        {new Date(b.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-3.5 font-sans font-medium text-gray-900">
                        {b.bidder_name}
                      </td>
                      <td className="p-3.5 text-right font-bold text-gray-900 text-sm">
                        ₹{b.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-right text-emerald-600 text-xs">
                        -₹{(100000 - b.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 font-sans text-gray-500 text-[11px]">
                        {b.remarks || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simulation Modal for Testing */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Test Counter-Bid Simulation</h3>
            <p className="text-xs text-gray-500">
              Submit a lower test bid to observe real-time WebSocket ticker updates and event broadcasts.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Counter-Bid Amount (₹)
              </label>
              <input
                type="number"
                value={testSimAmount}
                onChange={(e) => setTestSimAmount(e.target.value)}
                placeholder={`Less than ₹${currentLowest}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Must be lower than current lowest price of ₹{currentLowest.toLocaleString()}.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSimModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSimulateBid}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Send Test Bid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
