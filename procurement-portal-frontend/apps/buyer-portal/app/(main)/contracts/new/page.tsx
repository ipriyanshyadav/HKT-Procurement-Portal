"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCreateContract,
  useVendors,
  useCategories,
  useBusinessUnits,
  useUoms,
  usePaymentTerms,
  useIncoterms,
} from "@procurement/hooks";
import {
  FileCheck,
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
} from "lucide-react";

interface LineRow {
  item_description: string;
  uom_id: string;
  contracted_quantity: number;
  unit_rate: number;
  hsn_code: string;
}

interface MilestoneRow {
  title: string;
  description: string;
  due_date: string;
  responsible_party: "BUYER" | "VENDOR";
  milestone_weight: number;
}

export default function NewContractPage() {
  const router = useRouter();
  const createContractMutation = useCreateContract();

  // Reference data
  const { data: vendorsData } = useVendors({ page_size: 100 });
  const vendors = vendorsData?.vendors ?? [];
  const { data: categories = [] } = useCategories();
  const { data: businessUnits = [] } = useBusinessUnits();
  const { data: uoms = [] } = useUoms();
  const { data: paymentTerms = [] } = usePaymentTerms();
  const { data: incoterms = [] } = useIncoterms();

  // Basic Details
  const [title, setTitle] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [contractType, setContractType] = useState("RATE_CONTRACT");
  const [currency, setCurrency] = useState("INR");
  const [totalValue, setTotalValue] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentTermId, setPaymentTermId] = useState("");
  const [incotermId, setIncotermId] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [autoRenew, setAutoRenew] = useState(false);
  const [renewalNoticeDays, setRenewalNoticeDays] = useState(30);

  // Line items
  const [lines, setLines] = useState<LineRow[]>([
    {
      item_description: "",
      uom_id: "",
      contracted_quantity: 1,
      unit_rate: 0,
      hsn_code: "",
    },
  ]);

  // Milestones
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const addLine = () => {
    setLines([
      ...lines,
      {
        item_description: "",
        uom_id: uoms[0]?.id || "",
        contracted_quantity: 1,
        unit_rate: 0,
        hsn_code: "",
      },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  const updateLine = (idx: number, field: keyof LineRow, val: any) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      {
        title: "",
        description: "",
        due_date: endDate,
        responsible_party: "BUYER",
        milestone_weight: 10,
      },
    ]);
  };

  const removeMilestone = (idx: number) => {
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const updateMilestone = (idx: number, field: keyof MilestoneRow, val: any) => {
    setMilestones((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!title.trim()) {
      setErrorMsg("Contract title is required.");
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
      setErrorMsg("Please select a procurement category.");
      return;
    }

    const parsedVal = parseFloat(totalValue);
    if (isNaN(parsedVal) || parsedVal <= 0) {
      setErrorMsg("Please enter a valid total contract value.");
      return;
    }

    // Validate lines
    const validLines = lines.map((l, i) => ({
      line_number: i + 1,
      item_description: l.item_description.trim(),
      uom_id: l.uom_id || (uoms[0]?.id as string),
      contracted_quantity: String(l.contracted_quantity || 1),
      unit_rate: String(l.unit_rate || 0),
      hsn_code: l.hsn_code || undefined,
    }));

    for (const line of validLines) {
      if (!line.item_description) {
        setErrorMsg("All line items must have a description.");
        return;
      }
      if (!line.uom_id) {
        setErrorMsg("Please select a valid unit of measure for all lines.");
        return;
      }
    }

    const payload: any = {
      title: title.trim(),
      vendor_id: vendorId,
      contract_type: contractType,
      currency,
      total_value: String(parsedVal),
      start_date: startDate,
      end_date: endDate,
      business_unit_id: businessUnitId,
      category_id: categoryId,
      payment_term_id: paymentTermId || undefined,
      incoterm_id: incotermId || undefined,
      auto_renew: autoRenew,
      renewal_notice_days: renewalNoticeDays,
      lines: validLines,
    };

    if (milestones.length > 0) {
      payload.milestones = milestones.map((m) => ({
        title: m.title.trim(),
        description: m.description || undefined,
        due_date: m.due_date,
        responsible_party: m.responsible_party,
        milestone_weight: String(m.milestone_weight),
      }));
    }

    try {
      const created = await createContractMutation.mutateAsync(payload);
      router.push(`/contracts/${created.id}`);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message || err?.message || "Failed to create contract"
      );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
      <div>
        <Link
          href="/contracts"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Contracts
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileCheck className="h-7 w-7 text-indigo-600" />
            Author New Contract (Direct / Scratch)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Author and execute a master agreement, rate contract, or fixed price contract directly without prior RFQ.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Contract Metadata */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              1. General Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contract Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Master Services Agreement for IT Infrastructure"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vendor *
                </label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.company_name} ({v.vendor_code || "No Code"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contract Type *
                </label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="RATE_CONTRACT">Rate Contract (Drawdown)</option>
                  <option value="FIXED_PRICE">Fixed Price Contract</option>
                  <option value="TIME_AND_MATERIALS">Time & Materials</option>
                  <option value="MASTER_SERVICES_AGREEMENT">Master Services Agreement (MSA)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Value & Currency *
                </label>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-28 border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={totalValue}
                    onChange={(e) => setTotalValue(e.target.value)}
                    placeholder="Total contract value / ceiling"
                    className="flex-1 border border-slate-300 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Unit *
                </label>
                <select
                  value={businessUnitId}
                  onChange={(e) => setBusinessUnitId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Choose Business Unit --</option>
                  {businessUnits.map((bu) => (
                    <option key={bu.id} value={bu.id}>
                      {bu.name} ({bu.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Procurement Category *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentTermId}
                  onChange={(e) => setPaymentTermId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Standard / Not Specified --</option>
                  {paymentTerms.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name} ({pt.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Incoterms
                </label>
                <select
                  value={incotermId}
                  onChange={(e) => setIncotermId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Standard / Not Specified --</option>
                  {incoterms.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code} — {it.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto-renew checkbox */}
            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                Enable Evergreen / Auto-Renewal
              </label>

              {autoRenew && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Notice days:</span>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={renewalNoticeDays}
                    onChange={(e) => setRenewalNoticeDays(parseInt(e.target.value) || 30)}
                    className="w-20 border border-slate-300 rounded p-1 text-xs text-center"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Line Items */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600" />
                2. Contract Lines / Bill of Quantities
              </h2>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Line
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={line.item_description}
                      onChange={(e) => updateLine(idx, "item_description", e.target.value)}
                      placeholder="e.g. Cloud Security Audit Service"
                      className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      UOM *
                    </label>
                    <select
                      value={line.uom_id}
                      onChange={(e) => updateLine(idx, "uom_id", e.target.value)}
                      className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:outline-none"
                    >
                      <option value="">-- UOM --</option>
                      {uoms.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.contracted_quantity}
                      onChange={(e) => updateLine(idx, "contracted_quantity", parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white text-right font-mono focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Unit Rate ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.unit_rate}
                      onChange={(e) => updateLine(idx, "unit_rate", parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white text-right font-mono focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      HSN
                    </label>
                    <input
                      type="text"
                      value={line.hsn_code}
                      onChange={(e) => updateLine(idx, "hsn_code", e.target.value)}
                      placeholder="HSN"
                      className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:outline-none font-mono"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Milestones (Optional) */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                3. Deliverable Milestones (Optional)
              </h2>
              <button
                type="button"
                onClick={addMilestone}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Milestone
              </button>
            </div>

            {milestones.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No deliverable milestones added. Add milestones to track progressive deliverable deliverables and SLA payouts.
              </p>
            ) : (
              <div className="space-y-3">
                {milestones.map((ms, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                  >
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Milestone Title *
                      </label>
                      <input
                        type="text"
                        value={ms.title}
                        onChange={(e) => updateMilestone(idx, "title", e.target.value)}
                        placeholder="e.g. Stage 1 Architectural Signoff"
                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:outline-none"
                        required
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Due Date *
                      </label>
                      <input
                        type="date"
                        value={ms.due_date}
                        onChange={(e) => updateMilestone(idx, "due_date", e.target.value)}
                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:outline-none"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Owner
                      </label>
                      <select
                        value={ms.responsible_party}
                        onChange={(e) =>
                          updateMilestone(idx, "responsible_party", e.target.value as any)
                        }
                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:outline-none"
                      >
                        <option value="BUYER">Buyer</option>
                        <option value="VENDOR">Vendor</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Weight %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={ms.milestone_weight}
                        onChange={(e) =>
                          updateMilestone(idx, "milestone_weight", parseFloat(e.target.value) || 0)
                        }
                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white text-right font-mono focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeMilestone(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <Link
              href="/contracts"
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={createContractMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {createContractMutation.isPending ? "Creating Contract..." : "Save & Draft Contract"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
