"use client";

import React from "react";

export interface PaymentScheduleInvoiceData {
  id: string;
  total_amount: number | string;
  tds_amount?: number | string | null;
  due_date?: string | null;
  currency?: string;
  payment_status?: string;
}

export interface PaymentScheduleRecordData {
  gross_amount?: number | string | null;
  tds_amount?: number | string | null;
  net_amount?: number | string | null;
  payment_due_date?: string | null;
  status?: string;
  utr_number?: string | null;
  payment_method?: string | null;
  payment_date?: string | null;
}

export interface PaymentScheduleProps {
  invoice: PaymentScheduleInvoiceData;
  paymentRecord?: PaymentScheduleRecordData | null;
  className?: string;
}

export function PaymentSchedule({
  invoice,
  paymentRecord,
  className = "",
}: PaymentScheduleProps) {
  const grossAmount = Number(paymentRecord?.gross_amount || invoice.total_amount || 0);
  const tdsAmount = Number(paymentRecord?.tds_amount || invoice.tds_amount || 0);
  const netAmount = Number(paymentRecord?.net_amount || (grossAmount - tdsAmount) || 0);
  const currency = invoice.currency || "INR";

  const dueDateStr = paymentRecord?.payment_due_date || invoice.due_date;
  const dueDate = dueDateStr ? new Date(dueDateStr) : null;
  const today = new Date();

  let daysDiff = 0;
  let isOverdue = false;
  if (dueDate) {
    const diffTime = dueDate.getTime() - today.getTime();
    daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isOverdue = daysDiff < 0 && invoice.payment_status !== "COMPLETED" && invoice.payment_status !== "PAID";
  }

  const formatCurrency = (val: number) => {
    return val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusBadge = (status?: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
      case "PAID":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <svg className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Payment Settled
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <svg className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Scheduled Run
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Processing via Bank
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/15">
            Payment Pending
          </span>
        );
    }
  };

  return (
    <div className={`bg-white/80 dark:bg-[#1C1C1F] backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/15 p-5 shadow-sm space-y-5 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Payment Schedule & TDS</h3>
            {getStatusBadge(paymentRecord?.status || invoice.payment_status)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Settlement terms, statutory tax deductions, and bank disbursement timeline.
          </p>
        </div>

        {dueDate && (
          <div className="text-right">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Payment Due Date
            </span>
            <div className="flex items-center sm:justify-end gap-2 mt-0.5">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              {isOverdue ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                  {Math.abs(daysDiff)}d Overdue
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                  In {daysDiff} days
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Business Day indicator */}
      <div className="bg-sky-50/60 dark:bg-sky-950/30 rounded-xl p-3.5 border border-sky-100/80 dark:border-sky-900/40 flex items-start gap-3">
        <svg className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-xs text-sky-800 dark:text-sky-300">
          <span className="font-semibold">Business Day Calendar Active: </span>
          Payment due dates are automatically pushed to the next active banking day if the net term lands on a weekend or statutory public holiday.
        </div>
      </div>

      {/* Financial calculations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50/70 dark:bg-[#252529] rounded-xl p-3 border border-slate-100 dark:border-white/5">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Gross Invoiced Amount</span>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
            {currency} {formatCurrency(grossAmount)}
          </p>
        </div>

        <div className="bg-amber-50/50 dark:bg-amber-950/30 rounded-xl p-3 border border-amber-100/80 dark:border-amber-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">TDS Withholding</span>
            <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
              Sec 194C / 194J
            </span>
          </div>
          <p className="text-base font-bold text-amber-900 dark:text-amber-200 mt-0.5">
            - {currency} {formatCurrency(tdsAmount)}
          </p>
        </div>

        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl p-3 border border-emerald-100/80 dark:border-emerald-900/40">
          <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Net Payable Amount</span>
          <p className="text-base font-bold text-emerald-900 dark:text-emerald-200 mt-0.5">
            {currency} {formatCurrency(netAmount)}
          </p>
        </div>
      </div>

      {/* UTR & Settlement details if settled */}
      {paymentRecord?.utr_number && (
        <div className="bg-slate-50 dark:bg-[#252529] rounded-xl p-4 border border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-medium">Banking UTR Reference</span>
            <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">{paymentRecord.utr_number}</p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-medium">Payment Mode</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{paymentRecord.payment_method || "NEFT"}</p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-medium">Settled Date</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{paymentRecord.payment_date}</p>
          </div>
        </div>
      )}
    </div>
  );
}
