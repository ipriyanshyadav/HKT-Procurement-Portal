"use client";

import React, { useState } from "react";
import {
  useExportJobs,
  useRequestExport,
  useCancelExport,
  useRefreshExportUrl,
  useAppToast,
  type ExportJob,
} from "@procurement/hooks";
import {
  Download,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Trash2,
  Search,
  Filter,
} from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";

const EXPORT_TYPE_LABELS: Record<string, string> = {
  REQUISITIONS: "Requisitions & Indents",
  RFQS: "RFQs & Sourcing",
  BIDS: "Supplier Bids",
  VENDORS: "Vendors & Suppliers",
  CONTRACTS: "Contracts & Agreements",
  PURCHASE_ORDERS: "Purchase Orders",
  GRN: "Goods Receipt Notes (GRN)",
  INVOICES: "Invoices & Billing",
  PAYMENTS: "Payment Records",
  TICKETS: "Support & Helpdesk Tickets",
  AUDIT_TRAIL: "Security Audit Trail",
  ANALYTICS_SPEND: "Spend Analytics",
  ANALYTICS_VENDORS: "Vendor Performance Analytics",
  UNMAPPED_PRS: "Unmapped PR Records",
  WORKFLOW_TASKS: "Approval Workflow Tasks",
  USERS: "Users & Employee Directory",
  API_KEY_USAGE: "API Key Telemetry Log",
};

export function ExportCenterDashboard() {
  const { data: jobs = [], isLoading, refetch } = useExportJobs(50);
  const requestExport = useRequestExport();
  const cancelExport = useCancelExport();
  const refreshUrl = useRefreshExportUrl();
  const { toast } = useAppToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("REQUISITIONS");
  const [selectedFormat, setSelectedFormat] = useState<"CSV" | "EXCEL">("CSV");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const formatBytes = (bytes: number | null) => {
    if (!bytes || bytes === 0) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getExpiresCountdown = (expiresAt: string | null) => {
    if (!expiresAt) return "—";
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return "Expired";
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h left`;
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m left`;
  };

  const handleCreateExport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestExport.mutateAsync({
        export_type: selectedType,
        format: selectedFormat,
      });
      toast.success(
        "Export Job Queued",
        `Export for ${EXPORT_TYPE_LABELS[selectedType] || selectedType} queued in background.`
      );
      setNewModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to queue export.";
      toast.error("Export Error", msg);
    }
  };

  const handleDownload = async (job: ExportJob) => {
    setDownloadingId(job.id);
    try {
      let downloadUrl = job.presigned_url;
      if (!downloadUrl) {
        const refreshed = await refreshUrl.mutateAsync(job.id);
        downloadUrl = refreshed.presigned_url;
      }
      if (downloadUrl) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = `/api/v1/exports/${job.id}/download`;
      }
      toast.success("Download Started", "Your file is downloading.");
    } catch {
      window.location.href = `/api/v1/exports/${job.id}/download`;
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await cancelExport.mutateAsync(jobId);
      toast.success("Export Cancelled", "Job removed successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel export.";
      toast.error("Cancel Failed", msg);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.export_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (EXPORT_TYPE_LABELS[job.export_type] || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Export Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            Asynchronous background exports across all procurement entities with 7-day retention.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setNewModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Export</span>
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search exports by type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            {["ALL", "COMPLETED", "PROCESSING", "QUEUED", "FAILED"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors shrink-0 ${
                  statusFilter === s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Export Jobs Listing */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Download className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800">No export jobs found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {jobs.length === 0
                ? "You haven't requested any exports yet. Click 'New Export' above to export tabular data."
                : "No exports match the selected filter criteria."}
            </p>
            {jobs.length === 0 && (
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setNewModalOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Request First Export
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3">Entity / Type</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Rows</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Retention</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredJobs.map((job) => {
                  const label = EXPORT_TYPE_LABELS[job.export_type] || job.export_type;
                  const isProcessing = job.status === "PROCESSING" || job.status === "QUEUED";
                  const isCompleted = job.status === "COMPLETED";

                  return (
                    <tr key={job.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            {job.format === "EXCEL" ? (
                              <FileSpreadsheet className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{label}</div>
                            <div className="text-xs text-gray-400">
                              Requested {new Date(job.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {job.format}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {job.status === "COMPLETED" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            Completed
                          </span>
                        )}
                        {job.status === "PROCESSING" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            Processing
                          </span>
                        )}
                        {job.status === "QUEUED" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            Queued
                          </span>
                        )}
                        {job.status === "FAILED" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            Failed
                          </span>
                        )}
                        {job.status === "EXPIRED" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                            <XCircle className="w-3.5 h-3.5 text-gray-400" />
                            Expired
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-gray-700 font-medium">
                        {job.total_rows !== null ? job.total_rows.toLocaleString() : "—"}
                      </td>

                      <td className="px-4 py-4 text-gray-500">{formatBytes(job.file_size_bytes)}</td>

                      <td className="px-4 py-4 text-xs text-gray-500">
                        {getExpiresCountdown(job.expires_at)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleDownload(job)}
                              disabled={downloadingId === job.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              {downloadingId === job.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              <span>Download</span>
                            </button>
                          )}

                          {isProcessing && (
                            <button
                              type="button"
                              onClick={() => handleCancel(job.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New Export Modal */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Request Data Export</h2>
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateExport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Select Entity / Report
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {Object.entries(EXPORT_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedFormat("CSV")}
                    className={`flex items-center gap-2 p-3 border rounded-lg text-left transition-colors ${
                      selectedFormat === "CSV"
                        ? "border-blue-600 bg-blue-50/50 text-blue-900 font-semibold"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-sm">CSV</div>
                      <div className="text-[11px] text-gray-500 font-normal">.csv plain text</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFormat("EXCEL")}
                    className={`flex items-center gap-2 p-3 border rounded-lg text-left transition-colors ${
                      selectedFormat === "EXCEL"
                        ? "border-blue-600 bg-blue-50/50 text-blue-900 font-semibold"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-sm">Excel</div>
                      <div className="text-[11px] text-gray-500 font-normal">.xlsx workbook</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Exports run asynchronously in a dedicated worker queue. Completed files are retained for 7
                  days.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={requestExport.isPending}
                  className="flex items-center gap-1.5"
                >
                  {requestExport.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{requestExport.isPending ? "Queuing..." : "Queue Export"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
