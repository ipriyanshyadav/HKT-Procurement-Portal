"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useEligibleInvoiceLines,
  useSubmitInvoice,
  usePurchaseOrders,
} from "@procurement/hooks";
import type { POResponse, EligibleLineResponse } from "@procurement/types";
import {
  ArrowLeft,
  Receipt,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileText,
  DollarSign,
  Package,
} from "lucide-react";

interface FormInvoiceLine {
  po_line_id: string;
  line_number: number;
  item_description: string;
  max_quantity: number;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
}

export default function NewInvoicePage() {
  const router = useRouter();

  // Queries
  const { data: eligibleLines = [], isLoading: isLoadingEligible } = useEligibleInvoiceLines();
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const submitMutation = useSubmitInvoice();

  // Form State
  const [selectedPoId, setSelectedPoId] = useState<string>("");
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [currency, setCurrency] = useState("INR");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<FormInvoiceLine[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Group eligible lines by PO
  const poOptions = useMemo(() => {
    const pos = new Map<string, { id: string; number: string; linesCount: number }>();
    eligibleLines.forEach((el) => {
      if (!pos.has(el.po_id)) {
        pos.set(el.po_id, {
          id: el.po_id,
          number: el.po_number,
          linesCount: 0,
        });
      }
      pos.get(el.po_id)!.linesCount += 1;
    });
    return Array.from(pos.values());
  }, [eligibleLines]);

  // When selected PO changes, load its eligible lines into the form
  useEffect(() => {
    if (!selectedPoId) {
      setLines([]);
      return;
    }

    const filtered = eligibleLines.filter((l) => l.po_id === selectedPoId);
    if (filtered.length > 0) {
      const initialFormLines: FormInvoiceLine[] = filtered.map((l) => {
        const qty = Number(l.eligible_quantity);
        const price = Number(l.unit_price);
        const taxRate = Number(l.tax_rate);
        const tax = (qty * price * taxRate) / 100;
        const total = qty * price + tax;
        return {
          po_line_id: l.po_line_id,
          line_number: l.line_number,
          item_description: l.item_description,
          max_quantity: qty,
          quantity: qty,
          unit_price: price,
          tax_rate: taxRate,
          tax_amount: Number(tax.toFixed(2)),
          line_total: Number(total.toFixed(2)),
        };
      });
      setLines(initialFormLines);
    } else {
      // Fallback: check if selected from purchaseOrders
      const po = purchaseOrders.find((p) => p.id === selectedPoId);
      if (po && po.lines) {
        const initialFormLines: FormInvoiceLine[] = po.lines.map((l) => {
          const qty = Number(l.received_quantity || l.ordered_quantity);
          const price = Number(l.unit_price);
          const taxRate = Number(l.tax_rate || 0);
          const tax = (qty * price * taxRate) / 100;
          const total = qty * price + tax;
          return {
            po_line_id: l.id,
            line_number: l.line_number,
            item_description: l.item_description,
            max_quantity: qty,
            quantity: qty,
            unit_price: price,
            tax_rate: taxRate,
            tax_amount: Number(tax.toFixed(2)),
            line_total: Number(total.toFixed(2)),
          };
        });
        setLines(initialFormLines);
      }
    }
  }, [selectedPoId, eligibleLines, purchaseOrders]);

  const updateLineQty = (index: number, newQty: number) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const qty = Math.max(0, newQty);
        const tax = (qty * l.unit_price * l.tax_rate) / 100;
        const total = qty * l.unit_price + tax;
        return {
          ...l,
          quantity: qty,
          tax_amount: Number(tax.toFixed(2)),
          line_total: Number(total.toFixed(2)),
        };
      })
    );
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = useMemo(() => {
    return lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  }, [lines]);

  const totalTax = useMemo(() => {
    return lines.reduce((sum, l) => sum + l.tax_amount, 0);
  }, [lines]);

  const grandTotal = useMemo(() => {
    return subtotal + totalTax;
  }, [subtotal, totalTax]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedPoId) {
      setErrorMsg("Please select a Purchase Order to invoice against.");
      return;
    }
    if (!vendorInvoiceNumber.trim()) {
      setErrorMsg("Vendor Invoice Number is required.");
      return;
    }
    if (lines.length === 0) {
      setErrorMsg("At least one line item must be included.");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        data: {
          po_id: selectedPoId,
          vendor_invoice_number: vendorInvoiceNumber.trim(),
          invoice_date: invoiceDate,
          currency,
          subtotal: Number(subtotal.toFixed(2)),
          tax_amount: Number(totalTax.toFixed(2)),
          total_amount: Number(grandTotal.toFixed(2)),
          notes: notes.trim() || undefined,
          lines: lines.map((l) => ({
            po_line_id: l.po_line_id,
            line_number: l.line_number,
            item_description: l.item_description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            tax_rate: l.tax_rate,
            tax_amount: l.tax_amount,
            line_total: l.line_total,
          })),
        },
      });
      router.push("/invoices");
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.error?.message ||
          err?.message ||
          "Failed to submit invoice. Check duplicate invoice number or lines."
      );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/invoices" className="hover:text-slate-800 flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">Submit New Tax Invoice</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Receipt className="h-6 w-6 text-indigo-600" />
          Create & Submit Invoice
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Submit your official GST tax invoice linked to delivered Purchase Order lines for automated 3-way matching.
        </p>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: PO & General Information */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-indigo-600" />
            1. PO Linkage & Invoice Header
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Select Purchase Order *
              </label>
              <select
                required
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose PO with Delivered Goods --</option>
                {poOptions.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.number} ({po.linesCount} lines with accepted receipts)
                  </option>
                ))}
                {poOptions.length === 0 &&
                  purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} ({po.status})
                    </option>
                  ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Only POs with accepted GRN receipts can be invoiced.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Vendor Invoice Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. INV/2026/0089"
                value={vendorInvoiceNumber}
                onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Must be unique for your company in the current financial year.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Invoice Date *
              </label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Currency
              </label>
              <input
                type="text"
                disabled
                value={currency}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Remarks & Payment Reference Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Delivery completed under Challan #CH-8821"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Section 2: Invoicing Lines */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                2. Invoiced Line Items
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quantities default to remaining accepted receipt balances.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left">Line # / Description</th>
                  <th className="px-3 py-3 text-right">Max Available</th>
                  <th className="px-3 py-3 text-right w-32">Invoice Qty</th>
                  <th className="px-3 py-3 text-right">Unit Price</th>
                  <th className="px-3 py-3 text-right">Tax Rate</th>
                  <th className="px-3 py-3 text-right">Tax Amount</th>
                  <th className="px-3 py-3 text-right">Line Total</th>
                  <th className="py-3 pl-2 pr-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Please select a Purchase Order above to populate available line items.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, idx) => (
                    <tr key={line.po_line_id} className="hover:bg-slate-50/50">
                      <td className="py-3 pl-4 pr-3">
                        <div className="font-semibold text-slate-900">Line {line.line_number}</div>
                        <div className="text-slate-500 max-w-[220px] truncate">{line.item_description}</div>
                      </td>

                      <td className="px-3 py-3 text-right font-mono text-slate-500">
                        {line.max_quantity.toFixed(2)}
                      </td>

                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={line.max_quantity * 1.05}
                          value={line.quantity}
                          onChange={(e) => updateLineQty(idx, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-right font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="px-3 py-3 text-right font-mono text-slate-900">
                        {currency} {line.unit_price.toFixed(2)}
                      </td>

                      <td className="px-3 py-3 text-right font-mono text-slate-600">
                        {line.tax_rate.toFixed(2)}%
                      </td>

                      <td className="px-3 py-3 text-right font-mono text-slate-600">
                        {currency} {line.tax_amount.toFixed(2)}
                      </td>

                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                        {currency} {line.line_total.toFixed(2)}
                      </td>

                      <td className="py-3 pl-2 pr-4 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          {lines.length > 0 && (
            <div className="bg-slate-50/80 p-5 border-t border-slate-100 flex flex-col sm:flex-row justify-end items-center gap-6">
              <div className="space-y-1.5 text-right w-full sm:w-72 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {currency} {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST / Tax Amount:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {currency} {totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm font-bold text-slate-900">
                  <span>Grand Total:</span>
                  <span className="font-mono text-indigo-600">
                    {currency} {grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/invoices"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitMutation.isPending || lines.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitMutation.isPending ? "Submitting Invoice..." : "Submit Tax Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
