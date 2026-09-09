"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useVendors,
  Vendor,
  useBulkVendorCategoryMapping,
  BulkVendorCategoryMappingResponse,
} from "@procurement/hooks";
import { VendorStatusBadge, PermissionGuard, Button } from "@procurement/ui";
import { ArrowRight, FileSpreadsheet, UploadCloud, CheckCircle2, AlertCircle, X, ShieldAlert } from "lucide-react";

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
    } catch (err: any) {
      setBulkError(err?.response?.data?.error?.message || "Failed to process bulk category mapping");
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendor Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage vendor lifecycle, qualification, compliance, and scorecards.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/vendors/risk"
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#1C1C1F] hover:bg-slate-50 dark:hover:bg-[#252529] text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Risk & ESG Dashboard</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsBulkModalOpen(true);
              setBulkResult(null);
              setBulkError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 dark:hover:bg-slate-800/50 text-gray-700 text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Bulk Map Categories</span>
          </button>
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
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
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
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-left text-sm">
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
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white">
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
          <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between text-sm">
            <span className="text-gray-500 text-xs">
              Page {page} of {totalPages} ({meta?.total_count ?? 0} total vendors)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Category Mapping Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-xl w-full shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-gray-900">
                  Bulk Vendor Category Mapping
                </h3>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Upload a CSV or paste lines mapping vendor codes (or IDs) to procurement category codes (or IDs).
              Format: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 font-mono">vendor_code,category_code</code>
            </p>

            {/* File Upload Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>

            {/* Direct CSV Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Or Paste CSV Data
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setCsvText(
                      "vendor_code,category_code\nVEND-001,IT-HARDWARE\nVEND-002,OFFICE-SUPPLIES\nVEND-003,CONSULTING-SERVICES"
                    )
                  }
                  className="text-[11px] text-blue-600 hover:underline font-medium"
                >
                  Insert Sample Data
                </button>
              </div>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="vendor_code,category_code&#10;VEND-001,IT-HARDWARE&#10;VEND-002,OFFICE-SUPPLIES"
                className="w-full p-3 rounded-xl border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              />
            </div>

            {/* Error Message */}
            {bulkError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{bulkError}</span>
              </div>
            )}

            {/* Success / Execution Results */}
            {bulkResult && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Bulk Mapping Processed Successfully</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center pt-1 font-mono">
                  <div className="bg-white p-2 rounded-lg border border-emerald-100">
                    <span className="text-gray-400 block text-[10px]">Total Processed</span>
                    <span className="font-bold text-gray-900 text-sm">{bulkResult.total_processed}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-100">
                    <span className="text-emerald-600 block text-[10px]">Vendors Updated</span>
                    <span className="font-bold text-emerald-700 text-sm">{bulkResult.updated_vendors}</span>
                  </div>
                </div>

                {bulkResult.errors && bulkResult.errors.length > 0 && (
                  <div className="pt-2 border-t border-emerald-100 max-h-32 overflow-y-auto space-y-1">
                    <span className="font-semibold text-gray-700 text-[11px] block">Error Summary:</span>
                    {bulkResult.errors.map((err, i) => (
                      <div key={i} className="text-[11px] text-red-600 font-mono">
                        {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={bulkMappingMut.isPending || !csvText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                {bulkMappingMut.isPending ? "Importing Mappings..." : "Execute Bulk Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
