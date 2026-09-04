"use client";

import React from "react";

export interface DeliveryLineItem {
  id: string;
  line_number: number;
  item_description: string;
  item_code?: string | null;
  ordered_quantity: string | number;
  unit_price: string | number;
  total_price?: string | number | null;
  open_quantity: string | number;
  received_quantity: string | number;
  invoiced_quantity?: string | number;
  delivery_date?: string | null;
}

export interface DeliveryScheduleTableProps {
  lines: DeliveryLineItem[];
  currency?: string;
  className?: string;
}

export function DeliveryScheduleTable({
  lines,
  currency = "INR",
  className = "",
}: DeliveryScheduleTableProps) {
  const formatQty = (qty: string | number | undefined | null) => {
    if (qty === undefined || qty === null) return "0.00";
    const num = typeof qty === "string" ? parseFloat(qty) : qty;
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  const formatCurrency = (amount: string | number | undefined | null) => {
    if (amount === undefined || amount === null) return "0.00";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return isNaN(num) ? "0.00" : num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusBadge = (line: DeliveryLineItem) => {
    const ordered = parseFloat(String(line.ordered_quantity || "0"));
    const received = parseFloat(String(line.received_quantity || "0"));

    if (received >= ordered && ordered > 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
          Fully Received
        </span>
      );
    }
    if (received > 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          Partially Received
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        Pending Delivery
      </span>
    );
  };

  const getFulfillmentPct = (line: DeliveryLineItem) => {
    const ordered = parseFloat(String(line.ordered_quantity || "0"));
    const received = parseFloat(String(line.received_quantity || "0"));
    if (ordered <= 0) return 0;
    return Math.min(100, Math.round((received / ordered) * 100));
  };

  if (!lines || lines.length === 0) {
    return (
      <div className={`p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-500 ${className}`}>
        No delivery schedule lines found.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden border border-slate-200 rounded-lg shadow-sm bg-white ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-700 font-semibold">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">#</th>
              <th scope="col" className="px-4 py-3 text-left">Item Description</th>
              <th scope="col" className="px-4 py-3 text-right">Unit Price ({currency})</th>
              <th scope="col" className="px-4 py-3 text-right">Ordered Qty</th>
              <th scope="col" className="px-4 py-3 text-right">Received Qty</th>
              <th scope="col" className="px-4 py-3 text-right">Open Qty</th>
              <th scope="col" className="px-4 py-3 text-center">Fulfillment</th>
              <th scope="col" className="px-4 py-3 text-left">Delivery Date</th>
              <th scope="col" className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {lines.map((line) => {
              const pct = getFulfillmentPct(line);
              return (
                <tr key={line.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">
                    {line.line_number}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    <div className="font-medium">{line.item_description}</div>
                    {line.item_code && (
                      <div className="text-xs text-slate-500 font-mono">Code: {line.item_code}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-800 whitespace-nowrap">
                    {formatCurrency(line.unit_price)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                    {formatQty(line.ordered_quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-700 whitespace-nowrap">
                    {formatQty(line.received_quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700 whitespace-nowrap">
                    {formatQty(line.open_quantity)}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <div className="w-24 mx-auto">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            pct >= 100 ? "bg-green-600" : pct > 0 ? "bg-amber-500" : "bg-slate-300"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {line.delivery_date ? new Date(line.delivery_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {getStatusBadge(line)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
