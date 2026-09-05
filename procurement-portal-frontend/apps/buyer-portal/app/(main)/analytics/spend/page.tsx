"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useAllSpend,
  downloadAnalyticsExport,
  SpendCategoryItem,
  SpendVendorItem,
  SpendBUItem,
} from "@procurement/hooks";
import { SpendChart, BreakdownType } from "@procurement/ui";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingUp,
  Building2,
  Users,
  Layers,
  Filter,
} from "lucide-react";

const PIE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#6366f1",
  "#f97316",
];

export default function SpendAnalyticsPage() {
  const [fiscalYear, setFiscalYear] = useState<string>("2026");
  const [breakdown, setBreakdown] = useState<BreakdownType>("category");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data: spendData, isLoading, error } = useAllSpend({
    fiscal_year: fiscalYear,
  });

  const categories = spendData?.by_category || [];
  const vendors = spendData?.by_vendor || [];
  const bus = spendData?.by_bu || [];
  const totalSpend = spendData?.total_spend || 0;

  // Prepare chart data based on active breakdown
  const chartData = useMemo(() => {
    if (breakdown === "category") {
      return categories.map((c) => ({
        name: c.category_name,
        spend: c.total_spend,
        count: c.po_count,
      }));
    } else if (breakdown === "bu") {
      return bus.map((b) => ({
        name: b.bu_name,
        spend: b.total_spend,
        count: b.po_count,
      }));
    } else {
      return vendors.map((v) => ({
        name: v.vendor_name,
        spend: v.total_spend,
        count: v.po_count,
      }));
    }
  }, [breakdown, categories, bus, vendors]);

  // BU Pie Chart data
  const buPieData = useMemo(() => {
    return bus.map((b) => ({
      name: b.bu_name,
      value: b.total_spend,
    }));
  }, [bus]);

  // Top 5 Vendors
  const topVendors = useMemo(() => {
    return [...vendors]
      .sort((a, b) => b.total_spend - a.total_spend)
      .slice(0, 5);
  }, [vendors]);

  const handleExport = async (format: "csv" | "excel") => {
    try {
      setIsExporting(true);
      let exportRows: any[] = [];
      let sheetName = "Spend Analysis";

      if (breakdown === "category") {
        sheetName = "Category Spend";
        exportRows = categories.map((c) => ({
          Category: c.category_name,
          "Total Spend ($)": c.total_spend,
          "PO Count": c.po_count,
        }));
      } else if (breakdown === "bu") {
        sheetName = "BU Spend";
        exportRows = bus.map((b) => ({
          "Business Unit": b.bu_name,
          Code: b.bu_code,
          "Total Spend ($)": b.total_spend,
          "PO Count": b.po_count,
        }));
      } else {
        sheetName = "Vendor Spend";
        exportRows = vendors.map((v) => ({
          Vendor: v.vendor_name,
          Code: v.vendor_code,
          "Total Spend ($)": v.total_spend,
          "PO Count": v.po_count,
        }));
      }

      await downloadAnalyticsExport(format, {
        filename: `spend_breakdown_${breakdown}_fy${fiscalYear}.${format === "csv" ? "csv" : "xlsx"}`,
        report_type: `spend_${breakdown}`,
        data: exportRows,
        sheet_name: sheetName,
      });
    } catch {
      // Export handled gracefully
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Back Link & Header */}
      <div>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Analytics Overview
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
              Spend Breakdown & Insights
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Analyze organizational expenditure by Category, Business Unit, and Vendor
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="2026">FY 2026</option>
              <option value="2025">FY 2025</option>
              <option value="2024">FY 2024</option>
            </select>

            <div className="inline-flex rounded-xl shadow-sm">
              <button
                type="button"
                disabled={isExporting || isLoading}
                onClick={() => handleExport("csv")}
                className="inline-flex items-center gap-1.5 rounded-l-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                CSV
              </button>
              <button
                type="button"
                disabled={isExporting || isLoading}
                onClick={() => handleExport("excel")}
                className="inline-flex items-center gap-1.5 rounded-r-xl border border-l-0 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-5 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Spend</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <p className="mt-1 text-xs text-neutral-400">Active fiscal year</p>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-5 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Categories</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {categories.length}
          </div>
          <p className="mt-1 text-xs text-neutral-400">Spend classifications</p>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-5 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Business Units</span>
            <Building2 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {bus.length}
          </div>
          <p className="mt-1 text-xs text-neutral-400">Cost-allocating units</p>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-5 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Suppliers</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {vendors.length}
          </div>
          <p className="mt-1 text-xs text-neutral-400">Awarded purchase orders</p>
        </div>
      </div>

      {/* Main Bar Chart with Breakdown Switching */}
      <SpendChart
        title={`Spend Breakdown (${breakdown === "category" ? "By Category" : breakdown === "bu" ? "By Business Unit" : "By Vendor"})`}
        description={`Interactive expenditure visualizer for FY ${fiscalYear}`}
        data={chartData}
        currency="$"
        activeBreakdown={breakdown}
        onBreakdownChange={(newBreakdown) => setBreakdown(newBreakdown)}
        height={360}
      />

      {/* Distribution & Top Spender Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* BU Spend Distribution (Pie) */}
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm">
          <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
            Business Unit Spend Distribution
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Percentage allocation across organizational divisions
          </p>

          {buPieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-neutral-400">
              No business unit data available
            </div>
          ) : (
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={buPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {buPieData.map((_, index) => (
                      <Cell
                        key={`pie-cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: any) =>
                      `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    }
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top 5 Suppliers Table */}
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
                  Top 5 Suppliers by Spend
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Highest volume vendors in the current fiscal period
                </p>
              </div>
              <Link
                href="/analytics/vendors"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                View all vendors
              </Link>
            </div>

            {topVendors.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-neutral-400">
                No vendor spend recorded
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 uppercase font-semibold">
                      <th className="pb-3">Vendor</th>
                      <th className="pb-3 text-right">Orders</th>
                      <th className="pb-3 text-right">Spend</th>
                      <th className="pb-3 text-right">% Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {topVendors.map((v, i) => {
                      const share = totalSpend > 0 ? ((v.total_spend / totalSpend) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={v.vendor_id || i} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="py-3 font-medium text-neutral-900 dark:text-white">
                            {v.vendor_name}
                            <span className="block text-[11px] text-neutral-400 font-normal">
                              {v.vendor_code}
                            </span>
                          </td>
                          <td className="py-3 text-right text-neutral-600 dark:text-neutral-300">
                            {v.po_count}
                          </td>
                          <td className="py-3 text-right font-semibold text-neutral-900 dark:text-white">
                            ${v.total_spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 text-right text-neutral-500 dark:text-neutral-400">
                            {share}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
