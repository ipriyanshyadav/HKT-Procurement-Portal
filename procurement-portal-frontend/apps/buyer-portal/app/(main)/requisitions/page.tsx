"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRequisitions,
  useMergeRequisitions,
  Requisition,
} from "@procurement/hooks";
import { PermissionGuard } from "@procurement/ui";

export default function RequisitionsListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [scope, setScope] = useState<"all" | "mine" | "bu">("mine");
  const [search, setSearch] = useState<string>("");
  const [selectedPRs, setSelectedPRs] = useState<string[]>([]);
  const PAGE_SIZE = 20;

  const { data, isLoading, isError } = useRequisitions({
    page,
    page_size: PAGE_SIZE,
    status: statusFilter || undefined,
    search: search || undefined,
    scope,
  });

  const mergeMutation = useMergeRequisitions();

  const requisitions = data?.requisitions ?? [];
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? 1;

  const handleSelectPR = (id: string) => {
    setSelectedPRs((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedPRs.length === requisitions.length) {
      setSelectedPRs([]);
    } else {
      setSelectedPRs(requisitions.map((r) => r.id));
    }
  };

  const handleMerge = async () => {
    if (selectedPRs.length < 2) return;
    try {
      const merged = await mergeMutation.mutateAsync({
        pr_ids: selectedPRs,
      });
      setSelectedPRs([]);
      router.push(`/requisitions/${merged.id}`);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to merge PRs");
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "CONVERTED":
        return "bg-green-100 text-green-800 border-green-200";
      case "PENDING_APPROVAL":
      case "SUBMITTED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "IN_SOURCING":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "DRAFT":
        return "bg-gray-100 text-gray-700 border-gray-200";
      case "REJECTED":
      case "CANCELLED":
      case "WITHDRAWN":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Requisitions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create, track, and manage material and service requisition lifecycles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedPRs.length >= 2 && (
            <PermissionGuard permission="pr.create">
              <button
                onClick={handleMerge}
                disabled={mergeMutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                {mergeMutation.isPending ? "Merging..." : `Merge (${selectedPRs.length}) PRs`}
              </button>
            </PermissionGuard>
          )}
          <PermissionGuard permission="pr.create">
            <Link
              href="/requisitions/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>+ New Requisition</span>
            </Link>
          </PermissionGuard>
        </div>
      </div>

      {/* Scope Toggles & Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Scope Segmented Control */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => { setScope("mine"); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                scope === "mine" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              My Requisitions
            </button>
            <button
              type="button"
              onClick={() => { setScope("bu"); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                scope === "bu" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              My Business Unit
            </button>
            <button
              type="button"
              onClick={() => { setScope("all"); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                scope === "all" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Requisitions
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <input
              type="text"
              placeholder="Search PR number, title..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full md:w-64 px-3.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="IN_SOURCING">In Sourcing</option>
              <option value="CONVERTED">Converted</option>
              <option value="REJECTED">Rejected</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>
        </div>
      </div>

      {/* PR Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={requisitions.length > 0 && selectedPRs.length === requisitions.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th scope="col" className="px-4 py-3.5 font-semibold">PR Number</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Title</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Type</th>
                <th scope="col" className="px-4 py-3.5 font-semibold text-right">Estimated Value</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Required By</th>
                <th scope="col" className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    Loading requisitions...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-red-500">
                    Failed to load requisitions. Please refresh.
                  </td>
                </tr>
              ) : requisitions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    No requisitions found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                requisitions.map((pr) => (
                  <tr key={pr.id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedPRs.includes(pr.id)}
                        onChange={() => handleSelectPR(pr.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-blue-600 hover:underline">
                      <Link href={`/requisitions/${pr.id}`}>{pr.pr_number}</Link>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-gray-900 max-w-xs truncate">
                      {pr.title}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 text-xs">
                      {pr.procurement_type}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-900">
                      {pr.currency} {Number(pr.estimated_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${getStatusBadgeClass(pr.status)}`}>
                        {pr.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">
                      {pr.required_by_date ? new Date(pr.required_by_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/requisitions/${pr.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
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
