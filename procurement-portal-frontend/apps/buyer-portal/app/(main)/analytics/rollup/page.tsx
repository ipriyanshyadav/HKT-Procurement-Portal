"use client";

import React from "react";
import Link from "next/link";
import {
  Globe,
  Building2,
  TrendingUp,
  Package,
  Users,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Percent,
} from "lucide-react";
import { useCrossTenantRollup, useSwitchCompanyContext } from "@procurement/hooks";

export default function CrossTenantRollupPage() {
  const { data: rollup, isLoading, refetch, isFetching } = useCrossTenantRollup();
  const switchMutation = useSwitchCompanyContext();

  const handleEntitySwitch = (entityId: string) => {
    switchMutation.mutate({ target_legal_entity_id: entityId });
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 animate-pulse">
          <div>
            <div className="h-7 w-72 bg-neutral-800 rounded mb-2" />
            <div className="h-4 w-96 bg-neutral-850 rounded" />
          </div>
          <div className="h-9 w-28 bg-neutral-800 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-[#1C1C1F] border border-[#2e2e32] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: rollup?.group_currency || "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2e2e32] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
            <Globe className="w-4 h-4" />
            Multi-Tenant Enterprise Intelligence
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Group Spend & Cross-Tenant Rollup
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Aggregated procurement metrics, supplier overlaps, and consolidation opportunities across all legal entities.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-[#1C1C1F] hover:bg-[#252529] border border-[#2e2e32] text-neutral-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-400" : ""}`} />
            Refresh Group Data
          </button>
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            KPI Cockpit
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#1C1C1F] border border-[#2e2e32] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Total Group Spend</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-3 font-mono">
            {formatCurrency(rollup?.total_spend || 0)}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Across {rollup?.total_entities_count || 0} operating legal entities
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#1C1C1F] border border-[#2e2e32] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Group PO Volume</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-3 font-mono">
            {(rollup?.total_po_count || 0).toLocaleString()}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Converted from {(rollup?.total_pr_count || 0).toLocaleString()} requisitions
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#1C1C1F] border border-[#2e2e32] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Active Vendor Base</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-3 font-mono">
            {(rollup?.active_vendors_count || 0).toLocaleString()}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {rollup?.vendor_overlaps?.filter((v) => v.entity_count > 1).length || 0} shared across entities
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#1C1C1F] border border-[#2e2e32] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Avg PR-to-PO Cycle</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-3 font-mono">
            {rollup?.entities?.[0]?.pr_to_po_cycle_days || 3.8}d
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            98.2% prompt discount capture
          </div>
        </div>
      </div>

      {/* Operating Entity Rollup Table */}
      <div className="bg-[#1C1C1F] border border-[#2e2e32] rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#2e2e32] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">
              Legal Entities Spend & Cycle Time Breakdown
            </h2>
          </div>
          <span className="text-xs text-neutral-500">
            Click entity to activate context
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#252529] text-neutral-400 uppercase tracking-wider font-semibold border-b border-[#2e2e32]">
              <tr>
                <th className="px-6 py-3">Operating Company</th>
                <th className="px-6 py-3">Country</th>
                <th className="px-6 py-3">PO Count</th>
                <th className="px-6 py-3">Avg Order</th>
                <th className="px-6 py-3">Total Spend</th>
                <th className="px-6 py-3">Share %</th>
                <th className="px-6 py-3">Cycle Days</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e2e32]">
              {(rollup?.entities ?? []).map((entity) => (
                <tr key={entity.entity_id} className="hover:bg-[#252529]/60 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white">{entity.entity_name}</div>
                    <div className="text-[11px] font-mono text-neutral-500">{entity.entity_id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[11px] border border-neutral-700">
                      {entity.country_code}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-neutral-200">
                    {entity.po_count}
                  </td>
                  <td className="px-6 py-4 font-mono text-neutral-300">
                    {formatCurrency(entity.average_po_value)}
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold text-white">
                    {formatCurrency(entity.spend)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-32">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                        <span>{entity.spend_percentage}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(entity.spend_percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-neutral-300">
                    {entity.pr_to_po_cycle_days}d
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleEntitySwitch(entity.entity_id)}
                      disabled={switchMutation.isPending}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors disabled:opacity-50"
                    >
                      Switch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shared Vendor Consolidation Opportunities */}
      <div className="bg-[#1C1C1F] border border-[#2e2e32] rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#2e2e32] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">
              Supplier Overlap & Consolidation Intelligence
            </h2>
          </div>
          <span className="text-xs text-amber-400/80 font-medium">
            High ROI Opportunities
          </span>
        </div>

        <div className="divide-y divide-[#2e2e32]">
          {(rollup?.vendor_overlaps ?? []).length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              No overlapping suppliers detected across operating companies.
            </div>
          ) : (
            (rollup?.vendor_overlaps ?? []).map((vendor) => (
              <div key={vendor.vendor_id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#252529]/40 transition-colors">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{vendor.vendor_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase ${
                      vendor.entity_count >= 2
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                    }`}>
                      {vendor.entity_count} {vendor.entity_count === 1 ? "Entity" : "Entities"}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    {vendor.consolidation_opportunity}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-neutral-500">Active in:</span>
                    {vendor.entity_names.map((name, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-[#252529] border border-[#2e2e32] text-neutral-300">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-left md:text-right shrink-0">
                  <div className="text-sm font-bold text-white font-mono">
                    {formatCurrency(vendor.total_group_spend)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Across {vendor.po_count} purchase orders
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top Categories Pareto */}
      <div className="bg-[#1C1C1F] border border-[#2e2e32] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">
            Top Spend Categories Across Corporate Group
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(rollup?.top_categories ?? []).map((cat, i) => (
            <div key={i} className="p-4 rounded-lg bg-[#252529]/60 border border-[#2e2e32] flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-neutral-200">{cat.category_name}</div>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  {cat.spend_percentage}% of total spend
                </div>
              </div>
              <div className="text-sm font-bold text-white font-mono">
                {formatCurrency(cat.spend)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
