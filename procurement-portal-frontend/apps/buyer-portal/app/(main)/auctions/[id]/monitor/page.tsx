"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuctionSocket } from "@procurement/hooks";
import { PriceLeaderboard, AuctionCountdownTimer } from "@procurement/ui";
import { apiClient } from "@procurement/utils";

export default function AuctionMonitorPage() {
  const params = useParams();
  const auctionId = (params?.id as string) || "";
  const { connected, lastMessage } = useAuctionSocket(auctionId);
  const [auction, setAuction] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [extensionCount, setExtensionCount] = useState(0);
  const [totalBids, setTotalBids] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auctionId) return;
    setIsLoading(true);
    Promise.all([
      apiClient.get(`/auctions/${auctionId}`),
      apiClient.get(`/auctions/${auctionId}/leaderboard`),
    ])
      .then(([auctionRes, leaderboardRes]) => {
        const aData = auctionRes.data?.data || auctionRes.data;
        const lData = leaderboardRes.data?.data || leaderboardRes.data;
        setAuction(aData);
        setLeaderboard(Array.isArray(lData) ? lData : []);
        setExtensionCount(aData.extension_count || 0);
        setTotalBids(aData.total_bids || (Array.isArray(lData) ? lData.length : 0));
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || "Failed to load auction data");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [auctionId]);

  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage as any;
    if (type === "LEADERBOARD_UPDATE") {
      setLeaderboard(payload.rankings ?? []);
    }
    if (type === "NEW_BID") {
      setTotalBids(payload.total_bids ?? ((prev) => prev + 1));
    }
    if (type === "AUCTION_EXTENDED") {
      setExtensionCount(payload.extension_count);
      setAuction((a: any) => (a ? { ...a, current_close_at: payload.new_close_at } : a));
    }
  }, [lastMessage]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center space-y-4">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Loading auction monitor…</p>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          {error || "Auction not found"}
        </div>
        <Link href="/auctions" className="text-sm text-blue-600 hover:underline">
          ← Back to Auctions
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/auctions" className="hover:underline">
              Auctions
            </Link>
            <span>/</span>
            <span className="font-mono text-gray-700">{auctionId.slice(0, 8)}</span>
            <span>/</span>
            <span className="font-medium text-gray-900">Live Monitor</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {auction.rfq_title ? `${auction.rfq_title} — Live Monitor` : "Auction Monitor"}
          </h1>
          <p className="text-xs text-gray-500">
            Status: <span className="font-semibold text-gray-700">{auction.status}</span> · Type: {auction.auction_type}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-gray-100 text-gray-700 font-mono px-2.5 py-1 rounded-full">
            {totalBids} {totalBids === 1 ? "bid" : "bids"}
          </span>
          {extensionCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-800 font-medium px-2.5 py-1 rounded-full">
              Extended ×{extensionCount}
            </span>
          )}
          <div className="flex items-center gap-1.5 pl-2 border-l">
            <div
              className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
              title={connected ? "Connected" : "Disconnected"}
            />
            <span className="text-xs text-gray-500">{connected ? "Live" : "Offline"}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border text-center space-y-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Time Remaining</p>
        <AuctionCountdownTimer closeAt={auction.current_close_at} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Live Vendor Rankings (L1 to Ln)</h2>
          <span className="text-xs text-gray-500">Auto-refreshed via real-time WebSocket</span>
        </div>
        <PriceLeaderboard rankings={leaderboard} isBuyer={true} />
      </div>
    </div>
  );
}
