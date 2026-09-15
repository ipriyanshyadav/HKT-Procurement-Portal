"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRequisitions,
  useMergeRequisitions,
  useCategories,
  Requisition,
  getErrorMessage,
} from "@procurement/hooks";
import { PermissionGuard, Badge, Button, SearchInput, PageHeader, TableSkeleton, EmptyState, ExportButton } from "@procurement/ui";
import { ArrowRight, FileText, Plus, GitMerge, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "IN_SOURCING", label: "In Sourcing" },
  { value: "CONVERTED", label: "Converted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const SCOPE_OPTIONS = [
  { value: "mine", label: "My Requisitions" },
  { value: "bu", label: "My Business Unit" },
  { value: "all", label: "All Requisitions" },
];

export default function RequisitionsListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [scope, setScope] = useState<"all" | "mine" | "bu">("mine");
  const [search, setSearch] = useState<string>("");
  const [selectedPRs, setSelectedPRs] = useState<string[]>([]);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  const { data, isLoading, isError } = useRequisitions({
    page,
    page_size: PAGE_SIZE,
    status: statusFilter || undefined,
    search: search || undefined,
    scope,
  });

  const { data: categories = [] } = useCategories({ flat: true, active_only: false });

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => {
      map.set(cat.id, cat.name);
    });
    return map;
  }, [categories]);

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
    setMergeError(null);
    try {
      const merged = await mergeMutation.mutateAsync({ pr_ids: selectedPRs });
      setSelectedPRs([]);
      router.push(`/requisitions/${merged.id}`);
    } catch (err: unknown) {
      setMergeError(getErrorMessage(err, "Failed to merge PRs"));
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Merge Error Banner */}
      {mergeError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <span className="shrink-0">⚠️</span>
          <span className="flex-1">{mergeError}</span>
          <button
            type="button"
            onClick={() => setMergeError(null)}
            className="shrink-0 text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Purchase Requisitions"
        subtitle="Create, track, and manage material and service requisition lifecycles."
        actions={
          <>
            {selectedPRs.length >= 2 && (
              <PermissionGuard permission="pr.create">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleMerge}
                  loading={mergeMutation.isPending}
                  leftIcon={<GitMerge className="w-3.5 h-3.5" />}
                >
                  Merge {selectedPRs.length} PRs
                </Button>
              </PermissionGuard>
            )}
            <ExportButton
              exportType="REQUISITIONS"
              filters={{ status: statusFilter || undefined, scope, search: search || undefined }}
            />
            <PermissionGuard permission="pr.create">
              <Link href="/requisitions/new">
                <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                  New Requisition
                </Button>
              </Link>
            </PermissionGuard>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Scope Segmented Control */}
        <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 gap-1">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setScope(opt.value as "all" | "mine" | "bu"); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                scope === opt.value
                  ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-1 sm:justify-end">
          <SearchInput
            placeholder="Search PR number, title..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full sm:w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={8} columns={9} />
      ) : isError ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="Failed to load requisitions"
          description="An error occurred while fetching your requisitions. Please try again."
          action={
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        />
      ) : (
        <div className="apple-table-container">
          <div className="overflow-x-auto">
            <table className="apple-table" aria-label="Purchase Requisitions">
              <thead>
                <tr>
                  <th scope="col" className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={requisitions.length > 0 && selectedPRs.length === requisitions.length}
                      onChange={handleSelectAll}
                      aria-label="Select all requisitions"
                      className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th scope="col">PR Number</th>
                  <th scope="col">Title</th>
                  <th scope="col">Category</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="text-right">Est. Value</th>
                  <th scope="col">Status</th>
                  <th scope="col">Required By</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={<FileText className="w-6 h-6" />}
                        title="No requisitions found"
                        description="No purchase requisitions match your current filters."
                        action={
                          <PermissionGuard permission="pr.create">
                            <Link href="/requisitions/new">
                              <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                                Create Requisition
                              </Button>
                            </Link>
                          </PermissionGuard>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  requisitions.map((pr: Requisition) => (
                    <tr key={pr.id}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={selectedPRs.includes(pr.id)}
                          onChange={() => handleSelectPR(pr.id)}
                          aria-label={`Select requisition ${pr.pr_number}`}
                          className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td>
                        <Link
                          href={`/requisitions/${pr.id}`}
                          className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {pr.pr_number}
                        </Link>
                      </td>
                      <td>
                        <span className="font-medium text-neutral-900 dark:text-neutral-100 line-clamp-1 max-w-xs">
                          {pr.title}
                        </span>
                      </td>
                      <td>
                        <span
                          className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-1 max-w-[150px]"
                          title={categoryMap.get(pr.category_id) || pr.category_name || undefined}
                        >
                          {categoryMap.get(pr.category_id) || pr.category_name || "—"}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {pr.procurement_type}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {pr.currency}{" "}
                          {Number(pr.estimated_value).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td>
                        <Badge variant={pr.status}>{pr.status.replace(/_/g, " ")}</Badge>
                      </td>
                      <td>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {pr.required_by_date
                            ? new Date(pr.required_by_date).toLocaleDateString()
                            : "—"}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link href={`/requisitions/${pr.id}`}>
                          <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                            View
                          </Button>
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
            <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
