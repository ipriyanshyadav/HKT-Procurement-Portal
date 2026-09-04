"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRfqs, Rfq } from "@procurement/hooks";
import { PermissionGuard } from "@procurement/ui";

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "BID_OPEN":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "BIDS_OPENED":
      case "UNDER_EVALUATION":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "AWARDED":
        return "bg-green-100 text-green-800 border-green-200";
      case "CANCELLED":
      case "NO_BIDS":
        return "bg-red-100 text-red-800 border-red-200";
      case "DRAFT":
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Requests for Quotation (RFQs)</h1>
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 text-sm">Loading RFQs...</div>
        ) : isError ? (
          <div className="p-12 text-center text-red-500 text-sm">Failed to load RFQs.</div>
        ) : rfqs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No RFQs found matching the filters.</div>
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
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-[280px] truncate">
                      {rfq.title}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">
                        {rfq.rfq_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(rfq.status)}`}>
                        {rfq.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      ₹{Number(rfq.estimated_value).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {rfq.bid_close_at ? new Date(rfq.bid_close_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        href={`/rfqs/${rfq.id}`}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        View Details
                      </Link>
                      {rfq.status === "BID_OPEN" && (
                        <Link
                          href={`/rfqs/${rfq.id}/open-bids`}
                          className="inline-flex px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold"
                        >
                          Authorize Opening
                        </Link>
                      )}
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
