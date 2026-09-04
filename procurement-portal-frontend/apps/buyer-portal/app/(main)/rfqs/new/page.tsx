"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCreateRfq,
  useBusinessUnits,
  useCategories,
  useUoms,
} from "@procurement/hooks";

export default function NewRfqPage() {
  const router = useRouter();
  const createMutation = useCreateRfq();

  const { data: buData } = useBusinessUnits();
  const { data: catData } = useCategories();
  const { data: uomData } = useUoms();

  const businessUnits = (buData as any)?.business_units ?? (buData as any) ?? [];
  const categories = (catData as any)?.categories ?? (catData as any) ?? [];
  const uoms = (uomData as any)?.uoms ?? (uomData as any) ?? [];

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rfqType, setRfqType] = useState("LIMITED_TENDER");
  const [sourcingType, setSourcingType] = useState("GOODS");
  const [evaluationType, setEvaluationType] = useState("L1_PRICE_ONLY");
  const [procurementType, setProcurementType] = useState("OPEX");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [bidValidityDays, setBidValidityDays] = useState(90);
  const [bidCloseAt, setBidCloseAt] = useState("");
  const [isMultiLot, setIsMultiLot] = useState(false);

  // Line items
  const [lines, setLines] = useState<any[]>([
    {
      line_number: 1,
      item_description: "",
      category_id: "",
      uom_id: "",
      quantity: 1,
      estimated_unit_price: 0,
      specifications: "",
    },
  ]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        line_number: prev.length + 1,
        item_description: "",
        category_id: categoryId || "",
        uom_id: "",
        quantity: 1,
        estimated_unit_price: 0,
        specifications: "",
      },
    ]);
  };

  const updateLine = (index: number, field: string, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const estimatedValue = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.estimated_unit_price) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessUnitId || !categoryId || !bidCloseAt) {
      alert("Please fill in Business Unit, Category, and Submission Deadline");
      return;
    }

    try {
      const payload = {
        title,
        description: description || undefined,
        rfq_type: rfqType,
        sourcing_type: sourcingType,
        evaluation_type: evaluationType,
        procurement_type: procurementType,
        business_unit_id: businessUnitId,
        category_id: categoryId,
        currency,
        estimated_value: estimatedValue,
        bid_close_at: new Date(bidCloseAt).toISOString(),
        bid_validity_days: Number(bidValidityDays),
        is_multi_lot: isMultiLot,
        lines: lines.map((l, idx) => ({
          line_number: idx + 1,
          item_description: l.item_description,
          category_id: l.category_id || categoryId,
          uom_id: l.uom_id,
          quantity: Number(l.quantity),
          estimated_unit_price: Number(l.estimated_unit_price),
          specifications: l.specifications || undefined,
        })),
      };

      const result = await createMutation.mutateAsync(payload);
      router.push(`/rfqs/${result.id}`);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to create RFQ");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/rfqs" className="hover:underline">RFQs</Link>
            <span>/</span>
            <span>New RFQ</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Request for Quotation</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/rfqs"
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Save & Continue"}
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
        <h2 className="text-base font-semibold text-gray-900 border-b pb-3">1. General Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">RFQ Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sourcing 500 Developer Laptops for FY26"
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Scope & Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Provide context, commercial parameters, or project scope..."
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">RFQ Tender Type *</label>
            <select
              value={rfqType}
              onChange={(e) => setRfqType(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white"
            >
              <option value="LIMITED_TENDER">Limited Tender (Invited Vendors)</option>
              <option value="OPEN_TENDER">Open Tender (Public)</option>
              <option value="SINGLE_SOURCE">Single Source</option>
              <option value="EMERGENCY">Emergency (Min 24h Window)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Business Unit *</label>
            <select
              required
              value={businessUnitId}
              onChange={(e) => setBusinessUnitId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white"
            >
              <option value="">Select Business Unit</option>
              {businessUnits.map((bu: any) => (
                <option key={bu.id} value={bu.id}>{bu.name} ({bu.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white"
            >
              <option value="">Select Category</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white"
            >
              <option value="INR">INR - Indian Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sourcing Timeline */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
        <h2 className="text-base font-semibold text-gray-900 border-b pb-3">2. Bidding Timeline & Validity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Bid Submission Deadline *
            </label>
            <input
              type="datetime-local"
              required
              value={bidCloseAt}
              onChange={(e) => setBidCloseAt(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5"
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum {rfqType === "EMERGENCY" ? "24 hours" : "72 hours"} from event publication.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Bid Validity (Days) *</label>
            <input
              type="number"
              min={30}
              max={180}
              value={bidValidityDays}
              onChange={(e) => setBidValidityDays(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5"
            />
            <p className="text-xs text-gray-500 mt-1">Between 30 and 180 days.</p>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">3. Items & Deliverables</h2>
            <p className="text-xs text-gray-500 mt-0.5">Define specifications and quantities for supplier bidding.</p>
          </div>
          <button
            type="button"
            onClick={addLine}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 border border-blue-200 rounded-lg bg-blue-50"
          >
            + Add Line Item
          </button>
        </div>

        <div className="space-y-4">
          {lines.map((line, idx) => (
            <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span>Line #{idx + 1}</span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    placeholder="Item description *"
                    value={line.item_description}
                    onChange={(e) => updateLine(idx, "item_description", e.target.value)}
                    className="w-full text-sm border rounded-lg p-2 bg-white"
                  />
                </div>
                <div>
                  <select
                    required
                    value={line.uom_id}
                    onChange={(e) => updateLine(idx, "uom_id", e.target.value)}
                    className="w-full text-sm border rounded-lg p-2 bg-white"
                  >
                    <option value="">Select UOM *</option>
                    {uoms.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="Quantity *"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                    className="w-full text-sm border rounded-lg p-2 bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Estimated Unit Price (₹)"
                    value={line.estimated_unit_price}
                    onChange={(e) => updateLine(idx, "estimated_unit_price", e.target.value)}
                    className="w-full text-sm border rounded-lg p-2 bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Technical specifications (optional)"
                    value={line.specifications}
                    onChange={(e) => updateLine(idx, "specifications", e.target.value)}
                    className="w-full text-sm border rounded-lg p-2 bg-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 text-sm font-semibold text-gray-900">
          Total Estimated Value: ₹{estimatedValue.toLocaleString("en-IN")}
        </div>
      </div>
    </form>
  );
}
