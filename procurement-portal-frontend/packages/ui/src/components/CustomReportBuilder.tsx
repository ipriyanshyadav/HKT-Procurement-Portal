"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Play,
  Plus,
  Trash2,
  Filter,
  Layers,
  BarChart2,
  ArrowUpDown,
  Download,
  CheckCircle2,
} from "lucide-react";
import {
  useExecuteCustomReport,
  CustomReportRequest,
  CustomReportFilter,
  CustomReportData,
  downloadAnalyticsExport,
} from "@procurement/hooks";

export interface CustomReportBuilderProps {
  currency?: string;
  className?: string;
}

const AVAILABLE_DIMENSIONS = [
  { id: "category_name", label: "Category" },
  { id: "bu_name", label: "Business Unit" },
  { id: "vendor_name", label: "Supplier" },
  { id: "spend_type", label: "Spend Type (CAPEX / OPEX)" },
  { id: "month", label: "Month (YYYY-MM)" },
  { id: "quarter", label: "Quarter (YYYY-QX)" },
  { id: "year", label: "Year (YYYY)" },
  { id: "status", label: "PO Status" },
];

const AVAILABLE_METRICS = [
  { id: "total_po_value", label: "Total PO Value ($)" },
  { id: "po_count", label: "PO Count" },
  { id: "avg_po_value", label: "Avg PO Value ($)" },
  { id: "line_count", label: "Line Items Count" },
  { id: "vendor_count", label: "Distinct Suppliers" },
];

const FILTERABLE_FIELDS = [
  { id: "status", label: "Status" },
  { id: "year", label: "Year" },
  { id: "month", label: "Month" },
  { id: "spend_type", label: "Spend Type (CAPEX/OPEX)" },
];

const OPERATORS = [
  { id: "eq", label: "Equals (=)" },
  { id: "neq", label: "Not Equals (!=)" },
  { id: "gt", label: "Greater Than (>)" },
  { id: "gte", label: "Greater or Equal (>=)" },
  { id: "lt", label: "Less Than (<)" },
  { id: "lte", label: "Less or Equal (<=)" },
  { id: "like", label: "Contains (LIKE)" },
];

export function CustomReportBuilder({
  currency = "₹",
  className = "",
}: CustomReportBuilderProps) {
  const [reportName, setReportName] = useState<string>("Executive S2P Spend Report");
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([
    "category_name",
    "bu_name",
  ]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "total_po_value",
    "po_count",
    "avg_po_value",
  ]);
  const [filters, setFilters] = useState<CustomReportFilter[]>([]);
  const [sortField, setSortField] = useState<string>("total_po_value");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [reportResult, setReportResult] = useState<CustomReportData | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const executeMutation = useExecuteCustomReport();

  const toggleDimension = (id: string) => {
    setSelectedDimensions((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Keep at least 1
        return prev.filter((d) => d !== id);
      }
      return [...prev, id];
    });
  };

  const toggleMetric = (id: string) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Keep at least 1
        return prev.filter((m) => m !== id);
      }
      return [...prev, id];
    });
  };

  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      { field: "status", operator: "eq", value: "APPROVED" },
    ]);
  };

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, key: keyof CustomReportFilter, val: any) => {
    setFilters((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  const handleExecute = async () => {
    const payload: CustomReportRequest = {
      name: reportName,
      dimensions: selectedDimensions,
      metrics: selectedMetrics,
      filters: filters.length > 0 ? filters : undefined,
      sort: [{ field: sortField, direction: sortDirection }],
      page,
      page_size: pageSize,
    };

    const res = await executeMutation.mutateAsync(payload);
    setReportResult(res);
  };

  const handleExport = async (format: "csv" | "excel") => {
    if (!reportResult || !reportResult.data.length) return;
    try {
      setIsExporting(true);
      await downloadAnalyticsExport(format, {
        filename: `${reportName.toLowerCase().replace(/\s+/g, "_")}.${format === "csv" ? "csv" : "xlsx"}`,
        data: reportResult.data,
        report_type: "custom_report",
        sheet_name: "Report Data",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatCellValue = (header: string, val: any) => {
    if (val === null || val === undefined) return "—";
    if (header.includes("value") || header.includes("spend")) {
      const num = Number(val) || 0;
      if (num >= 10_000_000) return `${currency}${(num / 10_000_000).toFixed(2)}Cr`;
      if (num >= 100_000) return `${currency}${(num / 100_000).toFixed(1)}L`;
      return `${currency}${num.toLocaleString()}`;
    }
    if (typeof val === "number") {
      return val.toLocaleString();
    }
    return String(val);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Query Configuration Studio */}
      <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-white">Custom Report Query Builder</h3>
            <p className="text-xs text-neutral-400">
              Select dynamic dimensions, multi-metric aggregations, filter predicates, and export formats
            </p>
          </div>

          <div className="w-72">
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Report Title"
              className="w-full rounded-xl border border-white/10 bg-[#252529] px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Section 1: Dimensions */}
        <div className="mt-5 space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <Layers className="h-3.5 w-3.5 text-blue-400" />
            1. Group By Dimensions (Select 1 or more)
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {AVAILABLE_DIMENSIONS.map((dim) => {
              const isSelected = selectedDimensions.includes(dim.id);
              return (
                <button
                  key={dim.id}
                  onClick={() => toggleDimension(dim.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "border border-blue-500/40 bg-blue-500/20 text-blue-300 shadow-sm"
                      : "border border-white/10 bg-[#252529] text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {dim.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Metrics */}
        <div className="mt-5 space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <BarChart2 className="h-3.5 w-3.5 text-emerald-400" />
            2. Aggregate Metrics (Select 1 or more)
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {AVAILABLE_METRICS.map((met) => {
              const isSelected = selectedMetrics.includes(met.id);
              return (
                <button
                  key={met.id}
                  onClick={() => toggleMetric(met.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-sm"
                      : "border border-white/10 bg-[#252529] text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {met.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Filters */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <Filter className="h-3.5 w-3.5 text-amber-400" />
              3. Filter Predicates (Optional)
            </label>
            <button
              onClick={addFilter}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Filter
            </button>
          </div>

          {filters.length === 0 ? (
            <p className="text-xs text-neutral-500 italic">No filters configured. Full tenant data will be aggregated.</p>
          ) : (
            <div className="space-y-2">
              {filters.map((flt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={flt.field}
                    onChange={(e) => updateFilter(idx, "field", e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#252529] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    {FILTERABLE_FIELDS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={flt.operator}
                    onChange={(e) => updateFilter(idx, "operator", e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#252529] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={flt.value}
                    onChange={(e) => updateFilter(idx, "value", e.target.value)}
                    placeholder="Value"
                    className="w-44 rounded-xl border border-white/10 bg-[#252529] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />

                  <button
                    onClick={() => removeFilter(idx)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>Sort by:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#252529] px-3 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              {[...selectedMetrics, ...selectedDimensions].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value as "asc" | "desc")}
              className="rounded-xl border border-white/10 bg-[#252529] px-3 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          <button
            onClick={handleExecute}
            disabled={executeMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {executeMutation.isPending ? "Executing Query..." : "Run Report"}
          </button>
        </div>
      </div>

      {/* Results Table */}
      {reportResult && (
        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-white">{reportResult.name}</h3>
              <p className="text-xs text-neutral-400">
                Returned {reportResult.total_records} aggregated records
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport("csv")}
                disabled={isExporting}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#252529] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                Download CSV
              </button>
              <button
                onClick={() => handleExport("excel")}
                disabled={isExporting}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#252529] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
              >
                <FileText className="h-3.5 w-3.5 text-blue-400" />
                Download Excel (XLSX)
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
                <tr>
                  {[...reportResult.dimensions, ...reportResult.metrics].map((col) => (
                    <th key={col} className="px-4 py-3">
                      {col.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {reportResult.data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5">
                    {[...reportResult.dimensions, ...reportResult.metrics].map((col) => (
                      <td key={col} className="px-4 py-3 text-neutral-200">
                        {formatCellValue(col, row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
