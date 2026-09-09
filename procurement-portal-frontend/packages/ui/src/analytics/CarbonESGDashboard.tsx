"use client";

import React, { useState } from "react";
import {
  useCarbonFootprint,
  useRecalculateCarbonFootprint,
} from "@procurement/hooks";

export function CarbonESGDashboard() {
  const { data: footprint, isLoading, error } = useCarbonFootprint();
  const recalculateMutation = useRecalculateCarbonFootprint();
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "categories" | "suppliers" | "trajectory">("overview");

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 text-emerald-600">
          <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="font-medium text-slate-700">Calculating Supply Chain Scope 1, 2, 3 Emissions...</span>
        </div>
      </div>
    );
  }

  if (error || !footprint) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <h4 className="font-semibold">Unable to load Carbon ESG Intelligence</h4>
        <p className="mt-1 text-sm">Failed to connect to carbon calculation analytics service.</p>
      </div>
    );
  }

  const getRatingBadge = (rating: string) => {
    switch (rating.toUpperCase()) {
      case "AAA":
      case "AA":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "A":
      case "BBB":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "BB":
      case "B":
        return "bg-amber-100 text-amber-800 border-amber-300";
      default:
        return "bg-rose-100 text-rose-800 border-rose-300";
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk.toUpperCase()) {
      case "LOW":
        return "bg-emerald-100 text-emerald-700";
      case "MEDIUM":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-rose-100 text-rose-700 font-semibold";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Recalculate */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
              GHG Protocol / DEFRA 2026
            </span>
            <span className="text-xs text-slate-500 font-medium">Science Based Targets initiative (SBTi) Aligned</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Carbon ESG Footprint & Sustainable Procurement</h2>
          <p className="text-sm text-slate-600">
            Real-time spend-based greenhouse gas emissions accounting across Scope 1, 2, and supply chain Scope 3.
          </p>
        </div>

        <button
          onClick={() => recalculateMutation.mutate()}
          disabled={recalculateMutation.isPending}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {recalculateMutation.isPending ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Recalculating Footprint...
            </>
          ) : (
            <>
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Recalculate Carbon Spend
            </>
          )}
        </button>
      </div>

      {/* KPI Highlight Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total CO2e */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Footprint</span>
            <span className="rounded-full bg-emerald-50 p-2 text-emerald-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">
            {footprint.total_co2e_tonnes.toLocaleString()} <span className="text-base font-medium text-slate-500">t CO₂e</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Across <span className="font-semibold text-slate-700">₹{(footprint.total_evaluated_spend / 100000).toFixed(1)} Lakhs</span> evaluated PO spend
          </div>
        </div>

        {/* Scope 3 Supply Chain */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scope 3 Supply Chain</span>
            <span className="rounded-full bg-indigo-50 p-2 text-indigo-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">
            {footprint.scope3_co2e_tonnes.toLocaleString()} <span className="text-base font-medium text-slate-500">t ({footprint.scope3_pct}%)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Procured goods, logistics, transport & vendor emissions
          </div>
        </div>

        {/* Carbon Intensity */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Carbon Intensity</span>
            <span className="rounded-full bg-amber-50 p-2 text-amber-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">
            {footprint.avg_carbon_intensity_kg_per_spend.toFixed(3)} <span className="text-base font-medium text-slate-500">kg/₹</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            SBTi Target: <span className="font-semibold text-emerald-600">&lt; 0.450 kg/₹</span> by 2030
          </div>
        </div>

        {/* High Risk Suppliers */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">SBTi & ESG Alignment</span>
            <span className="rounded-full bg-rose-50 p-2 text-rose-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">
            {footprint.sbti_compliant_spend_pct}% <span className="text-base font-medium text-slate-500">SBTi spend</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            <span className="font-bold text-rose-600">{footprint.high_risk_supplier_count} suppliers</span> in High-Carbon / Non-ESG Risk Tier
          </div>
        </div>
      </div>

      {/* Scope 1, 2, 3 Visual Distribution Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-800">GHG Emissions Scope Distribution</h4>
        <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            style={{ width: `${footprint.scope1_pct}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Scope 1 (Direct): ${footprint.scope1_co2e_tonnes} t (${footprint.scope1_pct}%)`}
          />
          <div
            style={{ width: `${footprint.scope2_pct}%` }}
            className="bg-cyan-500 transition-all duration-500"
            title={`Scope 2 (Electricity & Heat): ${footprint.scope2_co2e_tonnes} t (${footprint.scope2_pct}%)`}
          />
          <div
            style={{ width: `${footprint.scope3_pct}%` }}
            className="bg-indigo-600 transition-all duration-500"
            title={`Scope 3 (Supply Chain): ${footprint.scope3_co2e_tonnes} t (${footprint.scope3_pct}%)`}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Scope 1 (Direct combustion):</span>
            <span className="font-semibold text-slate-900">{footprint.scope1_co2e_tonnes} t ({footprint.scope1_pct}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-cyan-500" />
            <span className="text-slate-600">Scope 2 (Purchased energy):</span>
            <span className="font-semibold text-slate-900">{footprint.scope2_co2e_tonnes} t ({footprint.scope2_pct}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-indigo-600" />
            <span className="text-slate-600">Scope 3 (Upstream Supply Chain):</span>
            <span className="font-semibold text-slate-900">{footprint.scope3_co2e_tonnes} t ({footprint.scope3_pct}%)</span>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveSubTab("overview")}
            className={`border-b-2 py-3 text-sm font-semibold transition ${
              activeSubTab === "overview"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Decarbonization Roadmap & AI Actions
          </button>
          <button
            onClick={() => setActiveSubTab("categories")}
            className={`border-b-2 py-3 text-sm font-semibold transition ${
              activeSubTab === "categories"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Category Emission Breakdown
          </button>
          <button
            onClick={() => setActiveSubTab("suppliers")}
            className={`border-b-2 py-3 text-sm font-semibold transition ${
              activeSubTab === "suppliers"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Supplier ESG League Table
          </button>
          <button
            onClick={() => setActiveSubTab("trajectory")}
            className={`border-b-2 py-3 text-sm font-semibold transition ${
              activeSubTab === "trajectory"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Net-Zero 2030 Trajectory
          </button>
        </nav>
      </div>

      {/* Tab 1: AI Decarbonization Actions */}
      {activeSubTab === "overview" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-emerald-600 p-2 text-white shadow-sm">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Automated Carbon Abatement Intelligence</h3>
                <p className="mt-1 text-sm text-slate-600">
                  AI-identified procurement interventions to achieve compliance with corporate ESG milestones and ISO 14001 guidelines.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {footprint.decarbonization_recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-2.5 rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium text-slate-800 leading-snug">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Category Breakdown Table */}
      {activeSubTab === "categories" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="px-6 py-3.5">Spend Category</th>
                <th className="px-6 py-3.5 text-right">Evaluated Spend</th>
                <th className="px-6 py-3.5 text-right">Scope 1 (t)</th>
                <th className="px-6 py-3.5 text-right">Scope 2 (t)</th>
                <th className="px-6 py-3.5 text-right">Scope 3 (t)</th>
                <th className="px-6 py-3.5 text-right font-bold text-slate-900">Total CO₂e</th>
                <th className="px-6 py-3.5 text-right">% of Org</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {footprint.category_breakdown.map((cat, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-3.5 font-medium text-slate-900">{cat.category_name}</td>
                  <td className="px-6 py-3.5 text-right font-mono">₹{cat.spend.toLocaleString()}</td>
                  <td className="px-6 py-3.5 text-right font-mono text-emerald-700">{cat.scope1_co2e_tonnes.toFixed(1)}</td>
                  <td className="px-6 py-3.5 text-right font-mono text-cyan-700">{cat.scope2_co2e_tonnes.toFixed(1)}</td>
                  <td className="px-6 py-3.5 text-right font-mono text-indigo-700">{cat.scope3_co2e_tonnes.toFixed(1)}</td>
                  <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                    {cat.total_co2e_tonnes.toFixed(1)}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">
                      {cat.percentage_of_total}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Supplier ESG League Table */}
      {activeSubTab === "suppliers" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="px-6 py-3.5">Vendor / Partner</th>
                <th className="px-6 py-3.5 text-right">PO Spend</th>
                <th className="px-6 py-3.5 text-right">Scope 3 Emissions</th>
                <th className="px-6 py-3.5 text-center">ESG Rating</th>
                <th className="px-6 py-3.5 text-center">Composite Score</th>
                <th className="px-6 py-3.5 text-center">SBTi Committed</th>
                <th className="px-6 py-3.5 text-center">ISO 14001</th>
                <th className="px-6 py-3.5 text-center">Climate Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {footprint.supplier_league_table.map((sup, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-3.5 font-medium text-slate-900">{sup.vendor_name}</td>
                  <td className="px-6 py-3.5 text-right font-mono">₹{sup.total_spend.toLocaleString()}</td>
                  <td className="px-6 py-3.5 text-right font-mono font-bold text-indigo-700">
                    {sup.scope3_co2e_tonnes.toFixed(1)} t
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <span className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-bold ${getRatingBadge(sup.esg_rating)}`}>
                      {sup.esg_rating}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-center font-mono font-semibold text-slate-800">
                    {sup.composite_esg_score} / 100
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {sup.sbti_committed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        SBTi Verified
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {sup.iso_14001_certified ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">ISO 14001</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${getRiskBadge(sup.risk_level)}`}>
                      {sup.risk_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Net-Zero Trajectory */}
      {activeSubTab === "trajectory" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Net-Zero 2030 Science-Based Target Trajectory</h3>
              <p className="mt-1 text-sm text-slate-600">
                Tracking annual procurement decarbonization at -7.1% YoY vs Paris Climate Accord 1.5°C threshold.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="h-3 w-3 rounded-full bg-emerald-600" /> Target Path (-7% YoY)
              </span>
              <span className="flex items-center gap-1.5 text-indigo-700">
                <span className="h-3 w-3 rounded-full bg-indigo-500" /> Current Trajectory
              </span>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-6 py-3">Reporting Year</th>
                  <th className="px-6 py-3 text-right">Target CO₂e (Tonnes)</th>
                  <th className="px-6 py-3 text-right">Projected CO₂e</th>
                  <th className="px-6 py-3 text-right">Actual Audited</th>
                  <th className="px-6 py-3 text-center">Variance vs Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {footprint.net_zero_trajectory.map((t, idx) => {
                  const varVal = t.actual_co2e_tonnes != null ? t.actual_co2e_tonnes - t.target_co2e_tonnes : null;
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-6 py-3.5 font-bold text-slate-900">{t.year}</td>
                      <td className="px-6 py-3.5 text-right font-mono font-semibold text-emerald-700">
                        {t.target_co2e_tonnes.toLocaleString()} t
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-indigo-600">
                        {t.projected_co2e_tonnes.toLocaleString()} t
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                        {t.actual_co2e_tonnes != null ? `${t.actual_co2e_tonnes.toLocaleString()} t` : "Pending Year End"}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        {varVal != null ? (
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                            varVal <= 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {varVal <= 0 ? "On Target" : `+${varVal.toFixed(1)} t gap`}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
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
  );
}
