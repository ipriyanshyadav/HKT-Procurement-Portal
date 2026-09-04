"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRfqs } from "@procurement/hooks";

export default function SupplierRfqListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useRfqs({
    page,
    page_size: 20,
    search: search || undefined,
  });

  const rfqs = data?.rfqs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tender Invitations & Sourcing Events</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review active tenders, review specifications, ask clarifications, and submit cryptographically sealed bids.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <input
          type="text"
          placeholder="Search by tender title or RFQ number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* Cards / Table */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500 bg-white rounded-xl border">Loading tenders...</div>
        ) : isError ? (
          <div className="p-12 text-center text-sm text-red-500 bg-white rounded-xl border">Failed to load tenders.</div>
        ) : rfqs.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500 bg-white rounded-xl border">No active tenders found.</div>
        ) : (
          rfqs.map((rfq) => {
            const isClosed = rfq.bid_close_at && new Date(rfq.bid_close_at) < new Date();

            return (
              <div
                key={rfq.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:border-gray-300 transition-colors space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <span className="font-mono text-xs font-semibold text-blue-600 block">{rfq.rfq_number}</span>
                    <h2 className="text-lg font-bold text-gray-900 mt-0.5">{rfq.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {rfq.rfq_type}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                      {rfq.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-gray-600">
                  <div>
                    <span className="text-gray-400 block">Sourcing Type</span>
                    <span className="font-medium text-gray-800">{rfq.sourcing_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Evaluation Mode</span>
                    <span className="font-medium text-gray-800">{rfq.evaluation_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Submission Deadline</span>
                    <span className={`font-medium ${isClosed ? "text-red-600" : "text-gray-800"}`}>
                      {rfq.bid_close_at ? new Date(rfq.bid_close_at).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Bid Validity Required</span>
                    <span className="font-medium text-gray-800">{rfq.bid_validity_days} Days</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <span className="text-gray-500 italic">
                    🛡️ Cryptographically sealed submission active
                  </span>
                  <div className="flex gap-2">
                    <Link
                      href={`/rfqs/${rfq.id}/auction`}
                      className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white shadow-sm transition flex items-center gap-1"
                    >
                      <span>⚡ Live Auction</span>
                    </Link>
                    <Link
                      href={`/rfqs/${rfq.id}/bid`}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg text-white shadow-sm ${
                        isClosed ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {isClosed ? "Deadline Passed" : "Submit / Revise Bid"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
