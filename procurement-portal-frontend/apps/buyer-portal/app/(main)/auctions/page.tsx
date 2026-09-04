"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRfqs } from "@procurement/hooks";
import { Badge, Button } from "@procurement/ui";
import { ArrowRight, Gavel, Search } from "lucide-react";

export default function BuyerAuctionsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const PAGE_SIZE = 20;

  const { data, isLoading, isError } = useRfqs({
    page,
    page_size: PAGE_SIZE,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const rfqs = data?.rfqs ?? [];
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? 1;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Gavel className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Live Reverse Auctions</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time reverse auction rooms and dynamic counter-bidding events synced with RFQs & Tenders.
          </p>
        </div>
        <Link
          href="/rfqs"
          className="inline-flex items-center px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-sm transition"
        >
          View All RFQs & Tenders →
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search auctions by RFQ number or title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-3.5 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="PUBLISHED">Published (Live)</option>
          <option value="BID_OPEN">Awaiting Bid Opening</option>
          <option value="BIDS_OPENED">Bids Opened</option>
          <option value="UNDER_EVALUATION">Under Evaluation</option>
          <option value="AWARDED">Awarded</option>
          <option value="DRAFT">Draft</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading live auctions…
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-red-500 text-sm">Failed to load auctions.</div>
        ) : rfqs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No auctions or RFQs found matching the filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b">
                <tr>
                  <th className="px-6 py-3.5">RFQ Number</th>
                  <th className="px-6 py-3.5">Title</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Est. Value</th>
                  <th className="px-6 py-3.5">Deadline</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rfqs.map((rfq) => (
                  <tr key={rfq.id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-gray-900">
                      <Link href={`/rfqs/${rfq.id}`} className="hover:text-blue-600 hover:underline">
                        {rfq.rfq_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-[280px] truncate" title={rfq.title}>
                      {rfq.title}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">
                        {rfq.rfq_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={rfq.status}>
                        {rfq.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      ₹{Number(rfq.estimated_value).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {rfq.bid_close_at ? new Date(rfq.bid_close_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/rfqs/${rfq.id}/auction`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                        >
                          <span>⚡ Live Auction Room</span>
                        </Link>
                        <Link href={`/rfqs/${rfq.id}`}>
                          <Button variant="secondary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                            Details
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between text-xs text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
