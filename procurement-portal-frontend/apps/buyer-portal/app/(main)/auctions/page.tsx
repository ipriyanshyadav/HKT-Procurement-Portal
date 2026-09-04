"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@procurement/utils";

interface AuctionListItem {
  id: string;
  rfq_id: string;
  rfq_title?: string;
  auction_type: string;
  status: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  current_close_at: string;
  extension_count: number;
  total_bids?: number;
}

export default function BuyerAuctionsPage() {
  const [auctions, setAuctions] = useState<AuctionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    setIsLoading(true);
    apiClient
      .get("/auctions")
      .then((res) => {
        const data = res.data?.data || res.data;
        setAuctions(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || "Failed to load auctions");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const filteredAuctions = auctions.filter((a) => {
    if (statusFilter === "ALL") return true;
    return a.status === statusFilter;
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Reverse Auctions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor real-time reverse auction events, track bid decrements, and manage live bidding.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b text-sm">
        {["ALL", "OPEN", "SCHEDULED", "PAUSED", "CLOSED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 border-b-2 font-medium text-xs transition ${
              statusFilter === s
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-500">Loading auctions…</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
          {error}
        </div>
      ) : filteredAuctions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No auctions found matching this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAuctions.map((a) => {
            const isOpen = a.status === "OPEN";
            return (
              <div
                key={a.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isOpen
                          ? "bg-green-100 text-green-800 animate-pulse"
                          : a.status === "SCHEDULED"
                          ? "bg-blue-100 text-blue-800"
                          : a.status === "PAUSED"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {a.status}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">{a.auction_type}</span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 line-clamp-1">
                      {a.rfq_title || `Auction ${a.id.slice(0, 8)}`}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">RFQ: {a.rfq_id.slice(0, 8)}</p>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1 pt-2 border-t border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Scheduled Close:</span>
                      <span className="font-medium">
                        {new Date(a.current_close_at || a.scheduled_end_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {a.extension_count > 0 && (
                      <div className="flex justify-between text-amber-700">
                        <span>Extensions:</span>
                        <span className="font-semibold">×{a.extension_count}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100">
                  <Link
                    href={`/auctions/${a.id}/monitor`}
                    className={`block w-full text-center py-2 px-3 rounded-lg text-xs font-semibold transition ${
                      isOpen
                        ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                    }`}
                  >
                    {isOpen ? "⚡ Live Monitor Terminal" : "View Auction Details"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
