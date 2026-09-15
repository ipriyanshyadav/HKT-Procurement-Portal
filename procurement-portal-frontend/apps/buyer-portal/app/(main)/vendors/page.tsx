"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useVendors,
  Vendor,
  useBulkVendorCategoryMapping,
  BulkVendorCategoryMappingResponse,
  getErrorMessage,
} from "@procurement/hooks";

import { VendorStatusBadge, PermissionGuard, Button, TableSkeleton, EmptyState, PageHeader, SearchInput } from "@procurement/ui";
import { ArrowRight, FileSpreadsheet, UploadCloud, CheckCircle2, AlertCircle, X, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";

export default function VendorsListPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const PAGE_SIZE = 20;

  // Bulk mapping modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkVendorCategoryMappingResponse | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const bulkMappingMut = useBulkVendorCategoryMapping();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async () => {
    setBulkError(null);
    setBulkResult(null);

    const lines = csvText.trim().split("\n");
    if (lines.length === 0 || !lines[0].trim()) {
      setBulkError("Please provide CSV data to import.");
      return;
    }

    const mappings = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      if (parts.length < 2) continue;

      if (i === 0 && (parts[0].toLowerCase().includes("vendor") || parts[1].toLowerCase().includes("category"))) {
        continue;
      }

      const [first, second] = parts;
      const isFirstUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(first);

      mappings.push({
        vendor_id: isFirstUuid ? first : undefined,
        vendor_code: !isFirstUuid ? first : undefined,
        category_ids: [second],
      });
    }

    if (mappings.length === 0) {
      setBulkError("No valid rows found. Each line must format as: vendor_code,category_id");
      return;
    }

    try {
      const res = await bulkMappingMut.mutateAsync(mappings);
      setBulkResult(res);
    } catch (err: unknown) {
      setBulkError(getErrorMessage(err, "Failed to bulk map categories"));
    }
  };

  const { data, isLoading, isError, refetch } = useVendors({
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
      <PageHeader
        title="Vendor Management"
        subtitle="Manage vendor lifecycle, qualification, compliance, and scorecards."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/vendors/risk">
              <Button variant="secondary" size="sm" leftIcon={<ShieldAlert className="w-4 h-4 text-amber-500" />}>
                Risk & ESG Dashboard
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsBulkModalOpen(true);
                setBulkResult(null);
                setBulkError(null);
              }}
              leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
            >
              Bulk Map Categories
            </Button>
            <PermissionGuard permission="vendor.invite">
              <Link href="/vendors/invite">
                <Button size="sm">
                  <span aria-hidden="true">+</span> Invite Vendor
                </Button>
              </Link>
            </PermissionGuard>
          </div>
        }
      />

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-80">
          <SearchInput
            placeholder="Search by name, GSTIN, PAN, code, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full"
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
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : isError ? (
          <EmptyState
            icon={<AlertCircle className="w-8 h-8 text-red-500" />}
            title="Failed to load vendors"
            description="Please try again later."
            action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
          />
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={<div className="text-4xl">🏢</div>}
            title="No vendors found"
            description="Try adjusting your search or filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-left text-sm" aria-label="Vendor list">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Vendor Name</th>
                  <th scope="col" className="px-6 py-3.5">Vendor Code</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5">PAN / GSTIN</th>
                  <th scope="col" className="px-6 py-3.5">Contact</th>
                  <th scope="col" className="px-6 py-3.5">Location</th>
                  <th scope="col" className="px-6 py-3.5">Score</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {vendors.map((vendor: Vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
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
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/vendors/${vendor.id}`}>
                          <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
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
          <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between text-sm">
            <span className="text-gray-500 text-xs">
              Page {page} of {totalPages} ({meta?.total_count ?? 0} total vendors)
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Category Mapping Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150" onClick={(e) => { if (e.target === e.currentTarget) setIsBulkModalOpen(false); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-modal-title"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 max-w-xl w-full shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 id="bulk-modal-title" className="text-base font-bold text-gray-900 dark:text-white">
                  Bulk Vendor Category Mapping
                </h3>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                aria-label="Close bulk mapping modal"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Upload a CSV or paste lines mapping vendor codes (or IDs) to procurement category codes (or IDs).
              Format: <code className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-gray-800 dark:text-slate-300 font-mono">vendor_code,category_code</code>
            </p>

            {/* File Upload Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="block w-full text-xs text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/60 cursor-pointer"
              />
            </div>

            {/* Direct CSV Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                  Or Paste CSV Data
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setCsvText(
                      "vendor_code,category_code\nVEND-001,IT-HARDWARE\nVEND-002,OFFICE-SUPPLIES\nVEND-003,CONSULTING-SERVICES"
                    )
                  }
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Insert Sample Data
                </button>
              </div>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"vendor_code,category_code\nVEND-001,IT-HARDWARE\nVEND-002,OFFICE-SUPPLIES"}
                className="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              />
            </div>

            {/* Error Message */}
            {bulkError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{bulkError}</span>
              </div>
            )}

            {/* Success / Execution Results */}
            {bulkResult && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Bulk Mapping Processed Successfully</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center pt-1 font-mono">
                  <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                    <span className="text-gray-400 dark:text-slate-500 block text-[10px]">Total Processed</span>
                    <span className="font-bold text-gray-900 dark:text-white text-sm">{bulkResult.total_processed}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                    <span className="text-emerald-600 dark:text-emerald-400 block text-[10px]">Vendors Updated</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">{bulkResult.updated_vendors}</span>
                  </div>
                </div>

                {bulkResult.errors && bulkResult.errors.length > 0 && (
                  <div className="pt-2 border-t border-emerald-100 dark:border-emerald-800/50 max-h-32 overflow-y-auto space-y-1">
                    <span className="font-semibold text-gray-700 dark:text-slate-300 text-[11px] block">Error Summary:</span>
                    {bulkResult.errors.map((err, i) => (
                      <div key={i} className="text-[11px] text-red-600 dark:text-red-400 font-mono">
                        {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
              <Button
                variant="secondary"
                onClick={() => setIsBulkModalOpen(false)}
              >
                Close
              </Button>
              <Button
                onClick={handleBulkSubmit}
                disabled={bulkMappingMut.isPending || !csvText.trim()}
                leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
              >
                {bulkMappingMut.isPending ? "Importing Mappings..." : "Execute Bulk Import"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
