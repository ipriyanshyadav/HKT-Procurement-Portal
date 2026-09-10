"use client";

import React from "react";

export interface MatchLineResult {
  id?: string;
  invoice_line_id: string;
  po_line_id: string;
  price_match: boolean;
  price_deviation?: number | string | null;
  quantity_match: boolean;
  quantity_deviation?: number | string | null;
  po_reference_valid: boolean;
  tax_match: boolean;
  tax_deviation?: number | string;
  overall_match: boolean;
  mismatch_reasons?: string[] | null;
  created_at?: string;
}

export interface InvoiceLineItem {
  id: string;
  line_number: number;
  item_description: string;
  quantity: number | string;
  unit_price: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  line_total: number | string;
}

export interface InvoiceData {
  id: string;
  invoice_number: string;
  vendor_invoice_number: string;
  match_status: string;
  status: string;
  currency: string;
  total_amount: number | string;
  price_tolerance?: number | string;
  lines?: InvoiceLineItem[];
  match_results?: MatchLineResult[];
}

export interface ThreeWayMatchResultProps {
  invoice: InvoiceData;
  matchResults?: MatchLineResult[];
  lines?: InvoiceLineItem[];
  onRematch?: () => void;
  isMatching?: boolean;
  className?: string;
}

export function ThreeWayMatchResult({
  invoice,
  matchResults = invoice.match_results || [],
  lines = invoice.lines || [],
  onRematch,
  isMatching = false,
  className = "",
}: ThreeWayMatchResultProps) {
  const totalLines = lines.length;
  const matchedCount = matchResults.filter((m) => m.overall_match).length;
  const discrepancyCount = totalLines - matchedCount;

  const getMatchStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "MATCHED":
      case "FULL_MATCH":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <svg className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Full 3-Way Match
          </span>
        );
      case "PARTIAL_MATCH":
      case "PARTIALLY_MATCHED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <svg className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Partial Match
          </span>
        );
      case "DISCREPANCY":
      case "DISPUTED":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <svg className="w-3.5 h-3.5 mr-1.5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Match Discrepancy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/15">
            Not Matched
          </span>
        );
    }
  };

  const linesMap = new Map(lines.map((l) => [l.id, l]));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Summary Card */}
      <div className="bg-white/80 dark:bg-[#1C1C1F] backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/15 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">3-Way Match Verification</h3>
              {getMatchStatusBadge(invoice.match_status)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Automated reconciliation of Purchase Order, Goods Receipt Notes, and Invoiced line items.
            </p>
          </div>

          {onRematch && (
            <button
              onClick={onRematch}
              disabled={isMatching}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white hover:bg-slate-50 dark:bg-[#252529] dark:hover:bg-[#2E2E34] border border-slate-300 dark:border-white/15 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400 ${isMatching ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isMatching ? "Verifying..." : "Re-run Match Engine"}
            </button>
          )}
        </div>

        {/* Verification KPI metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
          <div className="bg-slate-50/70 dark:bg-[#252529] rounded-xl p-3 border border-slate-100 dark:border-white/5">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Lines</span>
            <p className="text-lg font-semibold text-slate-900 dark:text-white mt-0.5">{totalLines}</p>
          </div>
          <div className="bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl p-3 border border-emerald-100/60 dark:border-emerald-900/40">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Matched Lines</span>
            <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-300 mt-0.5">{matchedCount}</p>
          </div>
          <div className="bg-rose-50/50 dark:bg-rose-950/30 rounded-xl p-3 border border-rose-100/60 dark:border-rose-900/40">
            <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">Discrepancies</span>
            <p className="text-lg font-semibold text-rose-800 dark:text-rose-300 mt-0.5">{discrepancyCount}</p>
          </div>
          <div className="bg-slate-50/70 dark:bg-[#252529] rounded-xl p-3 border border-slate-100 dark:border-white/5">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tolerances Applied</span>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
              Qty: ±2% | Price: ±{Number(invoice.price_tolerance || 0.005) * 100}%
            </p>
          </div>
        </div>
      </div>

      {/* Per-line match details table */}
      <div className="bg-white/80 dark:bg-[#1C1C1F] backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-[#252529] flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Line-by-Line Match Breakdown</h4>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">PO lines vs Invoiced quantities</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-white/10 text-xs">
            <thead className="bg-slate-50/80 dark:bg-[#252529] text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 pl-4 pr-3 text-left"># / Item</th>
                <th className="px-3 py-3 text-right">Invoiced Qty</th>
                <th className="px-3 py-3 text-center">Qty Match</th>
                <th className="px-3 py-3 text-right">Unit Price</th>
                <th className="px-3 py-3 text-center">Price Match</th>
                <th className="px-3 py-3 text-center">Tax Match</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="py-3 pl-3 pr-4 text-left">Discrepancy Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10 bg-white dark:bg-[#1C1C1F]">
              {matchResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No match results recorded yet for this invoice.
                  </td>
                </tr>
              ) : (
                matchResults.map((m, idx) => {
                  const invLine = linesMap.get(m.invoice_line_id);
                  return (
                    <tr
                      key={m.id || idx}
                      className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.04] transition-colors ${
                        !m.overall_match ? "bg-rose-50/30 dark:bg-rose-950/20" : ""
                      }`}
                    >
                      <td className="py-3 pl-4 pr-3 text-left">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          Line {invLine?.line_number || idx + 1}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={invLine?.item_description}>
                          {invLine?.item_description || "PO Line Item"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right font-mono font-medium text-slate-900 dark:text-white">
                        {invLine?.quantity ? Number(invLine.quantity).toFixed(2) : "-"}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {m.quantity_match ? (
                          <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                            <svg className="w-4 h-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-rose-600 dark:text-rose-400 font-medium">
                            <svg className="w-4 h-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Mismatch
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right font-mono font-medium text-slate-900 dark:text-white">
                        {invLine?.unit_price
                          ? `${invoice.currency} ${Number(invLine.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          : "-"}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {m.price_match ? (
                          <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                            <svg className="w-4 h-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-rose-600 dark:text-rose-400 font-medium">
                            <svg className="w-4 h-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Mismatch
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {m.tax_match ? (
                          <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                            <svg className="w-4 h-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-amber-600 dark:text-amber-400 font-medium">
                            <svg className="w-4 h-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Variance
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {m.overall_match ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Matched
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            Discrepancy
                          </span>
                        )}
                      </td>

                      <td className="py-3 pl-3 pr-4 text-left">
                        {m.mismatch_reasons && m.mismatch_reasons.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {m.mismatch_reasons.map((r: string, i: number) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
