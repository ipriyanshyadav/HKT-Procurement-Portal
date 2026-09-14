"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIndentTracking, type IndentTrackingItem } from "@procurement/hooks";
import {
  PermissionGuard,
  Badge,
  Button,
  PageHeader,
  TableSkeleton,
  EmptyState,
} from "@procurement/ui";
import { Plus, ArrowRight, ChevronLeft, ChevronRight, Package } from "lucide-react";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "IN_SOURCING", label: "In Sourcing" },
  { value: "CONVERTED", label: "PO Issued" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const STATUS_BADGE_COLORS: Record<string, string> = {
  SUBMITTED: "blue",
  PENDING_APPROVAL: "yellow",
  APPROVED: "green",
  IN_SOURCING: "purple",
  CONVERTED: "green",
  WITHDRAWN: "gray",
  REJECTED: "red",
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MyIndentsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const PAGE_SIZE = 20;

  const { data, isLoading, isError } = useIndentTracking({
    page,
    page_size: PAGE_SIZE,
    status_filter: statusFilter || undefined,
  });

  const indents = data?.items ?? [];
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? 1;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="My Indents"
        subtitle="Track and manage your procurement requests"
        actions={
          <PermissionGuard permission="indent.create">
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/indents/new")}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Raise New Indent
            </Button>
          </PermissionGuard>
        }
      />

      {/* Status Tabs */}
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`px-3 py-2 text-sm font-medium rounded-t transition-colors ${
              statusFilter === tab.value
                ? "border-b-2 border-amber-500 text-amber-600 dark:text-amber-400"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <div className="text-center py-8 text-red-500 text-sm">
          Failed to load indents. Please try again.
        </div>
      ) : indents.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8 text-neutral-400" />}
          title="No indents yet"
          description="Browse the catalog to raise your first procurement request."
          action={
            <PermissionGuard permission="indent.create">
              <Button variant="primary" onClick={() => router.push("/marketplace")}>
                Browse Catalog
              </Button>
            </PermissionGuard>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
            <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700 text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Indent #</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Value</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Buyer</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">PO Number</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">GRN</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Created</th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                {indents.map((indent: IndentTrackingItem) => (
                  <tr
                    key={indent.pr_id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                      {indent.pr_number}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="line-clamp-1 font-medium text-neutral-800 dark:text-neutral-100">
                        {indent.title}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                      {formatCurrency(indent.estimated_value, indent.currency)}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">
                      {indent.assigned_buyer_name ?? (
                        <span className="italic text-neutral-400">Auto-assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={indent.status.toLowerCase()}>
                        {indent.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                      {indent.po_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {indent.grn_status ? (
                        <Badge variant={indent.grn_status === "CONFIRMED" ? "approved" : "pending"}>
                          {indent.grn_status}
                        </Badge>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-400 whitespace-nowrap">
                      {new Date(indent.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/indents/${indent.pr_id}`}>
                        <Button variant="ghost" size="sm" className="flex items-center gap-1 text-xs">
                          View <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-neutral-500">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, meta?.total ?? 0)} of{" "}
                {meta?.total ?? 0}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span>
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
