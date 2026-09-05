"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useVendors,
  useBusinessUnits,
  useCategories,
  useUoms,
  useCurrencies,
  usePaymentTerms,
  useDeliveryLocations,
  useCreatePurchaseOrder,
  POCreateRequest,
} from "@procurement/hooks";
import {
  ArrowLeft,
  Package,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  DollarSign,
  Building,
  Truck,
} from "lucide-react";

interface POLineItemForm {
  item_description: string;
  item_code: string;
  uom_id: string;
  ordered_quantity: number;
  unit_price: number;
  tax_rate: number;
  hsn_code: string;
  delivery_date: string;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const createPoMutation = useCreatePurchaseOrder();

  // Master Data
  const { data: vendorData, isLoading: isLoadingVendors } = useVendors({ page_size: 100 });
  const vendors = vendorData?.vendors || [];
  const { data: businessUnits = [], isLoading: isLoadingBUs } = useBusinessUnits();
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();
  const { data: uoms = [] } = useUoms();
  const { data: currencies = [] } = useCurrencies();
  const { data: paymentTerms = [] } = usePaymentTerms();
  const { data: deliveryLocations = [] } = useDeliveryLocations();

  // Form State
  const [title, setTitle] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [paymentTermId, setPaymentTermId] = useState("");
  const [deliveryLocationId, setDeliveryLocationId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Line items
  const [lines, setLines] = useState<POLineItemForm[]>([
    {
      item_description: "",
      item_code: "",
      uom_id: "",
      ordered_quantity: 1,
      unit_price: 0,
      tax_rate: 18,
      hsn_code: "",
      delivery_date: "",
    },
  ]);

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        item_description: "",
        item_code: "",
        uom_id: uoms[0]?.id || "",
        ordered_quantity: 1,
        unit_price: 0,
        tax_rate: 18,
        hsn_code: "",
        delivery_date: expectedDeliveryDate || "",
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof POLineItemForm, value: any) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Calculations
  const subtotal = lines.reduce((acc, line) => {
    const qty = Number(line.ordered_quantity) || 0;
    const price = Number(line.unit_price) || 0;
    return acc + qty * price;
  }, 0);

  const totalTax = lines.reduce((acc, line) => {
    const qty = Number(line.ordered_quantity) || 0;
    const price = Number(line.unit_price) || 0;
    const tax = Number(line.tax_rate) || 0;
    return acc + (qty * price * tax) / 100;
  }, 0);

  const grandTotal = subtotal + totalTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("Please enter a purchase order title.");
      return;
    }
    if (!vendorId) {
      setErrorMsg("Please select a vendor.");
      return;
    }
    if (!businessUnitId) {
      setErrorMsg("Please select a business unit.");
      return;
    }
    if (!categoryId) {
      setErrorMsg("Please select a category.");
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.item_description.trim()) {
        setErrorMsg(`Line #${i + 1}: Item description is required.`);
        return;
      }
      if (!line.uom_id) {
        setErrorMsg(`Line #${i + 1}: Unit of Measure (UOM) is required.`);
        return;
      }
      if (Number(line.ordered_quantity) <= 0) {
        setErrorMsg(`Line #${i + 1}: Quantity must be greater than 0.`);
        return;
      }
      if (Number(line.unit_price) <= 0) {
        setErrorMsg(`Line #${i + 1}: Unit price must be greater than 0.`);
        return;
      }
    }

    const payload: POCreateRequest = {
      title: title.trim(),
      vendor_id: vendorId,
      business_unit_id: businessUnitId,
      category_id: categoryId,
      currency,
      payment_term_id: paymentTermId || undefined,
      delivery_location_id: deliveryLocationId || undefined,
      expected_delivery_date: expectedDeliveryDate || undefined,
      po_type: "STANDARD",
      lines: lines.map((l) => ({
        item_description: l.item_description.trim(),
        item_code: l.item_code.trim() || undefined,
        uom_id: l.uom_id,
        ordered_quantity: Number(l.ordered_quantity),
        unit_price: Number(l.unit_price),
        tax_rate: Number(l.tax_rate) || 0,
        hsn_code: l.hsn_code.trim() || undefined,
        delivery_date: l.delivery_date || undefined,
      })),
    };

    try {
      const createdPo = await createPoMutation.mutateAsync(payload);
      router.push(`/purchase-orders/${createdPo.id}`);
    } catch (err: any) {
      const detail =
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to create purchase order";
      setErrorMsg(detail);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Back Link */}
      <div className="flex items-center gap-2">
        <Link
          href="/purchase-orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Purchase Orders
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Purchase Order</h1>
          <p className="text-sm text-slate-500 mt-1">
            Issue a formal purchase order to an approved vendor with line items, terms, and delivery schedules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/purchase-orders"
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={createPoMutation.isPending}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-colors"
          >
            {createPoMutation.isPending ? "Creating Purchase Order..." : "Create Draft PO"}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold">Validation Error</h4>
            <p className="mt-0.5 text-xs text-rose-700">{errorMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Primary Information */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-600" />
            General Information & Header
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Purchase Order Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Procurement of High-Performance Laptops & Workstations - Q3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Vendor / Supplier *
              </label>
              <select
                required
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Select Vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.company_name} {v.vendor_code ? `(${v.vendor_code})` : ""} - {v.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Business Unit *
              </label>
              <select
                required
                value={businessUnitId}
                onChange={(e) => setBusinessUnitId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Select Business Unit</option>
                {businessUnits.map((bu: any) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.name} ({bu.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Select Category</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {currencies.length > 0 ? (
                  currencies.map((curr: any) => (
                    <option key={curr.id || curr.code} value={curr.code}>
                      {curr.code} - {curr.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Payment Terms
              </label>
              <select
                value={paymentTermId}
                onChange={(e) => setPaymentTermId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Select Payment Terms</option>
                {paymentTerms.map((pt: any) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.code} - {pt.name} ({pt.days} days)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Delivery Location
              </label>
              <select
                value={deliveryLocationId}
                onChange={(e) => setDeliveryLocationId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Select Delivery Location</option>
                {deliveryLocations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.city}, {loc.state})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => {
                  setExpectedDeliveryDate(e.target.value);
                  setLines((prev) =>
                    prev.map((l) => (l.delivery_date ? l : { ...l, delivery_date: e.target.value }))
                  );
                }}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                Line Items & Pricing Schedule ({lines.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Specify items, ordered quantities, unit rates, applicable GST rates, and delivery dates.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddLine}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Line Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 w-8">#</th>
                  <th className="px-3 py-3 min-w-[200px]">Item Description *</th>
                  <th className="px-3 py-3 w-28">Item Code</th>
                  <th className="px-3 py-3 w-28">UOM *</th>
                  <th className="px-3 py-3 w-24 text-right">Quantity *</th>
                  <th className="px-3 py-3 w-28 text-right">Unit Price ({currency}) *</th>
                  <th className="px-3 py-3 w-24 text-right">Tax %</th>
                  <th className="px-3 py-3 w-28">HSN Code</th>
                  <th className="px-3 py-3 w-32">Delivery Date</th>
                  <th className="px-3 py-3 w-28 text-right">Line Total</th>
                  <th className="px-2 py-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => {
                  const lineTotal =
                    (Number(line.ordered_quantity) || 0) *
                    (Number(line.unit_price) || 0) *
                    (1 + (Number(line.tax_rate) || 0) / 100);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          required
                          placeholder="Item name & specifications"
                          value={line.item_description}
                          onChange={(e) => handleLineChange(idx, "item_description", e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          placeholder="SKU-100"
                          value={line.item_code}
                          onChange={(e) => handleLineChange(idx, "item_code", e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          required
                          value={line.uom_id}
                          onChange={(e) => handleLineChange(idx, "uom_id", e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="">Select</option>
                          {uoms.map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.code} ({u.name})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={line.ordered_quantity}
                          onChange={(e) => handleLineChange(idx, "ordered_quantity", Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-right font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={line.unit_price}
                          onChange={(e) => handleLineChange(idx, "unit_price", Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-right font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={line.tax_rate}
                          onChange={(e) => handleLineChange(idx, "tax_rate", Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-right font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          placeholder="8471"
                          value={line.hsn_code}
                          onChange={(e) => handleLineChange(idx, "hsn_code", e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="date"
                          value={line.delivery_date}
                          onChange={(e) => handleLineChange(idx, "delivery_date", e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-800">
                        {lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          disabled={lines.length <= 1}
                          onClick={() => handleRemoveLine(idx)}
                          className="text-slate-400 hover:text-rose-600 disabled:opacity-30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <div className="w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal (Net):</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {currency} {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Estimated Taxes (GST):</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {currency} {totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total PO Value:</span>
                <span className="font-mono text-indigo-700">
                  {currency} {grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/purchase-orders"
            className="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createPoMutation.isPending}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 transition-colors"
          >
            {createPoMutation.isPending ? "Creating Purchase Order..." : "Create Purchase Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
