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
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <svg className="w-3.5 h-3.5 mr-1 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Payment Settled
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <svg className="w-3.5 h-3.5 mr-1 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Scheduled Run
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Processing via Bank
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Payment Pending
          </span>
        );
    }
  };

  return (
    <div className={`bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-5 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-900">Payment Schedule & TDS</h3>
            {getStatusBadge(paymentRecord?.status || invoice.payment_status)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Settlement terms, statutory tax deductions, and bank disbursement timeline.
          </p>
        </div>

        {dueDate && (
          <div className="text-right">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Payment Due Date
            </span>
            <div className="flex items-center sm:justify-end gap-2 mt-0.5">
              <span className="text-sm font-semibold text-slate-900">
                {dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              {isOverdue ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800">
                  {Math.abs(daysDiff)}d Overdue
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  In {daysDiff} days
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Business Day indicator */}
      <div className="bg-sky-50/60 rounded-xl p-3.5 border border-sky-100/80 flex items-start gap-3">
        <svg className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-xs text-sky-800">
          <span className="font-semibold">Business Day Calendar Active: </span>
          Payment due dates are automatically pushed to the next active banking day if the net term lands on a weekend or statutory public holiday.
        </div>
      </div>

      {/* Financial calculations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100">
          <span className="text-xs text-slate-500 font-medium">Gross Invoiced Amount</span>
          <p className="text-base font-bold text-slate-900 mt-0.5">
            {currency} {formatCurrency(grossAmount)}
          </p>
        </div>

        <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-800 font-medium">TDS Withholding</span>
            <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              Sec 194C / 194J
            </span>
          </div>
          <p className="text-base font-bold text-amber-900 mt-0.5">
            - {currency} {formatCurrency(tdsAmount)}
          </p>
        </div>

        <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100">
          <span className="text-xs text-emerald-800 font-medium">Net Payable Amount</span>
          <p className="text-base font-bold text-emerald-900 mt-0.5">
            {currency} {formatCurrency(netAmount)}
          </p>
        </div>
      </div>

      {/* UTR & Settlement details if settled */}
      {paymentRecord?.utr_number && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Banking UTR Reference</span>
            <p className="font-mono font-bold text-slate-900 mt-0.5">{paymentRecord.utr_number}</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Payment Mode</span>
            <p className="font-semibold text-slate-800 mt-0.5">{paymentRecord.payment_method || "NEFT"}</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Settled Date</span>
            <p className="font-semibold text-slate-800 mt-0.5">{paymentRecord.payment_date}</p>
          </div>
        </div>
      )}
    </div>
  );
}
