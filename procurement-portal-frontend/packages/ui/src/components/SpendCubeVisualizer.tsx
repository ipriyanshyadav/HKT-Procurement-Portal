"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  PieChart as PieChartIcon,
  Layers,
  Building2,
  Users,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import {
  SpendCubeData,
  SpendCubeCategoryItem,
  SpendCubeBUItem,
  ParetoVendorItem,
} from "@procurement/hooks";

export type SpendCubeTab = "category" | "bu" | "pareto" | "capex_opex";

export interface SpendCubeVisualizerProps {
  data?: SpendCubeData;
  isLoading?: boolean;
  currency?: string;
  className?: string;
}

const PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#6366f1",
  "#f97316",
  "#14b8a6",
  "#a855f7",
];

export function SpendCubeVisualizer({
  data,
  isLoading = false,
  currency = "₹",
  className = "",
}: SpendCubeVisualizerProps) {
  const [activeTab, setActiveTab] = useState<SpendCubeTab>("category");
  const [vendorFilter, setVendorFilter] = useState<string>("");

  const formatCurrency = (val: number) => {
    if (val >= 10_000_000) {
      return `${currency}${(val / 10_000_000).toFixed(2)}Cr`;
    }
    if (val >= 100_000) {
      return `${currency}${(val / 100_000).toFixed(1)}L`;
    }
    if (val >= 1_000) {
      return `${currency}${(val / 1_000).toFixed(1)}k`;
    }
    return `${currency}${val.toLocaleString()}`;
  };

  const categories = data?.by_category || [];
  const bus = data?.by_bu || [];
  const paretoVendors = data?.pareto_vendors || [];
  const paretoSummary = data?.pareto_summary;
  const totalSpend = data?.total_spend || 0;
  const capexSpend = data?.capex_spend || 0;
  const opexSpend = data?.opex_spend || 0;
  const capexPct = data?.capex_percentage || 0;
  const opexPct = data?.opex_percentage || 0;

  // Filtered pareto vendors
  const filteredVendors = useMemo(() => {
    if (!vendorFilter.trim()) return paretoVendors;
    const term = vendorFilter.toLowerCase();
    return paretoVendors.filter(
      (v) =>
        v.vendor_name.toLowerCase().includes(term) ||
        v.vendor_code.toLowerCase().includes(term)
    );
  }, [paretoVendors, vendorFilter]);

  if (isLoading) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-[#1C1C1F] p-8 shadow-sm ${className}`}>
        <div className="flex h-72 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="text-sm font-medium text-neutral-400">Loading Spend Cube Multi-Dimensional Data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Summary Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Total Spend</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">{formatCurrency(totalSpend)}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Full period aggregated procurement</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">CAPEX vs OPEX</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">{capexPct}%</span>
            <span className="text-xs text-neutral-400">CAPEX / {opexPct}% OPEX</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-purple-500" style={{ width: `${capexPct}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Pareto 80/20 Top Tier</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">
              {paretoSummary?.top_vendors_count || 0}
            </span>
            <span className="ml-2 text-xs text-neutral-400">
              suppliers ({paretoSummary?.top_vendors_spend_pct || 0}% spend)
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Key strategic supplier base</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Long Tail Suppliers</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-white">
              {paretoSummary?.tail_vendors_count || 0}
            </span>
            <span className="ml-2 text-xs text-neutral-400">
              suppliers ({paretoSummary?.tail_vendors_spend_pct || 0}% spend)
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Consolidation opportunity</p>
        </div>
      </div>

      {/* Slicing Controls & Dimension Tabs */}
      <div className="rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">Interactive Spend Cube</h3>
            <p className="text-xs text-neutral-400">Multi-dimensional slicing by Category, Business Unit, Pareto 80/20, and Expense Nature</p>
          </div>

          {/* Dimension Selector Tabs */}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#252529] p-1">
            <button
              onClick={() => setActiveTab("category")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "category"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Category
            </button>
            <button
              onClick={() => setActiveTab("bu")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "bu"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Business Unit
            </button>
            <button
              onClick={() => setActiveTab("pareto")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "pareto"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Supplier Pareto (80/20)
            </button>
            <button
              onClick={() => setActiveTab("capex_opex")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "capex_opex"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Percent className="h-3.5 w-3.5" />
              CAPEX vs OPEX
            </button>
          </div>
        </div>

        {/* Tab 1: Category Slicing */}
        {activeTab === "category" && (
          <div className="mt-6 space-y-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E34" vertical={false} />
                  <XAxis dataKey="category_name" stroke="#8E8E93" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#8E8E93"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => formatCurrency(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1C1C1F",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                    formatter={(val: any) => [formatCurrency(Number(val) || 0), "Total Spend"]}
                  />
                  <Bar dataKey="total_spend" radius={[6, 6, 0, 0]}>
                    {categories.map((_, idx) => (
                      <Cell key={`cat-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabular Drilldown */}
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">POs</th>
                    <th className="px-4 py-3">Total Spend</th>
                    <th className="px-4 py-3">CAPEX</th>
                    <th className="px-4 py-3">OPEX</th>
                    <th className="px-4 py-3">Share (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {categories.map((c) => (
                    <tr key={c.category_name} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-sans font-medium text-white">{c.category_name}</td>
                      <td className="px-4 py-3 text-neutral-300">{c.po_count}</td>
                      <td className="px-4 py-3 font-bold text-blue-400">{formatCurrency(c.total_spend)}</td>
                      <td className="px-4 py-3 text-purple-400">{formatCurrency(c.capex_spend)}</td>
                      <td className="px-4 py-3 text-neutral-300">{formatCurrency(c.opex_spend)}</td>
                      <td className="px-4 py-3 text-neutral-300">{c.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Business Unit Slicing */}
        {activeTab === "bu" && (
          <div className="mt-6 space-y-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bus} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E34" vertical={false} />
                  <XAxis dataKey="bu_name" stroke="#8E8E93" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#8E8E93"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => formatCurrency(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1C1C1F",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                    formatter={(val: any) => [formatCurrency(Number(val) || 0), "Spend"]}
                  />
                  <Bar dataKey="total_spend" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
                  <tr>
                    <th className="px-4 py-3">Business Unit</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">POs</th>
                    <th className="px-4 py-3">Total Spend</th>
                    <th className="px-4 py-3">CAPEX</th>
                    <th className="px-4 py-3">OPEX</th>
                    <th className="px-4 py-3">Share (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {bus.map((b) => (
                    <tr key={b.bu_name} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-sans font-medium text-white">{b.bu_name}</td>
                      <td className="px-4 py-3 text-neutral-400">{b.bu_code}</td>
                      <td className="px-4 py-3 text-neutral-300">{b.po_count}</td>
                      <td className="px-4 py-3 font-bold text-emerald-400">{formatCurrency(b.total_spend)}</td>
                      <td className="px-4 py-3 text-purple-400">{formatCurrency(b.capex_spend)}</td>
                      <td className="px-4 py-3 text-neutral-300">{formatCurrency(b.opex_spend)}</td>
                      <td className="px-4 py-3 text-neutral-300">{b.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Supplier Pareto 80/20 Analysis */}
        {activeTab === "pareto" && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-medium text-white">Pareto 80/20 Cumulative Distribution Curve</h4>
                <p className="text-xs text-neutral-400">
                  Top 20% suppliers account for ~80% of spend. Tail suppliers provide consolidation leverage.
                </p>
              </div>

              <div className="w-64">
                <input
                  type="text"
                  placeholder="Filter supplier..."
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#252529] px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Pareto Composed Chart */}
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoVendors} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E34" vertical={false} />
                  <XAxis dataKey="vendor_name" stroke="#8E8E93" fontSize={11} tickLine={false} />
                  <YAxis
                    yAxisId="left"
                    stroke="#8E8E93"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => formatCurrency(v)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#8E8E93"
                    fontSize={11}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1C1C1F",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                    formatter={(val: any, name: any) => {
                      if (name === "Cumulative %") return [`${val}%`, name];
                      return [formatCurrency(Number(val) || 0), name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <ReferenceLine
                    yAxisId="right"
                    y={80}
                    label={{ value: "80% Threshold", fill: "#f59e0b", fontSize: 11 }}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="total_spend"
                    name="Spend ($)"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative_percentage"
                    name="Cumulative %"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ fill: "#10b981", r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Pareto Supplier Table */}
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Supplier Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">POs</th>
                    <th className="px-4 py-3">Total Spend</th>
                    <th className="px-4 py-3">Cumulative Spend</th>
                    <th className="px-4 py-3">Cum. %</th>
                    <th className="px-4 py-3">Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredVendors.map((v, idx) => (
                    <tr key={v.vendor_id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-neutral-500">#{idx + 1}</td>
                      <td className="px-4 py-3 font-sans font-medium text-white">{v.vendor_name}</td>
                      <td className="px-4 py-3 text-neutral-400">{v.vendor_code}</td>
                      <td className="px-4 py-3 text-neutral-300">{v.po_count}</td>
                      <td className="px-4 py-3 font-bold text-white">{formatCurrency(v.total_spend)}</td>
                      <td className="px-4 py-3 text-neutral-300">{formatCurrency(v.cumulative_spend)}</td>
                      <td className="px-4 py-3 text-emerald-400 font-bold">{v.cumulative_percentage}%</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                            v.pareto_tier === "TOP_80"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-neutral-800 text-neutral-400 border border-white/10"
                          }`}
                        >
                          {v.pareto_tier === "TOP_80" ? "TOP 80% TIER" : "LONG TAIL"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: CAPEX vs OPEX bifurcation */}
        {activeTab === "capex_opex" && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">CAPEX Investment</span>
                  <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-bold text-purple-300">
                    {capexPct}%
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight text-white">{formatCurrency(capexSpend)}</span>
                </div>
                <p className="mt-2 text-xs text-neutral-400">Capital expenditures, long-term assets, and plant expansion requisitions.</p>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">OPEX Operational</span>
                  <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-300">
                    {opexPct}%
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight text-white">{formatCurrency(opexSpend)}</span>
                </div>
                <p className="mt-2 text-xs text-neutral-400">Day-to-day operating expenses, consumables, utility contracts, and services.</p>
              </div>
            </div>

            {/* Category breakdown by capex/opex */}
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Total Spend</th>
                    <th className="px-4 py-3">CAPEX Allocation</th>
                    <th className="px-4 py-3">OPEX Allocation</th>
                    <th className="px-4 py-3">Nature Split</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {categories.map((c) => {
                    const cTot = c.total_spend || 1;
                    const cCapexRatio = Math.round((c.capex_spend / cTot) * 100);
                    return (
                      <tr key={c.category_name} className="hover:bg-white/5">
                        <td className="px-4 py-3 font-sans font-medium text-white">{c.category_name}</td>
                        <td className="px-4 py-3 font-bold text-white">{formatCurrency(c.total_spend)}</td>
                        <td className="px-4 py-3 text-purple-400">{formatCurrency(c.capex_spend)}</td>
                        <td className="px-4 py-3 text-blue-400">{formatCurrency(c.opex_spend)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-blue-500">
                              <div className="h-full bg-purple-500" style={{ width: `${cCapexRatio}%` }} />
                            </div>
                            <span className="text-[10px] text-neutral-400">
                              {cCapexRatio}% Cap / {100 - cCapexRatio}% Op
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
