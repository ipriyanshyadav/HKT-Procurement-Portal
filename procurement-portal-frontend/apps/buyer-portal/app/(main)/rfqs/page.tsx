"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRfqs, Rfq } from "@procurement/hooks";
import { PermissionGuard, Badge, Button } from "@procurement/ui";
import { ArrowRight, Lock, Zap } from "lucide-react";

export default function RfqListPage() {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Requests for Quotation (RFQs)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage sourcing events, invite suppliers, inspect sealed submissions, and authorize bid openings.
          </p>
        </div>
        <PermissionGuard permission="rfq.create">
          <Link
            href="/rfqs/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            + Create New RFQ
          </Link>
        </PermissionGuard>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by RFQ number or title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full text-sm border border-gray-300 rounded-lg px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="APPROVED">Approved</option>
          <option value="PUBLISHED">Published (Live)</option>
          <option value="BID_OPEN">Awaiting Bid Opening</option>
          <option value="BIDS_OPENED">Bids Opened</option>
          <option value="UNDER_EVALUATION">Under Evaluation</option>
          <option value="AWARDED">Awarded</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">Loading RFQs...</div>
        ) : isError ? (
          <div className="p-12 text-center text-rose-500 dark:text-rose-400 text-sm">Failed to load RFQs.</div>
        ) : rfqs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">No RFQs found matching the filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-[#252529] text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="px-6 py-3.5">RFQ Number</th>
                  <th className="px-6 py-3.5">Title</th>
                  <th className="px-6 py-3.5">Type & Mode</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Est. Value</th>
                  <th className="px-6 py-3.5">Deadline</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {rfqs.map((rfq) => (
                  <tr key={rfq.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                      <Link href={`/rfqs/${rfq.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
                        {rfq.rfq_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 max-w-[280px] truncate">
                      {rfq.title}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="flex flex-col gap-1 items-start">
                        {rfq.rfq_type === "EMERGENCY" ? (
                          <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 rounded font-semibold text-[11px] flex items-center gap-1">
                            <span>🚨</span> Emergency (24h)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded font-medium text-[11px]">
                            {rfq.rfq_type}
                          </span>
                        )}
                        {rfq.bidding_mode === "LIVE_AUCTION" && (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 rounded font-semibold text-[10px] flex items-center gap-1">
                            <span>⚡</span> Reverse Auction
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={rfq.status}>
                        {rfq.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-medium font-mono text-slate-900 dark:text-slate-100">
                      ₹{Number(rfq.estimated_value).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {rfq.bid_close_at ? new Date(rfq.bid_close_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {rfq.bidding_mode === "LIVE_AUCTION" && (
                          <Link href={`/rfqs/${rfq.id}/auction`}>
                            <Button variant="secondary" size="sm" icon={<Zap className="w-3.5 h-3.5 text-amber-500" />}>
                              Auction
                            </Button>
                          </Link>
                        )}
                        {rfq.status === "BID_OPEN" && (
                          <Link href={`/rfqs/${rfq.id}/open-bids`}>
                            <Button variant="primary" size="sm" icon={<Lock className="w-3.5 h-3.5" />}>
                              Authorize Opening
                            </Button>
                          </Link>
                        )}
                        <Link href={`/rfqs/${rfq.id}`}>
                          <Button variant="secondary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                            View
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
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-800/50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-800/50"
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
