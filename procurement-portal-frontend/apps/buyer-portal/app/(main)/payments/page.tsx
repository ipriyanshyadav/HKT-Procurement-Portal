"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { usePayments, useProcessPayment, useDownloadRemittancePDF } from "@procurement/hooks";
import type { PaymentRecordResponse } from "@procurement/types";
import {
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Copy,
  Check,
  Send,
  Building,
  Receipt,
  DollarSign,
  ArrowUpRight,
  ShieldAlert,
  Download,
  X,
} from "lucide-react";

export default function BuyerPaymentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Modal state
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecordResponse | null>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("NEFT");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [erpRef, setErpRef] = useState("");
  const [processError, setProcessError] = useState<string | null>(null);

  const { data: payments = [], isLoading, isError, refetch } = usePayments({
    status: statusFilter || undefined,
  });

  const processMutation = useProcessPayment();
  const downloadRemittanceMutation = useDownloadRemittancePDF();

  const handleDownloadRemittance = async (paymentId: string) => {
    try {
      await downloadRemittanceMutation.mutateAsync(paymentId);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to download remittance advice PDF");
    }
  };

  const [downloadingBatch, setDownloadingBatch] = useState(false);

  const handleDownloadBankBatch = () => {
    try {
      setDownloadingBatch(true);
      const pendingPayments = payments.filter((p) =>
        ["SCHEDULED", "PENDING", "PROCESSING"].includes(p.status?.toUpperCase() || "")
      );
      const paymentsToExport = pendingPayments.length > 0 ? pendingPayments : filteredPayments;

      if (paymentsToExport.length === 0) {
        alert("No payments available for bank batch export.");
        return;
      }

      const headers = [
        "Payment_ID",
        "Value_Date",
        "Beneficiary_Name",
        "Vendor_ID",
        "Net_Amount",
        "Gross_Amount",
        "TDS_Deduction",
        "Currency",
        "Payment_Mode",
        "Customer_Reference",
        "Invoice_Number",
        "Status",
        "Remarks",
      ];

      const rows = paymentsToExport.map((p) => [
        p.id,
        p.payment_due_date || p.payment_date || new Date().toISOString().split("T")[0],
        `"${(p.vendor_name || "Vendor").replace(/"/g, '""')}"`,
        p.vendor_id,
        Number(p.net_amount || p.amount || 0).toFixed(2),
        Number(p.gross_amount || p.amount || 0).toFixed(2),
        Number(p.tds_amount || 0).toFixed(2),
        p.currency || "INR",
        p.payment_method || "NEFT",
        p.erp_payment_reference || p.id.slice(0, 12),
        p.invoice_number || "",
        p.status,
        `"Payment for Invoice ${p.invoice_number || p.id.slice(0, 8)}"`,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
      link.setAttribute("href", url);
      link.setAttribute("download", `Bank_Payment_Batch_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to export bank payment batch file.");
    } finally {
      setDownloadingBatch(false);
    }
  };

  // Filter payments by search and method
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (p.utr_number && p.utr_number.toLowerCase().includes(q)) ||
        (p.invoice_number && p.invoice_number.toLowerCase().includes(q)) ||
        (p.vendor_name && p.vendor_name.toLowerCase().includes(q)) ||
        (p.erp_payment_reference && p.erp_payment_reference.toLowerCase().includes(q));

      const matchesMethod = !methodFilter || p.payment_method === methodFilter;

      return matchesSearch && matchesMethod;
    });
  }, [payments, search, methodFilter]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    let totalDisbursed = 0;
    let scheduledAmount = 0;
    let totalTds = 0;
    let completedCount = 0;
    let scheduledCount = 0;

    for (const p of payments) {
      const net = Number(p.net_amount || p.amount || 0);
      const tds = Number(p.tds_amount || 0);
      totalTds += tds;

      if (p.status === "COMPLETED" || p.status === "PAID") {
        totalDisbursed += net;
        completedCount++;
      } else if (p.status === "SCHEDULED" || p.status === "PROCESSING") {
        scheduledAmount += net;
        scheduledCount++;
      }
    }

    return {
      totalDisbursed,
      scheduledAmount,
      totalTds,
      completedCount,
      scheduledCount,
      totalTransactions: payments.length,
    };
  }, [payments]);

  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const openProcessModal = (payment: PaymentRecordResponse) => {
    setSelectedPayment(payment);
    setUtrNumber("");
    setPaymentMethod("NEFT");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setErpRef("");
    setProcessError(null);
  };

  const closeProcessModal = () => {
    setSelectedPayment(null);
    setProcessError(null);
  };

  const handleProcessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    if (!utrNumber.trim()) {
      setProcessError("Please enter a valid Banking UTR or Transaction Reference.");
      return;
    }

    try {
      setProcessError(null);
      await processMutation.mutateAsync({
        id: selectedPayment.id,
        data: {
          utr_number: utrNumber.trim(),
          payment_method: paymentMethod,
          payment_date: paymentDate,
          erp_payment_reference: erpRef.trim() || null,
        },
      });
      closeProcessModal();
      refetch();
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.message || "Failed to process payment disbursement";
      setProcessError(message);
    }
  };

  const formatCurrency = (val: string | number | undefined | null, curr = "INR") => {
    if (val === undefined || val === null) return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "—" : `${curr} ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
      case "PAID":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Settled / Disbursed
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Clock className="w-3.5 h-3.5 mr-1 text-sky-600" />
            Scheduled
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Processing
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Failed
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <CreditCard className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Disbursements & Payment Ledger
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Bank remittance tracking, statutory TDS withholding (Sec 194C/J), and UTR settlement records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadBankBatch}
            disabled={downloadingBatch}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download Bank Payment File (.csv)
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Disbursed</span>
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300 mt-2">
            ₹{kpis.totalDisbursed.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">{kpis.completedCount} settled disbursements</span>
        </div>

        <div className="bg-sky-50/50 dark:bg-sky-950/30 backdrop-blur-md p-4 rounded-2xl border border-sky-200/80 dark:border-sky-800/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">Scheduled / Due</span>
            <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-sky-900 dark:text-sky-200 mt-2">
            ₹{kpis.scheduledAmount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <span className="text-xs text-sky-600 dark:text-sky-400 mt-0.5 block">{kpis.scheduledCount} pending bank execution</span>
        </div>

        <div className="bg-amber-50/50 dark:bg-amber-950/30 backdrop-blur-md p-4 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">TDS Deducted</span>
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-2">
            ₹{kpis.totalTds.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <span className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 block">Statutory withholding (Sec 194C/J)</span>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Transactions</span>
            <Receipt className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{kpis.totalTransactions}</p>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">Total disbursement entries</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search by UTR, invoice #, vendor, ERP ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Settlement Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Settled / Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Payment Modes</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="ACH">ACH</option>
            <option value="WIRE">WIRE</option>
            <option value="CHEQUE">CHEQUE</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading payment records...</span>
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-rose-500 flex flex-col items-center gap-2">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <span className="text-sm font-medium">Failed to load payment ledger.</span>
            <button
              onClick={() => refetch()}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline mt-1"
            >
              Try again
            </button>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500">
            <CreditCard className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No payment records found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Payments are automatically scheduled upon approving 3-way matched invoices.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left">UTR / Reference</th>
                  <th className="px-3 py-3.5 text-left">Invoice #</th>
                  <th className="px-3 py-3.5 text-left">Vendor</th>
                  <th className="px-3 py-3.5 text-right">Gross Amount</th>
                  <th className="px-3 py-3.5 text-right">TDS (2%)</th>
                  <th className="px-3 py-3.5 text-right">Net Payable</th>
                  <th className="px-3 py-3.5 text-left">Due Date</th>
                  <th className="px-3 py-3.5 text-left">Settled Date</th>
                  <th className="px-3 py-3.5 text-center">Mode</th>
                  <th className="px-3 py-3.5 text-center">Status</th>
                  <th className="py-3.5 pl-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/40">
                {filteredPayments.map((p) => {
                  const isScheduled = p.status === "SCHEDULED";
                  const gross = Number(p.gross_amount || p.amount || 0);
                  const tds = Number(p.tds_amount || 0);
                  const net = Number(p.net_amount || (gross - tds) || 0);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      {/* UTR / Reference */}
                      <td className="py-3.5 pl-4 pr-3">
                        {p.utr_number ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              {p.utr_number}
                            </span>
                            <button
                              onClick={() => handleCopyUtr(p.utr_number!)}
                              title="Copy UTR"
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
                            >
                              {copiedUtr === p.utr_number ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 italic">
                            Pending Settlement
                          </span>
                        )}
                        {p.erp_payment_reference && (
                          <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                            ERP: {p.erp_payment_reference}
                          </span>
                        )}
                      </td>

                      {/* Invoice */}
                      <td className="px-3 py-3.5">
                        <Link
                          href={`/invoices/${p.invoice_id}`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 group"
                        >
                          {p.invoice_number || "View Invoice"}
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>

                      {/* Vendor */}
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium max-w-[160px] truncate">
                          <Building className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span className="truncate">{p.vendor_name || "—"}</span>
                        </div>
                      </td>

                      {/* Gross Amount */}
                      <td className="px-3 py-3.5 text-right font-medium text-slate-600 dark:text-slate-400">
                        {formatCurrency(gross, p.currency)}
                      </td>

                      {/* TDS (2%) */}
                      <td className="px-3 py-3.5 text-right font-medium text-amber-700 dark:text-amber-400">
                        {tds > 0 ? `- ${formatCurrency(tds, p.currency)}` : "—"}
                      </td>

                      {/* Net Payable */}
                      <td className="px-3 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                        {formatCurrency(net, p.currency)}
                      </td>

                      {/* Due Date */}
                      <td className="px-3 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {p.payment_due_date ? (
                          <span>
                            {new Date(p.payment_due_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Settled Date */}
                      <td className="px-3 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {p.payment_date && p.status === "COMPLETED" ? (
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {new Date(p.payment_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="px-3 py-3.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {p.payment_method || "NEFT"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {getStatusBadge(p.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isScheduled ? (
                            <button
                              onClick={() => openProcessModal(p)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                            >
                              <Send className="w-3 h-3" />
                              Record UTR
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleDownloadRemittance(p.id)}
                                disabled={downloadRemittanceMutation.isPending}
                                title="Download Remittance Advice PDF"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
                              >
                                <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                Remittance PDF
                              </button>
                              <Link
                                href={`/invoices/${p.invoice_id}`}
                                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium"
                              >
                                Details →
                              </Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Process Payment / Record UTR Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Execute Disbursement
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Record bank transfer reference (UTR) to mark invoice as paid.
                </p>
              </div>
              <button
                type="button"
                onClick={closeProcessModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Summary Box */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Invoice Reference:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedPayment.invoice_number || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Beneficiary Vendor:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedPayment.vendor_name || "—"}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 my-2 pt-2 flex justify-between text-slate-600 dark:text-slate-400">
                <span>Gross Invoice Amount:</span>
                <span>{formatCurrency(selectedPayment.gross_amount || selectedPayment.amount, selectedPayment.currency)}</span>
              </div>
              <div className="flex justify-between text-amber-700 dark:text-amber-400">
                <span>Less: TDS Deducted (Sec 194C/J):</span>
                <span>- {formatCurrency(selectedPayment.tds_amount, selectedPayment.currency)}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                <span>Net Disbursement Amount:</span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(
                    selectedPayment.net_amount ||
                      Number(selectedPayment.amount || 0) - Number(selectedPayment.tds_amount || 0),
                    selectedPayment.currency
                  )}
                </span>
              </div>
            </div>

            {/* Error Message if any */}
            {processError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{processError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleProcessSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Bank UTR / Transaction Reference <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTR982341209384"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                  Unique Transaction Reference issued by the clearing bank.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Payment Mode</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="ACH">ACH</option>
                    <option value="WIRE">WIRE</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Disbursement Date</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">ERP Disbursement Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SAP-PAY-2026-991"
                  value={erpRef}
                  onChange={(e) => setErpRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeProcessModal}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {processMutation.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Confirm Disbursement
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
