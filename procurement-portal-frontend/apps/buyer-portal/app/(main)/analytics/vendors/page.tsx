"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useVendorPerformance,
  downloadAnalyticsExport,
  VendorScorecardItem,
} from "@procurement/hooks";
import {
  ArrowLeft,
  Search,
  FileSpreadsheet,
  FileText,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

export default function VendorScorecardAnalyticsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data: vendorData, isLoading, error } = useVendorPerformance();

  const vendors: VendorScorecardItem[] = useMemo(() => {
    if (!vendorData) return [];
    if (Array.isArray(vendorData)) return vendorData;
    return [vendorData];
  }, [vendorData]);

  // Filtering
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const matchesSearch =
        (v.vendor_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.vendor_code || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTier =
        tierFilter === "ALL" || v.performance_tier === tierFilter;
      return matchesSearch && matchesTier;
    });
  }, [vendors, searchTerm, tierFilter]);

  // Tier counts
  const tierCounts = useMemo(() => {
    const preferred = vendors.filter((v) => v.performance_tier === "PREFERRED").length;
    const acceptable = vendors.filter((v) => v.performance_tier === "ACCEPTABLE").length;
    const atRisk = vendors.filter((v) => v.performance_tier === "AT_RISK").length;
    return { preferred, acceptable, atRisk, total: vendors.length };
  }, [vendors]);

  const handleExport = async (format: "csv" | "excel") => {
    try {
      setIsExporting(true);
      const rows = filteredVendors.map((v) => ({
        "Vendor Code": v.vendor_code,
        "Vendor Name": v.vendor_name,
        "Total POs": v.total_pos,
        "Composite Score": v.composite_score,
        "Performance Tier": v.performance_tier,
        "Quality Score": v.avg_quality,
        "On-Time Delivery Score": v.avg_delivery,
        "Pricing & Commercial Score": v.avg_price,
        "Responsiveness Score": v.avg_responsiveness,
        "Compliance Score": v.avg_compliance,
      }));

      await downloadAnalyticsExport(format, {
        filename: `vendor_scorecard_comparison.${format === "csv" ? "csv" : "xlsx"}`,
        report_type: "vendor_performance",
        data: rows,
        sheet_name: "Vendor Scorecards",
      });
    } catch {
      // Handled
    } finally {
      setIsExporting(false);
    }
  };

  const renderTierBadge = (tier: string) => {
    switch (tier) {
      case "PREFERRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Preferred
          </span>
        );
      case "ACCEPTABLE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Acceptable
          </span>
        );
      case "AT_RISK":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            At Risk
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
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
              Vendor Scorecards & Rating Tiers
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Comparative vendor performance evaluation based on quality, delivery, and SLA compliance
            </p>
          </div>

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

      {/* Tier Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div
          onClick={() => setTierFilter("ALL")}
          className={`cursor-pointer rounded-2xl border p-5 transition-all ${
            tierFilter === "ALL"
              ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800/80 shadow-sm"
              : "border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900"
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Total Rated Vendors
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {tierCounts.total}
          </div>
          <p className="mt-1 text-xs text-neutral-400">All participating suppliers</p>
        </div>

        <div
          onClick={() => setTierFilter("PREFERRED")}
          className={`cursor-pointer rounded-2xl border p-5 transition-all ${
            tierFilter === "PREFERRED"
              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm"
              : "border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900"
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Preferred (≥ 85)
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {tierCounts.preferred}
          </div>
          <p className="mt-1 text-xs text-neutral-400">Top-tier SLA delivery</p>
        </div>

        <div
          onClick={() => setTierFilter("ACCEPTABLE")}
          className={`cursor-pointer rounded-2xl border p-5 transition-all ${
            tierFilter === "ACCEPTABLE"
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-sm"
              : "border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900"
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Acceptable (70 - 84)
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {tierCounts.acceptable}
          </div>
          <p className="mt-1 text-xs text-neutral-400">Standard compliance</p>
        </div>

        <div
          onClick={() => setTierFilter("AT_RISK")}
          className={`cursor-pointer rounded-2xl border p-5 transition-all ${
            tierFilter === "AT_RISK"
              ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 shadow-sm"
              : "border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900"
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            At Risk (&lt; 70)
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {tierCounts.atRisk}
          </div>
          <p className="mt-1 text-xs text-neutral-400">Action or audit needed</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search vendor name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-medium text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Showing:</span>
          <span className="text-xs font-semibold text-neutral-900 dark:text-white">
            {filteredVendors.length} of {vendors.length} vendors
          </span>
        </div>
      </div>

      {/* Scorecards Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 uppercase font-semibold">
                <th className="py-3.5 px-4">Vendor</th>
                <th className="py-3.5 px-4 text-center">Tier</th>
                <th className="py-3.5 px-4 text-right">Composite Score</th>
                <th className="py-3.5 px-4 text-right">Quality</th>
                <th className="py-3.5 px-4 text-right">On-Time</th>
                <th className="py-3.5 px-4 text-right">Commercial</th>
                <th className="py-3.5 px-4 text-right">Response</th>
                <th className="py-3.5 px-4 text-right">Total POs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-400">
                    Loading vendor performance data...
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-400">
                    No vendor scorecards match your criteria.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((v) => (
                  <tr
                    key={v.vendor_id || v.vendor_code}
                    className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium text-neutral-900 dark:text-white">
                      <Link
                        href={`/vendors/${v.vendor_id}`}
                        className="hover:text-blue-600 transition-colors font-semibold"
                      >
                        {v.vendor_name}
                      </Link>
                      <span className="block text-[11px] text-neutral-400 font-normal">
                        {v.vendor_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {renderTierBadge(v.performance_tier)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-neutral-900 dark:text-white">
                      <span
                        className={`text-sm ${
                          v.composite_score >= 85
                            ? "text-emerald-600 dark:text-emerald-400"
                            : v.composite_score >= 70
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {v.composite_score?.toFixed(1) ?? "0.0"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-neutral-600 dark:text-neutral-300">
                      {v.avg_quality?.toFixed(1) ?? "0.0"}%
                    </td>
                    <td className="py-3.5 px-4 text-right text-neutral-600 dark:text-neutral-300">
                      {v.avg_delivery?.toFixed(1) ?? "0.0"}%
                    </td>
                    <td className="py-3.5 px-4 text-right text-neutral-600 dark:text-neutral-300">
                      {v.avg_price?.toFixed(1) ?? "0.0"}%
                    </td>
                    <td className="py-3.5 px-4 text-right text-neutral-600 dark:text-neutral-300">
                      {v.avg_responsiveness?.toFixed(1) ?? "0.0"}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-neutral-900 dark:text-white">
                      {v.total_pos}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
