"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Download, Loader2, Calendar } from "lucide-react";
import { apiClient } from "@procurement/utils";

export default function AdminTicketReportsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExporting(true);

    try {
      const params: Record<string, string> = { format };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (status) params.status = status;
      if (priority) params.priority = priority;

      const response = await apiClient.get("/tickets/export", {
        params,
        responseType: format === "csv" ? "blob" : "json",
      });

      if (format === "csv") {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `tickets_export_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const jsonStr = JSON.stringify(response.data?.data ?? response.data, null, 2);
        const url = window.URL.createObjectURL(new Blob([jsonStr], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `tickets_export_${new Date().toISOString().split("T")[0]}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tickets</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-blue-600" />
          <span>Ticket Reports &amp; Data Export</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Export ticket audit records, resolution times, and SLA compliance logs for compliance reporting.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <form onSubmit={handleExport} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status Filter
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING_RESPONSE">Pending Response</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority Filter
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Export Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as "csv" | "json")}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="csv">CSV (Spreadsheet)</option>
                <option value="json">JSON (Raw Data)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={isExporting}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export Report</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
