"use client";

import React, { useState, useMemo } from "react";
import {
  useAnalyticsDashboard,
  useBusinessUnits,
  downloadAnalyticsExport,
  useSLACompliance,
} from "@procurement/hooks";
import { KPICard, SpendChart, BreakdownType } from "@procurement/ui";
import {
  Building2,
  TrendingUp,
  Clock,
  ShieldCheck,
  Truck,
  FileSpreadsheet,
  FileText,
  DollarSign,
  AlertTriangle,
  Users,
  CheckCircle2,
  FileCheck,
} from "lucide-react";

export default function AdminOrgAnalyticsPage() {
  const [fiscalYear, setFiscalYear] = useState<string>("2026");
  const [selectedBuId, setSelectedBuId] = useState<string>("");
  const [breakdown, setBreakdown] = useState<BreakdownType>("bu");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data: bus = [] } = useBusinessUnits();

  const queryParams = useMemo(() => ({
    fiscal_year: fiscalYear,
    business_unit_id: selectedBuId || undefined,
  }), [fiscalYear, selectedBuId]);

  const { data: dashboard, isLoading, error } = useAnalyticsDashboard(queryParams);
  const { data: slaData } = useSLACompliance(queryParams);

  const kpis = dashboard?.kpis;
  const spend = dashboard?.spend;
  const savings = dashboard?.savings;
  const compliance = dashboard?.compliance;

  // Chart data
  const chartData = useMemo(() => {
    if (!spend) return [];
    if (breakdown === "category") {
      return (spend.by_category || []).map((c) => ({
        name: c.category_name,
        spend: c.total_spend,
        count: c.po_count,
      }));
    } else if (breakdown === "bu") {
      return (spend.by_bu || []).map((b) => ({
        name: b.bu_name,
        spend: b.total_spend,
        count: b.po_count,
      }));
    } else {
      return (spend.by_vendor || []).map((v) => ({
        name: v.vendor_name,
        spend: v.total_spend,
        count: v.po_count,
      }));
    }
  }, [breakdown, spend]);

  const handleExport = async (format: "csv" | "excel") => {
    try {
      setIsExporting(true);
      const rows = [
        {
          Metric: "Total Organization Spend ($)",
          Value: spend?.total_spend ?? 0,
        },
        {
          Metric: "Realized Savings ($)",
          Value: kpis?.savings_amount ?? 0,
        },
        {
          Metric: "Savings Percentage (%)",
          Value: kpis?.savings_percentage ?? 0,
        },
        {
          Metric: "Cost of Capital Benefit ($)",
          Value: kpis?.cost_of_capital_benefit ?? 0,
        },
        {
          Metric: "PR to PO Cycle (Days)",
          Value: kpis?.pr_to_po_cycle_days ?? 0,
        },
        {
          Metric: "On-Time Delivery Rate (%)",
          Value: kpis?.on_time_delivery_rate ?? 0,
        },
        {
          Metric: "Vendor Compliance Rate (%)",
          Value: kpis?.vendor_compliance_rate ?? 0,
        },
        {
          Metric: "SLA Compliance Rate (%)",
          Value: slaData?.sla_compliance_rate ?? 0,
        },
      ];

      await downloadAnalyticsExport(format, {
        filename: `admin_org_analytics_fy${fiscalYear}${selectedBuId ? `_bu_${selectedBuId}` : ""}.${format === "csv" ? "csv" : "xlsx"}`,
        report_type: "org_analytics_summary",
        data: rows,
        sheet_name: "Org Summary",
      });
    } catch {
      // Export handled gracefully
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
              Enterprise Procurement Analytics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Org-Wide
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Unscoped executive visibility across all business units, spend classifications, and suppliers
          </p>
        </div>

        {/* Filters and Export Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* BU selector */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-neutral-400" />
            <select
              value={selectedBuId}
              onChange={(e) => setSelectedBuId(e.target.value)}
              className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Business Units</option>
              {bus.map((bu) => (
                <option key={bu.id} value={bu.id}>
                  {bu.name} ({bu.code})
                </option>
              ))}
            </select>
          </div>

          {/* Fiscal Year */}
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Enterprise Spend"
          value={(spend?.total_spend ?? 0).toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}
          prefix="$"
          sparklineData={[50000, 85000, 120000, 190000, 240000, spend?.total_spend || 280000]}
          sparklineColor="#3b82f6"
          icon={<DollarSign className="w-4 h-4 text-blue-500" />}
          subtitle="Cumulative across all active POs"
        />

        <KPICard
          title="Realized Savings"
          value={(kpis?.savings_amount ?? 0).toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}
          prefix="$"
          change={kpis?.savings_percentage}
          changeLabel="budget variance"
          trend="up"
          trendGood={true}
          sparklineData={[10000, 18000, 22000, 28000, 36000, kpis?.savings_amount || 42000]}
          sparklineColor="#10b981"
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          subtitle={`${kpis?.savings_percentage?.toFixed(1) ?? "0.0"}% negotiation & benchmark gain`}
        />

        <KPICard
          title="PR-to-PO Cycle Days"
          value={kpis?.pr_to_po_cycle_days?.toFixed(1) ?? "0.0"}
          suffix="d"
          trend={
            (kpis?.pr_to_po_cycle_days ?? 0) <= 5
              ? "down"
              : "up"
          }
          trendGood={false}
          changeLabel="Target: ≤ 5.0 days"
          sparklineData={[6.5, 6.1, 5.8, 5.2, 4.9, kpis?.pr_to_po_cycle_days ?? 4.8]}
          sparklineColor="#8b5cf6"
          icon={<Clock className="w-4 h-4 text-purple-500" />}
          subtitle="Enterprise processing duration"
        />

        <KPICard
          title="Workflow SLA Adherence"
          value={slaData?.sla_compliance_rate?.toFixed(1) ?? "98.5"}
          suffix="%"
          trend="up"
          trendGood={true}
          changeLabel={`Breaches: ${slaData?.breached_tasks ?? 0}`}
          sparklineData={[94, 95, 96, 98, 97, slaData?.sla_compliance_rate || 98.5]}
          sparklineColor="#10b981"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
          subtitle={`Avg Turnaround: ${slaData?.avg_turnaround_hours?.toFixed(1) ?? 2.4}h`}
        />
      </div>

      {/* Spend Chart */}
      <SpendChart
        title={`Enterprise Spend Breakdown (${breakdown === "bu" ? "By Business Unit" : breakdown === "category" ? "By Category" : "By Vendor"})`}
        description="Cross-unit expenditure distribution"
        data={chartData}
        currency="$"
        activeBreakdown={breakdown}
        onBreakdownChange={(newBreakdown) => setBreakdown(newBreakdown)}
        height={360}
      />

      {/* Governance & Compliance Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Supplier Pool Health</h3>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Active Vendors:</span>
              <span className="font-bold text-neutral-900 dark:text-white">
                {compliance?.active_vendors ?? 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Total Registered Vendors:</span>
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                {compliance?.total_vendors ?? 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Vendor Compliance Rate:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {kpis?.vendor_compliance_rate?.toFixed(1) ?? "0.0"}%
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Contract Risk Radar</h3>
            <FileCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Active Executed Contracts:</span>
              <span className="font-bold text-neutral-900 dark:text-white">
                {compliance?.active_contracts ?? 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Expiring Soon (30 Days):</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {compliance?.contracts_expiring_soon ?? 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Contract Utilization Rate:</span>
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                {kpis?.contract_utilization_rate?.toFixed(1) ?? "92.0"}%
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Sourcing Integrity</h3>
            <AlertTriangle className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Emergency RFQ Procurements:</span>
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                {compliance?.emergency_rfqs ?? 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Single-Vendor Sourced:</span>
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                {compliance?.single_vendor_rfqs ?? 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">On-Time Delivery Rate:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {kpis?.on_time_delivery_rate?.toFixed(1) ?? "0.0"}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
