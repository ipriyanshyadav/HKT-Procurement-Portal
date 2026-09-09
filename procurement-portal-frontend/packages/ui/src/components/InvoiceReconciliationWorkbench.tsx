"use client";

import React, { useState } from "react";
import {
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sliders,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  Scale,
  Sparkles,
} from "lucide-react";
import {
  useInvoices,
  useReconciliationDashboard,
  usePerformReconciliation,
  useApproveInvoice,
  useDisputeInvoice,
} from "@procurement/hooks";
import type {
  InvoiceResponse,
  AdvancedReconciliationResponse,
} from "@procurement/types";

export function InvoiceReconciliationWorkbench() {
  // Configurable tolerance & match controls
  const [matchMode, setMatchMode] = useState<"THREE_WAY" | "FOUR_WAY">("FOUR_WAY");
  const [priceTolerance, setPriceTolerance] = useState<number>(2.0);
  const [qtyTolerance, setQtyTolerance] = useState<number>(5.0);
  const [autoApprove, setAutoApprove] = useState<boolean>(true);

  // Selected invoice & reconciliation results
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceResponse | null>(null);
  const [reconcileResult, setReconcileResult] = useState<AdvancedReconciliationResponse | null>(null);
  const [disputeNote, setDisputeNote] = useState<string>("");
  const [isDisputing, setIsDisputing] = useState<boolean>(false);

  // Queries & Mutations
  const { data: dashboardStats, isLoading: loadingStats, refetch: refetchStats } = useReconciliationDashboard();
  const { data: invoices = [], isLoading: loadingInvoices, refetch: refetchInvoices } = useInvoices();
  const reconcileMutation = usePerformReconciliation();
  const approveMutation = useApproveInvoice();
  const disputeMutation = useDisputeInvoice();

  const handleRunReconcile = async (invoice: InvoiceResponse) => {
    setSelectedInvoice(invoice);
    try {
      const result = await reconcileMutation.mutateAsync({
        invoiceId: invoice.id,
        payload: {
          match_mode: matchMode,
          price_tolerance_pct: priceTolerance,
          quantity_tolerance_pct: qtyTolerance,
          auto_approve_if_matched: autoApprove,
        },
      });
      setReconcileResult(result);
      refetchStats();
      refetchInvoices();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async () => {
    if (!selectedInvoice) return;
    await approveMutation.mutateAsync(selectedInvoice.id);
    refetchInvoices();
    refetchStats();
  };

  const handleRaiseDispute = async () => {
    if (!selectedInvoice) return;
    await disputeMutation.mutateAsync({
      id: selectedInvoice.id,
      data: {
        reason_code: "PRICE_QUANTITY_VARIANCE",
        description: disputeNote || `Reconciliation variance detected. Suggested credit note: ₹${reconcileResult?.suggested_credit_note_total?.toLocaleString() ?? 0}`,
      },
    });
    setIsDisputing(false);
    setDisputeNote("");
    refetchInvoices();
    refetchStats();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Automated 3-Way & 4-Way Invoice Reconciliation
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                PO ↔ GRN Dock Receipts ↔ Quality Inspection ↔ Vendor Invoices with automated credit note suggestions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchStats();
              refetchInvoices();
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Metrics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-sm">
            <span>Reconciliation Rate</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {dashboardStats?.match_rate_pct ?? 100}%
            </span>
            <span className="text-xs text-emerald-600 font-medium">auto-match benchmark</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {dashboardStats?.fully_matched_count ?? 0} of {dashboardStats?.total_invoices ?? 0} invoices cleared
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-sm">
            <span>Total Matched Value</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              ₹{(dashboardStats?.total_matched_value ?? 0).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">Cleared for payment scheduling</p>
        </div>

        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-sm">
            <span>Discrepancies Flagged</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {dashboardStats?.discrepancy_count ?? 0}
            </span>
            <span className="text-xs text-amber-600 font-medium">requires review</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">Rate variance or dock rejection</p>
        </div>

        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-sm">
            <span>Value At Risk</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-bold text-rose-600 dark:text-rose-400">
              ₹{(dashboardStats?.total_at_risk_value ?? 0).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">Held pending dispute / credit memo</p>
        </div>
      </div>

      {/* Reconciliation Engine Configuration Panel */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
            Tolerances & Match Rules
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">Mode:</span>
            <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setMatchMode("THREE_WAY")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  matchMode === "THREE_WAY"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                3-Way Match
              </button>
              <button
                type="button"
                onClick={() => setMatchMode("FOUR_WAY")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  matchMode === "FOUR_WAY"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                4-Way (+ QC Dock)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">Price Tolerance:</span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="20"
              value={priceTolerance}
              onChange={(e) => setPriceTolerance(parseFloat(e.target.value) || 0)}
              className="w-16 px-2 py-1 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-center"
            />
            <span className="text-xs text-gray-500">%</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">Qty Tolerance:</span>
            <input
              type="number"
              step="1"
              min="0"
              max="50"
              value={qtyTolerance}
              onChange={(e) => setQtyTolerance(parseFloat(e.target.value) || 0)}
              className="w-16 px-2 py-1 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-center"
            />
            <span className="text-xs text-gray-500">%</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            Auto-Approve within tolerance
          </label>
        </div>
      </div>

      {/* Main Split Layout: Invoices Table & Split Reconciliation Workbench */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Invoices List Panel (5 cols) */}
        <div className="xl:col-span-4 space-y-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="font-bold text-gray-900 dark:text-gray-100 text-sm mb-3">
              Invoices Queue ({invoices.length})
            </h2>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {loadingInvoices ? (
                <div className="p-8 text-center text-sm text-gray-400">Loading invoices...</div>
              ) : invoices.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">No invoices submitted yet.</div>
              ) : (
                invoices.map((inv) => {
                  const isSelected = selectedInvoice?.id === inv.id;
                  const isMatched = inv.match_status === "MATCHED";
                  const isDiscrepant = inv.match_status === "DISCREPANCY";

                  return (
                    <div
                      key={inv.id}
                      onClick={() => handleRunReconcile(inv)}
                      className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-500"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          {inv.invoice_number}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isMatched
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : isDiscrepant
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          {inv.match_status || "PENDING"}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Vendor:</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {inv.vendor_name || inv.vendor_id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>PO Ref:</span>
                          <span className="font-mono text-gray-600 dark:text-gray-400">
                            {inv.po_number || inv.po_id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 font-semibold text-gray-900 dark:text-gray-100">
                          <span>Amount:</span>
                          <span>₹{inv.total_amount?.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunReconcile(inv);
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                          Reconcile
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Split Reconciliation Workbench (7 cols) */}
        <div className="xl:col-span-8 space-y-4">
          {!selectedInvoice ? (
            <div className="h-full min-h-[450px] flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
              <GitCompare className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">
                Select an invoice to launch the Split-Screen Workbench
              </h3>
              <p className="text-xs text-gray-400 max-w-md mt-1">
                The engine will perform line-by-line price variance analysis, dock receipt quantity checks, and dock quality inspection rejection deductions.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              {/* Active Inspection Header */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/40">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      Reconciliation: {selectedInvoice.invoice_number}
                    </h2>
                    {reconcileResult && (
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          reconcileResult.overall_status === "FULLY_MATCHED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                        }`}
                      >
                        {reconcileResult.overall_status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Comparing PO #{selectedInvoice.po_number || selectedInvoice.po_id.slice(0, 8)} with GRN Receipts & Quality Inspections
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedInvoice.status !== "APPROVED" && (
                    <button
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve Invoice
                    </button>
                  )}
                  <button
                    onClick={() => setIsDisputing(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Raise Dispute / Credit Note
                  </button>
                </div>
              </div>

              {/* Suggested Credit Note Banner if Discrepancies Found */}
              {reconcileResult && reconcileResult.suggested_credit_note_total > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Discrepancy Detected — Recommended Credit Note: ₹
                        {reconcileResult.suggested_credit_note_total.toLocaleString()}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        Deductions calculated from dock quality rejections and unit price inflations above tolerance.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDisputeNote(
                        `Requesting Credit Note of ₹${reconcileResult.suggested_credit_note_total.toLocaleString()} due to detected line discrepancies and dock rejections.`
                      );
                      setIsDisputing(true);
                    }}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded shadow-sm"
                  >
                    Auto-Fill Dispute
                  </button>
                </div>
              )}

              {/* Line items split-view comparison */}
              <div className="p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Line Items Reconciliation Breakdown
                </h3>

                {reconcileResult?.line_details?.map((line) => {
                  const hasDiscrepancy = line.status === "VARIANCE_DETECTED";

                  return (
                    <div
                      key={line.line_number}
                      className={`p-4 rounded-xl border ${
                        hasDiscrepancy
                          ? "border-rose-300 dark:border-rose-800/80 bg-rose-50/30 dark:bg-rose-950/10"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                            Line #{line.line_number}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {line.item_description}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            hasDiscrepancy
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          }`}
                        >
                          {line.status}
                        </span>
                      </div>

                      {/* Split PO/GRN vs Invoiced Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        {/* Left: PO & Physical Dock Receipts */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg space-y-1.5 text-xs">
                          <span className="font-semibold text-gray-600 dark:text-gray-400 block border-b pb-1 border-gray-200 dark:border-gray-700">
                            PO & Dock Inspection Baseline
                          </span>
                          <div className="flex justify-between">
                            <span className="text-gray-500">PO Contract Rate:</span>
                            <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                              ₹{line.po_unit_price.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">PO Ordered Qty:</span>
                            <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                              {line.po_quantity}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">GRN Dock Received:</span>
                            <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                              {line.grn_received_quantity}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                            <span>QC Accepted Qty:</span>
                            <span>{line.quality_inspected_quantity}</span>
                          </div>
                        </div>

                        {/* Right: Vendor Invoiced Values */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg space-y-1.5 text-xs">
                          <span className="font-semibold text-gray-600 dark:text-gray-400 block border-b pb-1 border-gray-200 dark:border-gray-700">
                            Vendor Invoiced Values
                          </span>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Invoiced Unit Rate:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                                ₹{line.invoice_unit_price.toFixed(2)}
                              </span>
                              {line.price_variance_pct !== 0 && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                    Math.abs(line.price_variance_pct) > priceTolerance
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-gray-200 text-gray-700"
                                  }`}
                                >
                                  {line.price_variance_pct > 0 ? "+" : ""}
                                  {line.price_variance_pct}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Invoiced Quantity:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                                {line.invoice_quantity}
                              </span>
                              {line.quantity_variance_pct !== 0 && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                    Math.abs(line.quantity_variance_pct) > qtyTolerance
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-gray-200 text-gray-700"
                                  }`}
                                >
                                  {line.quantity_variance_pct > 0 ? "+" : ""}
                                  {line.quantity_variance_pct}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-gray-100">
                            <span>Line Total:</span>
                            <span>₹{(line.invoice_quantity * line.invoice_unit_price).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Flagged Reasons */}
                      {line.reasons && line.reasons.length > 0 && (
                        <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-lg text-xs text-rose-800 dark:text-rose-300 space-y-1">
                          {line.reasons.map((reason, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-600" />
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dispute Modal */}
      {isDisputing && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                Raise Dispute & Credit Note Notice
              </h2>
              <button
                onClick={() => setIsDisputing(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              This action will place invoice <strong>{selectedInvoice.invoice_number}</strong> into DISPUTED status, halting payment processing and sending a variance notice to the vendor.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Dispute Notice & Credit Note Justification:
              </label>
              <textarea
                rows={4}
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                placeholder="Explain the variance discrepancy, dock quality rejections, and requested credit note deduction..."
                className="w-full text-xs p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsDisputing(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRaiseDispute}
                disabled={disputeMutation.isPending}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm"
              >
                {disputeMutation.isPending ? "Submitting..." : "Submit Dispute Notice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
