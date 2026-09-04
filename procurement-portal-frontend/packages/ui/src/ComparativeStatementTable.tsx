"use client";

import React, { useState } from "react";
import { Badge } from "./components/Badge";
import { Button } from "./components/Button";

export interface CSLineRanking {
  id: string;
  cs_id: string;
  lot_id?: string | null;
  rfq_line_id?: string | null;
  bid_id: string;
  vendor_id: string;
  raw_unit_price: number;
  freight_per_unit: number;
  tax_per_unit: number;
  landed_cost: number;
  npv_adjusted_cost: number;
  rank: number;
  tax_discrepancy: boolean;
  supplier_declared_rate?: number | null;
  hsn_master_rate?: number | null;
  tie_breaking_applied: boolean;
  tie_breaking_reason?: string | null;
  lot_total_inr?: number | null;
  technical_score?: number | null;
  commercial_score?: number | null;
  composite_score?: number | null;
  is_l1: boolean;
}

export interface ComparativeStatement {
  id: string;
  org_id: string;
  rfq_id: string;
  cs_number: string;
  status: string;
  cost_of_capital_rate: number;
  evaluation_methodology: string;
  total_estimated_value: number;
  l1_total_value?: number | null;
  savings_percentage?: number | null;
  recommendations?: string | null;
  generated_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  pdf_document_id?: string | null;
  document_path?: string | null;
  cs_version: number;
  created_at?: string | null;
  rankings: CSLineRanking[];
}

export interface ComparativeStatementTableProps {
  cs: ComparativeStatement;
  vendorNames?: Record<string, string>;
  onShortlistChange?: (selectedVendorIds: string[]) => void;
  onNegotiateVendor?: (vendorId: string) => void;
  onAwardVendor?: (ranking: CSLineRanking) => void;
  showActions?: boolean;
}

export function ComparativeStatementTable({
  cs,
  vendorNames = {},
  onShortlistChange,
  onNegotiateVendor,
  onAwardVendor,
  showActions = true,
}: ComparativeStatementTableProps) {
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  const handleToggleVendor = (vendorId: string) => {
    const updated = selectedVendors.includes(vendorId)
      ? selectedVendors.filter((id) => id !== vendorId)
      : [...selectedVendors, vendorId];
    setSelectedVendors(updated);
    onShortlistChange?.(updated);
  };

  const rankings = cs.rankings || [];
  const sortedRankings = [...rankings].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (b.composite_score || 0) - (a.composite_score || 0);
  });

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl shadow-sm">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-b border-border/30 bg-muted/20">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Comparative Statement: {cs.cs_number}
            </h3>
            <Badge variant="outline" className="text-xs font-mono">
              v{cs.cs_version}
            </Badge>
            <Badge
              variant={
                cs.status === "APPROVED"
                  ? "success"
                  : cs.status === "DRAFT"
                  ? "secondary"
                  : "info"
              }
            >
              {cs.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Methodology: <span className="font-medium text-foreground">{cs.evaluation_methodology}</span> &bull;
            Estimated Value:{" "}
            <span className="font-medium text-foreground">
              INR {Number(cs.total_estimated_value).toLocaleString()}
            </span>{" "}
            {cs.savings_percentage ? (
              <>
                &bull; Savings:{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {Number(cs.savings_percentage).toFixed(2)}%
                </span>
              </>
            ) : null}
          </p>
        </div>

        {selectedVendors.length > 0 && showActions && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              {selectedVendors.length} shortlisted
            </span>
          </div>
        )}
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border/30 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {showActions && <th className="py-3.5 px-4 w-12 text-center">Select</th>}
              <th className="py-3.5 px-4">Rank</th>
              <th className="py-3.5 px-4">Vendor</th>
              <th className="py-3.5 px-4">Lot / Line</th>
              <th className="py-3.5 px-4 text-right">Landed Cost (INR)</th>
              <th className="py-3.5 px-4 text-center">Tech Score</th>
              <th className="py-3.5 px-4 text-center">Comm Score</th>
              <th className="py-3.5 px-4 text-center">Composite</th>
              <th className="py-3.5 px-4 text-center">Status / Flag</th>
              {showActions && <th className="py-3.5 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {sortedRankings.length === 0 ? (
              <tr>
                <td
                  colSpan={showActions ? 10 : 9}
                  className="py-8 text-center text-muted-foreground text-sm"
                >
                  No ranking data available for this Comparative Statement.
                </td>
              </tr>
            ) : (
              sortedRankings.map((r) => {
                const isWinner = r.is_l1 || r.rank === 1;
                const vName =
                  vendorNames[r.vendor_id] ||
                  `Vendor ${r.vendor_id.slice(0, 8)}...`;
                const isSelected = selectedVendors.includes(r.vendor_id);

                return (
                  <tr
                    key={r.id}
                    className={`transition-colors duration-150 ${
                      isWinner
                        ? "bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/30"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    {showActions && (
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleVendor(r.vendor_id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                        />
                      </td>
                    )}
                    <td className="py-3.5 px-4 font-semibold">
                      {isWinner ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-sm">
                          L1
                        </span>
                      ) : (
                        <span className="text-muted-foreground">L{r.rank}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-foreground">{vName}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {r.vendor_id.slice(0, 12)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      {r.lot_id ? `Lot ${r.lot_id.slice(0, 8)}` : r.rfq_line_id ? `Line ${r.rfq_line_id.slice(0, 8)}` : "All"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-foreground">
                      ₹
                      {Number(
                        r.lot_total_inr ?? r.landed_cost ?? 0
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-xs">
                      {r.technical_score !== null && r.technical_score !== undefined
                        ? Number(r.technical_score).toFixed(1)
                        : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-xs">
                      {r.commercial_score !== null && r.commercial_score !== undefined
                        ? Number(r.commercial_score).toFixed(1)
                        : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-xs">
                      {r.composite_score !== null && r.composite_score !== undefined
                        ? Number(r.composite_score).toFixed(1)
                        : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {isWinner && (
                          <Badge variant="success" className="text-[11px] font-semibold">
                            L1 WINNER
                          </Badge>
                        )}
                        {r.tax_discrepancy && (
                          <Badge variant="warning" className="text-[10px]">
                            Tax Mismatch
                          </Badge>
                        )}
                        {r.tie_breaking_applied && (
                          <Badge variant="info" className="text-[10px]">
                            Tie Broken
                          </Badge>
                        )}
                      </div>
                    </td>
                    {showActions && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onNegotiateVendor && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => onNegotiateVendor(r.vendor_id)}
                              className="text-xs h-7 px-2"
                            >
                              Negotiate
                            </Button>
                          )}
                          {onAwardVendor && (
                            <Button
                              size="sm"
                              variant={isWinner ? "primary" : "secondary"}
                              onClick={() => onAwardVendor(r)}
                              className="text-xs h-7 px-2"
                            >
                              Award
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
