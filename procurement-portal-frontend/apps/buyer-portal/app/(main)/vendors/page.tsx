"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useVendors, Vendor } from "@procurement/hooks";
import { VendorStatusBadge, PermissionGuard } from "@procurement/ui";

export default function VendorsListPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const PAGE_SIZE = 20;

  const { data, isLoading, isError } = useVendors({
    page,
    page_size: PAGE_SIZE,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const vendors = data?.vendors ?? [];
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? 1;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage vendor lifecycle, qualification, compliance, and scorecards.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PermissionGuard permission="vendor.invite">
            <Link
              href="/vendors/invite"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span aria-hidden="true">+</span>
              <span>Invite Vendor</span>
            </Link>
          </PermissionGuard>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Search by name, GSTIN, PAN, code, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label htmlFor="status-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="INVITED">Invited</option>
            <option value="REGISTRATION_IN_PROGRESS">In Progress</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="RESUBMISSION_REQUESTED">Resubmission Requested</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="COMPLIANCE_HOLD">Compliance Hold</option>
            <option value="BLACKLISTED">Blacklisted</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 space-y-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4" />
            <div className="h-12 bg-gray-100 rounded" />
            <div className="h-12 bg-gray-100 rounded" />
            <div className="h-12 bg-gray-100 rounded" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-600 text-sm">
            Failed to load vendors. Please try again.
          </div>
        ) : vendors.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="text-4xl mb-2">🏢</div>
            <p className="font-medium">No vendors found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Vendor Name</th>
                  <th className="px-6 py-3.5">Vendor Code</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">PAN / GSTIN</th>
                  <th className="px-6 py-3.5">Contact</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Score</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {vendors.map((vendor: Vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <Link href={`/vendors/${vendor.id}`} className="hover:text-blue-600 hover:underline">
                        {vendor.company_name}
                      </Link>
                      {vendor.legal_name && vendor.legal_name !== vendor.company_name && (
                        <p className="text-xs text-gray-400">{vendor.legal_name}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                      {vendor.vendor_code || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <VendorStatusBadge status={vendor.status} />
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-600">
                      <div>{vendor.pan || "—"}</div>
                      <div className="text-gray-400">{vendor.gstin || "—"}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div>{vendor.primary_email}</div>
                      <div className="text-xs text-gray-400">{vendor.primary_phone || "—"}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {vendor.performance_score !== null && vendor.performance_score !== undefined ? (
                        <span
                          className={`font-semibold text-xs px-2 py-0.5 rounded ${
                            vendor.performance_score >= 80
                              ? "bg-green-100 text-green-800"
                              : vendor.performance_score >= 60
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {vendor.performance_score}%
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/vendors/${vendor.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-500 text-xs">
              Page {page} of {totalPages} ({meta?.total_count ?? 0} total vendors)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
