"use client";

import React, { useState } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Package,
  X,
} from "lucide-react";
import { Button } from "./components/Button";

export interface RateCardLineItem {
  id: string;
  contract_id: string;
  line_number: number;
  item_description: string;
  uom_id: string;
  uom_name?: string;
  uom_code?: string;
  contracted_quantity?: number | string | null;
  unit_rate: number | string;
  utilized_quantity?: number | string;
  hsn_code?: string | null;
}

export interface RateCardTableProps {
  lines: RateCardLineItem[];
  contractType?: string;
  currency?: string;
  totalValue: number | string;
  utilizedValue?: number | string;
  canEdit?: boolean;
  onAddLine?: (data: {
    line_number: number;
    item_description: string;
    uom_id: string;
    contracted_quantity?: number;
    unit_rate: number;
    hsn_code?: string;
  }) => Promise<void> | void;
  onDeleteLine?: (lineId: string) => Promise<void> | void;
  uoms?: Array<{ id: string; name: string; code: string }>;
  className?: string;
}

export function RateCardTable({
  lines,
  contractType = "RATE_CONTRACT",
  currency = "INR",
  totalValue,
  utilizedValue = 0,
  canEdit = false,
  onAddLine,
  onDeleteLine,
  uoms = [],
  className = "",
}: RateCardTableProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [itemDesc, setItemDesc] = useState("");
  const [uomId, setUomId] = useState(uoms[0]?.id || "");
  const [contractedQty, setContractedQty] = useState("");
  const [unitRate, setUnitRate] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalNum = Number(totalValue || 0);
  const utilNum = Number(utilizedValue || 0);
  const remainingBal = Math.max(0, totalNum - utilNum);
  const utilPct = totalNum > 0 ? Math.min(100, Math.round((utilNum / totalNum) * 100)) : 0;

  const isOverUtilized = totalNum > 0 && utilNum >= totalNum;
  const isNearExhaustion = totalNum > 0 && utilPct >= 85 && !isOverUtilized;

  const formatCurrency = (val: number | string) => {
    const num = Number(val || 0);
    return `${currency === "INR" ? "₹" : currency + " "}${num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddLine || !itemDesc.trim() || !unitRate) return;
    try {
      setIsSubmitting(true);
      const nextLineNum = lines.length > 0 ? Math.max(...lines.map((l) => l.line_number)) + 1 : 1;
      await onAddLine({
        line_number: nextLineNum,
        item_description: itemDesc.trim(),
        uom_id: uomId || uoms[0]?.id || "00000000-0000-0000-0000-000000000000",
        contracted_quantity: contractedQty ? parseFloat(contractedQty) : undefined,
        unit_rate: parseFloat(unitRate),
        hsn_code: hsnCode.trim() || undefined,
      });
      setIsAddModalOpen(false);
      setItemDesc("");
      setContractedQty("");
      setUnitRate("");
      setHsnCode("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (lineId: string) => {
    if (!onDeleteLine || !confirm("Remove this rate card line item from the contract?")) return;
    try {
      setDeletingId(lineId);
      await onDeleteLine(lineId);
    } finally {
      setDeletingId(null);
    }
  };

  const exportCSV = () => {
    const headers = ["Line #", "Item Description", "HSN/SAC", "UOM ID", "Contracted Qty", "Unit Rate", "Utilized Qty", "Line Ceiling"];
    const rows = lines.map((l) => {
      const lineCeiling = Number(l.contracted_quantity || 0) * Number(l.unit_rate || 0);
      return [
        l.line_number,
        `"${(l.item_description || "").replace(/"/g, '""')}"`,
        l.hsn_code || "",
        l.uom_code || l.uom_id || "",
        l.contracted_quantity || "Rate Only",
        l.unit_rate,
        l.utilized_quantity || 0,
        lineCeiling > 0 ? lineCeiling : "Open",
      ].join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contract-rate-card-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Spend Ceiling & Utilization KPI Bar */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/15 bg-white dark:bg-[#1C1C1F] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200/80 dark:border-white/10 gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Rate Contract Spend Utilization
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live consumption against agreed contract spend ceiling via linked Purchase Orders
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={exportCSV} title="Export Rate Card to CSV">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
            {canEdit && (
              <Button size="sm" variant="primary" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Line Item
              </Button>
            )}
          </div>
        </div>

        {/* Warning Banners */}
        {isOverUtilized && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300 font-medium">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>
              <strong>Ceiling Exceeded:</strong> Total committed spend ({formatCurrency(utilNum)}) has reached or surpassed the contracted maximum ({formatCurrency(totalNum)}). Subsequent POs require an amendment.
            </span>
          </div>
        )}
        {isNearExhaustion && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Near Exhaustion Warning:</strong> Contract spend has reached {utilPct}% of its total ceiling. Consider initiating a value amendment.
            </span>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 dark:bg-[#252529] p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Contract Ceiling
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {formatCurrency(totalNum)}
            </div>
            <span className="text-[10px] text-slate-400">Agreed limit</span>
          </div>

          <div className="bg-slate-50 dark:bg-[#252529] p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Committed Spend
            </span>
            <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {formatCurrency(utilNum)}
            </div>
            <span className="text-[10px] text-slate-400">From released POs</span>
          </div>

          <div className="bg-slate-50 dark:bg-[#252529] p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Available Balance
            </span>
            <div className={`text-base font-bold mt-0.5 ${remainingBal === 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {formatCurrency(remainingBal)}
            </div>
            <span className="text-[10px] text-slate-400">Remaining head-room</span>
          </div>

          <div className="bg-slate-50 dark:bg-[#252529] p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Utilization Rate
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {utilPct}%
            </div>
            <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  utilPct >= 90 ? "bg-red-500" : utilPct >= 75 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${utilPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rate Card Lines Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/15 bg-white dark:bg-[#1C1C1F] overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Contract Catalog & Rate Card Items ({lines.length})
            </h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Type: <strong className="font-semibold text-slate-700 dark:text-slate-300">{contractType}</strong>
          </span>
        </div>

        {lines.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
            No line items or rate cards configured for this contract.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/10 bg-slate-50/75 dark:bg-[#252529]/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Item Description</th>
                  <th className="py-3 px-4 w-28">HSN / SAC</th>
                  <th className="py-3 px-4 w-24">UOM</th>
                  <th className="py-3 px-4 w-32 text-right">Contracted Qty</th>
                  <th className="py-3 px-4 w-32 text-right">Agreed Rate</th>
                  <th className="py-3 px-4 w-32 text-right">Utilized Qty</th>
                  <th className="py-3 px-4 w-36 text-right">Line Ceiling</th>
                  {canEdit && <th className="py-3 px-4 w-16 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-white/10">
                {lines.map((line) => {
                  const qty = Number(line.contracted_quantity || 0);
                  const rate = Number(line.unit_rate || 0);
                  const lineCeiling = qty > 0 ? qty * rate : 0;

                  return (
                    <tr
                      key={line.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                        {line.line_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {line.item_description}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {line.hsn_code || "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-medium">
                          {line.uom_code || "EA"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                        {qty > 0 ? (
                          qty.toLocaleString()
                        ) : (
                          <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Rate Only
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(rate)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-400">
                        {Number(line.utilized_quantity || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {lineCeiling > 0 ? formatCurrency(lineCeiling) : "Open-Ended"}
                      </td>
                      {canEdit && (
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDelete(line.id)}
                            disabled={deletingId === line.id}
                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1"
                            title="Delete Line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Line Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#1C1C1F] border border-slate-200/80 dark:border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10">
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Add Catalog Rate Card Item
              </h4>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Item Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cisco Catalyst 9300 48-Port Switch"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 851762"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    UOM *
                  </label>
                  <select
                    value={uomId}
                    onChange={(e) => setUomId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contracted Quantity
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Blank for open rate"
                    value={contractedQty}
                    onChange={(e) => setContractedQty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Unit Rate ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 1250.00"
                    value={unitRate}
                    onChange={(e) => setUnitRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/80 dark:border-white/10">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Adding..." : "Add Line"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
