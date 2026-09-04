"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuctionSocket } from "@procurement/hooks";
import { AuctionCountdownTimer, BidEntryPanel } from "@procurement/ui";
import { apiClient } from "@procurement/utils";

export default function AuctionRoomPage() {
  const params = useParams();
  const auctionId = (params?.id as string) || "";
  const { connected, lastMessage, sendBid } = useAuctionSocket(auctionId);
  const [auction, setAuction] = useState<any>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [l1Price, setL1Price] = useState<number | null>(null);
  const [closed, setClosed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial auction state
  useEffect(() => {
    if (!auctionId) return;
    setIsLoading(true);
    apiClient
      .get(`/auctions/${auctionId}`)
      .then((res) => {
        const data = res.data?.data || res.data;
        setAuction(data);
        if (data.status === "CLOSED" || data.status === "CANCELLED") {
          setClosed(true);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || "Failed to load auction");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [auctionId]);

  // Handle real-time messages
  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage as any;
    if (type === "RANK_UPDATE") {
      setMyRank(payload.your_rank ?? null);
      setL1Price(payload.l1_price_inr ?? null);
    }
    if (type === "AUCTION_EXTENDED" || type === "AUCTION_OPENED") {
      setAuction((prev: any) =>
        prev
          ? {
              ...prev,
              current_close_at: payload.new_close_at ?? prev.current_close_at,
              status: type === "AUCTION_OPENED" ? "OPEN" : prev.status,
            }
          : prev
      );
    }
    if (type === "AUCTION_CLOSED") {
      setClosed(true);
      setAuction((prev: any) => (prev ? { ...prev, status: "CLOSED" } : prev));
    }
  }, [lastMessage]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-4">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Loading auction room…</p>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="max-w-2xl mx-auto p-8 space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          {error || "Auction not found"}
        </div>
        <Link href="/rfqs" className="text-sm text-blue-600 hover:underline">
          ← Back to Tenders
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/rfqs" className="hover:underline">
              Tenders
            </Link>
            <span>/</span>
            <span className="font-mono text-gray-700">Live Auction</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{auction.rfq_title || `Auction ${auctionId.slice(0, 8)}`}</h1>
          <p className="text-xs text-gray-500">Live Reverse Auction Bidding Terminal</p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            title={connected ? "Connected to live stream" : "Reconnecting…"}
          />
          <span className="text-xs text-gray-500">{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      <div className="text-center space-y-1 bg-white dark:bg-gray-900 p-4 rounded-xl border">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Time Remaining</p>
        <AuctionCountdownTimer
          closeAt={auction.current_close_at}
          onExpired={() => setClosed(true)}
        />
        {closed && <p className="text-sm font-semibold text-red-600 mt-2">Auction Closed</p>}
      </div>

      {myRank != null && (
        <div
          className={`rounded-xl p-5 text-center transition-all ${
            myRank === 1
              ? "bg-green-50 border border-green-200 text-green-900 dark:bg-green-950/40"
              : "bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40"
          }`}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Your Current Rank</p>
          <p
            className={`text-3xl font-extrabold mt-1 ${
              myRank === 1 ? "text-green-600" : "text-amber-800 dark:text-amber-300"
            }`}
          >
            {myRank === 1 ? "🏆 L1 Leader" : `L${myRank}`}
          </p>
          {l1Price != null && myRank > 1 && (
            <p className="text-xs text-gray-600 mt-2 font-mono">
              Leading L1 Bid: ₹{Number(l1Price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
      )}

      <BidEntryPanel
        lotId={null}
        currentL1Inr={l1Price}
        minDecrementType={auction.config?.min_decrement_type || "ABSOLUTE"}
        minDecrementValue={auction.config?.min_decrement_value || 1000}
        auctionClosed={closed}
        onSubmit={sendBid}
      />
    </div>
  );
}
