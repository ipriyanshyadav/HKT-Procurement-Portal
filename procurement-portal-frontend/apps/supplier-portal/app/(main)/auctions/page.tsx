"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@procurement/utils";

interface AuctionListItem {
  id: string;
  rfq_id: string;
  rfq_number?: string | null;
  rfq_title?: string | null;
  auction_type: string;
  status: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  current_close_at: string;
}

export default function SupplierAuctionsPage() {
  const [auctions, setAuctions] = useState<AuctionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Live Reverse Auctions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Participate in real-time reverse auction events and submit competitive counter-bids.
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-500">Loading auctions…</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
          {error}
        </div>
      ) : auctions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No live auctions active right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {auctions.map((a) => {
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
                          ? "bg-emerald-100 text-emerald-800 animate-pulse"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {a.status}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">{a.auction_type}</span>
                  </div>

                  <div>
                    {a.rfq_number ? (
                      <span className="font-mono text-xs font-semibold text-blue-600 block">
                        {a.rfq_number}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-gray-400 block">
                        RFQ: {a.rfq_id.slice(0, 8)}
                      </span>
                    )}
                    <h3 className="font-semibold text-gray-900 line-clamp-1 mt-0.5" title={a.rfq_title || undefined}>
                      {a.rfq_title || `Auction ${a.id.slice(0, 8)}`}
                    </h3>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1 pt-2 border-t border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Closing Time:</span>
                      <span className="font-medium">
                        {new Date(a.current_close_at || a.scheduled_end_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100">
                  <Link
                    href={`/auctions/${a.id}`}
                    className={`block w-full text-center py-2 px-3 rounded-lg text-xs font-semibold transition ${
                      isOpen
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                    }`}
                  >
                    {isOpen ? "⚡ Enter Live Auction Room" : "View Auction Details"}
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
