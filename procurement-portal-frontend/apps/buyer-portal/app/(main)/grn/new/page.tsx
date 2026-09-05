"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  usePurchaseOrders,
  usePurchaseOrder,
  useCreateGRN,
  GrnLineCreate,
} from "@procurement/hooks";
import {
  Truck,
  ArrowLeft,
  Package,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";

export default function NewGRNPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPoId = searchParams.get("po_id") || "";

  const [selectedPoId, setSelectedPoId] = useState(initialPoId);
  const [challanNumber, setChallanNumber] = useState("");
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [transporterName, setTransporterName] = useState("");
  const [lrNumber, setLrNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Load POs eligible for receipt
  const { data: eligiblePOs = [], isLoading: isLoadingPOs } = usePurchaseOrders();

  // Load details for selected PO
  const { data: selectedPO, isLoading: isLoadingPODetail } = usePurchaseOrder(selectedPoId);

  // Line item received quantities
  const [lineQuantities, setLineQuantities] = useState<
    Record<
      string,
      {
        received_quantity: number;
        qc_required: boolean;
        rejection_reason?: string;
      }
    >
  >({});

  const createGRNMutation = useCreateGRN();

  // Initialize line quantities whenever selected PO changes
  useEffect(() => {
    if (selectedPO?.lines) {
      const initial: Record<
        string,
        {
          received_quantity: number;
          qc_required: boolean;
          rejection_reason?: string;
        }
      > = {};
      for (const line of selectedPO.lines) {
        const openQty = parseFloat(line.open_quantity || "0");
        initial[line.id] = {
          received_quantity: openQty > 0 ? openQty : 0,
          qc_required: false,
          rejection_reason: "",
        };
      }
      setLineQuantities(initial);
    }
  }, [selectedPO]);

  const handleQtyChange = (lineId: string, val: number) => {
    setLineQuantities((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        received_quantity: val >= 0 ? val : 0,
      },
    }));
  };

  const handleQcToggle = (lineId: string, val: boolean) => {
    setLineQuantities((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        qc_required: val,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!selectedPoId) {
      setErrorMsg("Please select a purchase order.");
      return;
    }
    if (!challanNumber.trim()) {
      setErrorMsg("Please provide a challan number.");
      return;
    }

    const linesToSubmit: GrnLineCreate[] = [];
    if (selectedPO?.lines) {
      for (const line of selectedPO.lines) {
        const entry = lineQuantities[line.id];
        if (entry && entry.received_quantity > 0) {
          linesToSubmit.push({
            po_line_id: line.id,
            received_quantity: String(entry.received_quantity),
            qc_required: entry.qc_required,
            rejection_reason: entry.rejection_reason || undefined,
          });
        }
      }
    }

    if (linesToSubmit.length === 0) {
      setErrorMsg("Please enter a received quantity greater than zero for at least one line.");
      return;
    }

    try {
      const grn = await createGRNMutation.mutateAsync({
        po_id: selectedPoId,
        challan_number: challanNumber,
        challan_date: challanDate || undefined,
        receipt_date: receiptDate,
        transporter_name: transporterName || undefined,
        lr_number: lrNumber || undefined,
        notes: notes || undefined,
        lines: linesToSubmit,
      });

      router.push(`/purchase-orders/${selectedPoId}`);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || "Failed to create GRN");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Link */}
      <div>
        <Link
          href="/purchase-orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Purchase Orders
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Truck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Create Goods Receipt Note (GRN)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Record receipt of goods delivered by vendor against an issued purchase order.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-lg text-rose-800 dark:text-rose-200 text-sm flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PO Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Purchase Order *
            </label>
            <select
              value={selectedPoId}
              onChange={(e) => setSelectedPoId(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">-- Choose a Purchase Order --</option>
              {eligiblePOs.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.po_number} — {po.title} ({po.status})
                </option>
              ))}
            </select>
          </div>

          {/* Challan & Delivery Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Vendor Challan Number *
              </label>
              <input
                type="text"
                value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)}
                placeholder="e.g. CH-2026-9901"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Challan Date
              </label>
              <input
                type="date"
                value={challanDate}
                onChange={(e) => setChallanDate(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Receipt Date *
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Transporter Name
              </label>
              <input
                type="text"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="e.g. Blue Dart, Safexpress"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                LR / Bilty Number
              </label>
              <input
                type="text"
                value={lrNumber}
                onChange={(e) => setLrNumber(e.target.value)}
                placeholder="e.g. LR-4482910"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Receiving Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarks, bay number, physical condition"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Line Items Entry */}
          {selectedPO && (
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Line Items for Receipt
              </h2>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-right">Ordered Qty</th>
                      <th className="px-4 py-3 text-right">Already Received</th>
                      <th className="px-4 py-3 text-right">Open Qty</th>
                      <th className="px-4 py-3 text-right w-36">Received This GRN *</th>
                      <th className="px-4 py-3 text-center w-28">QC Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {selectedPO.lines?.map((line) => {
                      const entry = lineQuantities[line.id] || {
                        received_quantity: 0,
                        qc_required: false,
                      };
                      const openQty = parseFloat(line.open_quantity || "0");
                      return (
                        <tr key={line.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                            {line.line_number}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                            {line.item_description}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {line.ordered_quantity}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-400">
                            {line.received_quantity}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                            {line.open_quantity}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max={openQty}
                              step="any"
                              value={entry.received_quantity}
                              onChange={(e) =>
                                handleQtyChange(line.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-full border border-slate-300 dark:border-slate-700 rounded p-1.5 text-right font-mono text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={entry.qc_required}
                              onChange={(e) => handleQcToggle(line.id, e.target.checked)}
                              className="h-4 w-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/purchase-orders"
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={createGRNMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {createGRNMutation.isPending ? "Submitting..." : "Confirm & Save GRN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
