"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useAnalyticsDashboard,
  useUnmappedPRAnalytics,
  useSpendCube,
  useMaverickSpend,
  useComplianceAuditReports,
  downloadAnalyticsExport,
} from "@procurement/hooks";
import {
  KPICard,
  SpendCubeVisualizer,
  MaverickSpendTable,
  CustomReportBuilder,
  ComplianceReportsView,
} from "@procurement/ui";
import {
  TrendingUp,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Truck,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  PieChart,
  Award,
  Layers,
  BarChart3,
} from "lucide-react";

type AnalyticsTab = "overview" | "spend_cube" | "maverick" | "reports" | "compliance";

export default function BuyerAnalyticsDashboardPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [fiscalYear, setFiscalYear] = useState<string>("2026");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data: dashboard, isLoading, error } = useAnalyticsDashboard({
    fiscal_year: fiscalYear,
  });

  const { data: unmappedData } = useUnmappedPRAnalytics();

  const { data: spendCubeData, isLoading: isSpendCubeLoading } = useSpendCube({
    fiscal_year: fiscalYear,
  });

  const { data: maverickData, isLoading: isMaverickLoading } = useMaverickSpend({
    fiscal_year: fiscalYear,
  });

  const { data: complianceData, isLoading: isComplianceLoading } = useComplianceAuditReports({
    fiscal_year: fiscalYear,
  });

  const kpis = dashboard?.kpis;
  const spend = dashboard?.spend;
  const compliance = dashboard?.compliance;

  const handleExport = async (format: "csv" | "excel") => {
    try {
      setIsExporting(true);
      const rows = [
        {
          Metric: "PR to PO Cycle (Days)",
          Value: kpis?.pr_to_po_cycle_days ?? 0,
        },
        {
          Metric: "Total Realized Savings ($)",
          Value: kpis?.savings_amount ?? 0,
        },
        {
          Metric: "Savings Percentage (%)",
          Value: kpis?.savings_percentage ?? 0,
        },
        {
          Metric: "Vendor Compliance Rate (%)",
          Value: kpis?.vendor_compliance_rate ?? 0,
        },
        {
          Metric: "On-Time Delivery Rate (%)",
          Value: kpis?.on_time_delivery_rate ?? 0,
        },
        {
          Metric: "Invoice Processing (Days)",
          Value: kpis?.invoice_processing_days ?? 0,
        },
        {
          Metric: "Cost of Capital Benefit ($)",
          Value: kpis?.cost_of_capital_benefit ?? 0,
        },
        {
          Metric: "Total Spend ($)",
          Value: spend?.total_spend ?? 0,
        },
      ];

      await downloadAnalyticsExport(format, {
        filename: `executive_analytics_summary_fy${fiscalYear}.${format === "csv" ? "csv" : "xlsx"}`,
        report_type: "kpi_summary",
        data: rows,
        sheet_name: "KPI Summary",
      });
    } catch {
      // Export handled gracefully
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
            Procurement Analytics & Intelligence
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Spend Cube 80/20 Pareto, maverick spend discovery, dynamic reporting, and compliance audit
          </p>
        </div>

        {/* Controls: Fiscal Year filter & Export buttons */}
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

          {activeTab === "overview" && (
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
          )}
        </div>
      </div>

      {/* Subtab Navigation Pills (Apple Design Tokens) */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/50 dark:border-neutral-700/50 max-w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "overview"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Overview & KPIs
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("spend_cube")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "spend_cube"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Spend Cube & Pareto 80/20
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("maverick")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "maverick"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Maverick Spend Discovery
          {maverickData && maverickData.maverick_po_count > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
              {maverickData.maverick_po_count}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "reports"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Custom Report Builder
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("compliance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "compliance"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Compliance Audit Suite
        </button>
      </div>

      {/* Tab 1: Overview & KPIs */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {isLoading && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
                />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 p-4 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
              <span>Failed to load analytics data. Please check your network and permissions.</span>
            </div>
          )}

          {/* Primary KPI Cards */}
          {!isLoading && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <KPICard
                title="PR-to-PO Cycle Time"
                value={kpis?.pr_to_po_cycle_days?.toFixed(1) ?? "0.0"}
                suffix=" days"
                trend={
                  (kpis?.pr_to_po_cycle_days ?? 0) <= 5
                    ? "down"
                    : "up"
                }
                trendGood={false}
                changeLabel="Target: ≤ 5.0 days"
                sparklineData={[7.2, 6.8, 6.1, 5.5, 5.0, kpis?.pr_to_po_cycle_days ?? 4.8]}
                sparklineColor="#3b82f6"
                icon={<Clock className="w-4 h-4 text-blue-500" />}
                subtitle="Req submission to approved PO"
              />

              <KPICard
                title="Realized Savings"
                value={(kpis?.savings_amount ?? 0).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
                prefix="$"
                change={kpis?.savings_percentage}
                changeLabel="vs target benchmark"
                trend="up"
                trendGood={true}
                sparklineData={[12000, 18500, 24000, 31000, 39000, kpis?.savings_amount || 45000]}
                sparklineColor="#10b981"
                icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
                subtitle={`${kpis?.savings_percentage?.toFixed(1) ?? "0.0"}% cost reduction`}
              />

              <KPICard
                title="Vendor Compliance"
                value={kpis?.vendor_compliance_rate?.toFixed(1) ?? "0.0"}
                suffix="%"
                trend={
                  (kpis?.vendor_compliance_rate ?? 0) >= 90
                    ? "up"
                    : "down"
                }
                trendGood={true}
                changeLabel="Target: ≥ 95.0%"
                sparklineData={[88, 89, 91, 93, 92, kpis?.vendor_compliance_rate || 94.5]}
                sparklineColor="#8b5cf6"
                icon={<ShieldCheck className="w-4 h-4 text-purple-500" />}
                subtitle="SLA & delivery adherence"
              />

              <KPICard
                title="On-Time Delivery"
                value={kpis?.on_time_delivery_rate?.toFixed(1) ?? "0.0"}
                suffix="%"
                trend={
                  (kpis?.on_time_delivery_rate ?? 0) >= 90
                    ? "up"
                    : "down"
                }
                trendGood={true}
                changeLabel="Target: ≥ 90.0%"
                sparklineData={[82, 85, 84, 88, 89, kpis?.on_time_delivery_rate || 91.2]}
                sparklineColor="#f59e0b"
                icon={<Truck className="w-4 h-4 text-amber-500" />}
                subtitle="GRN vs promised PO date"
              />
            </div>
          )}

          {/* Secondary Highlights / Working Capital Metrics */}
          {!isLoading && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Working Capital Optimization
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                    ${(kpis?.cost_of_capital_benefit ?? 0).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Cost of capital benefit at {(kpis?.cost_of_capital_rate ?? 8.5)}% annual rate
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500 flex justify-between">
                  <span>Payment terms optimization</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Optimized</span>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Invoice Processing Turnaround
                  </span>
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {kpis?.invoice_processing_days?.toFixed(1) ?? "0.0"} days
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Average receipt-to-payment cycle
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500 flex justify-between">
                  <span>3-Way Auto Match</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Active</span>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Unmapped PR Governance
                  </span>
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {unmappedData?.pending ?? 0} Pending
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {unmappedData?.sla_breach_count ?? 0} SLA breaches | Avg resolution: {unmappedData?.avg_resolution_hours?.toFixed(1) ?? 0}h
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500 flex justify-between">
                  <Link
                    href="/unmapped-prs"
                    className="text-amber-600 hover:text-amber-700 font-medium inline-flex items-center gap-1"
                  >
                    Resolve in Inbox <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Deep Dive Feature Tiles */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Spend Analytics Tile */}
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    <PieChart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900 dark:text-white">
                      Spend Analysis & Category Breakdown
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Detailed spend across categories, business units, and suppliers
                    </p>
                  </div>
                </div>
                <Link
                  href="/analytics/spend"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Explore <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Total Recorded Spend:</span>
                  <span className="font-bold text-neutral-900 dark:text-white">
                    ${(spend?.total_spend ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Active Categories:</span>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    {spend?.by_category?.length ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Participating Vendors:</span>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    {spend?.by_vendor?.length ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Vendor Scorecard Tile */}
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900 dark:text-white">
                      Vendor Scorecards & Rating Tiers
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Evaluate quality, delivery, responsiveness, and tier classifications
                    </p>
                  </div>
                </div>
                <Link
                  href="/analytics/vendors"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400"
                >
                  Compare <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Active Vendors Monitored:</span>
                  <span className="font-bold text-neutral-900 dark:text-white">
                    {compliance?.active_vendors ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Contracts Under Management:</span>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    {compliance?.active_contracts ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Expiring Soon (30d):</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {compliance?.contracts_expiring_soon ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Spend Cube & Pareto 80/20 */}
      {activeTab === "spend_cube" && (
        <SpendCubeVisualizer
          data={spendCubeData}
          isLoading={isSpendCubeLoading}
          currency="$"
        />
      )}

      {/* Tab 3: Maverick Spend Discovery */}
      {activeTab === "maverick" && (
        <MaverickSpendTable
          data={maverickData}
          isLoading={isMaverickLoading}
          currency="$"
        />
      )}

      {/* Tab 4: Custom Report Builder */}
      {activeTab === "reports" && (
        <CustomReportBuilder
          currency="$"
        />
      )}

      {/* Tab 5: Compliance Audit Suite */}
      {activeTab === "compliance" && (
        <ComplianceReportsView
          data={complianceData}
          isLoading={isComplianceLoading}
          currency="$"
        />
      )}
    </div>
  );
}
