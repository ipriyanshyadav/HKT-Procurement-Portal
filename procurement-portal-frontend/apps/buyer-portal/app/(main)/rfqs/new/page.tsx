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
import { Button, Badge } from "@procurement/ui";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Zap,
  TrendingDown,
  Clock,
} from "lucide-react";

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
  const [rfqType, setRfqType] = useState<string>("LIMITED_TENDER");
  const [biddingMode, setBiddingMode] = useState<"SEALED" | "LIVE_AUCTION" | "HYBRID">("SEALED");
  const [sourcingType, setSourcingType] = useState("GOODS");
  const [evaluationType, setEvaluationType] = useState("L1_PRICE_ONLY");
  const [procurementType, setProcurementType] = useState("OPEX");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [bidValidityDays, setBidValidityDays] = useState(90);
  const [bidCloseAt, setBidCloseAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 72 + 1);
    return d.toISOString().slice(0, 16);
  });
  const [isMultiLot, setIsMultiLot] = useState(false);

  // Reverse Auction Parameters (for LIVE_AUCTION and HYBRID)
  const [minDecrementType, setMinDecrementType] = useState<"PERCENTAGE" | "ABSOLUTE">("PERCENTAGE");
  const [minDecrementValue, setMinDecrementValue] = useState<number>(0.5);
  const [triggerMinutes, setTriggerMinutes] = useState<number>(5);
  const [extendDuration, setExtendDuration] = useState<number>(10);
  const [maxExtensions, setMaxExtensions] = useState<number>(3);
  const [rankVisibility, setRankVisibility] = useState<"RANK_ONLY" | "PRICE_AND_RANK" | "NO_RANK">("RANK_ONLY");
  const [reservePrice, setReservePrice] = useState<string>("");

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

  const handleRfqTypeChange = (newType: string) => {
    setRfqType(newType);
    const d = new Date();
    if (newType === "EMERGENCY") {
      d.setHours(d.getHours() + 24 + 1);
    } else {
      d.setHours(d.getHours() + 72 + 1);
    }
    setBidCloseAt(d.toISOString().slice(0, 16));
  };

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
      const payload: any = {
        title,
        description: description || undefined,
        rfq_type: rfqType,
        bidding_mode: biddingMode,
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

      if (biddingMode !== "SEALED") {
        payload.auction_config = {
          min_decrement_type: minDecrementType,
          min_decrement_value: Number(minDecrementValue),
          auto_extend: true,
          auto_extend_trigger_minutes: Number(triggerMinutes),
          auto_extend_duration_minutes: Number(extendDuration),
          max_extensions: Number(maxExtensions),
          rank_visibility: rankVisibility,
          reserve_price_inr: reservePrice ? parseFloat(reservePrice) : undefined,
        };
      }

      const result = await createMutation.mutateAsync(payload);
      router.push(`/rfqs/${result.id}`);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to create RFQ");
    }
  };

  const isEmergency = rfqType === "EMERGENCY";

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/rfqs" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> RFQs
            </Link>
            <span>/</span>
            <span>New Sourcing Event</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Create Request for Quotation
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/rfqs">
            <Button variant="secondary" size="md">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={createMutation.isPending}
            icon={<Save className="w-4 h-4 mr-1.5" />}
          >
            Save & Continue
          </Button>
        </div>
      </div>

      {/* Emergency Alert Banner if Emergency chosen */}
      {isEmergency && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              Emergency Sourcing Track Activated
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              The submission window minimum is reduced from 72h to <strong>24 hours</strong>. This event will bypass standard committee delays and trigger accelerated procurement approvals.
            </p>
          </div>
        </div>
      )}

      {/* 1. General Information */}
      <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            1. General Information
          </h2>
          <Badge variant={isEmergency ? "warning" : "info"}>
            {isEmergency ? "Emergency Event" : "Standard Track"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              RFQ Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sourcing 500 Enterprise Workstations FY26"
              className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Scope & Commercial Requirements
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Provide context, operational parameters, deliverable milestones..."
              className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              RFQ Tender Type *
            </label>
            <select
              value={rfqType}
              onChange={(e) => handleRfqTypeChange(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
            >
              <option value="LIMITED_TENDER">Limited Tender (Invited Vendors)</option>
              <option value="OPEN_TENDER">Open Tender (Public RFP)</option>
              <option value="SINGLE_SOURCE">Single Source / Proprietary</option>
              <option value="EMERGENCY">⚡ Emergency Tender (24h Window)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Bidding Mode *
            </label>
            <select
              value={biddingMode}
              onChange={(e) => setBiddingMode(e.target.value as any)}
              className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
            >
              <option value="SEALED">🔒 Sealed Bid (Encrypted Quotations)</option>
              <option value="LIVE_AUCTION">⚡ Live Reverse Auction (Real-time Leaderboard)</option>
              <option value="HYBRID">🔄 Hybrid (Sealed Qualification + Reverse Auction)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Business Unit *
            </label>
            <select
              required
              value={businessUnitId}
              onChange={(e) => setBusinessUnitId(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select Business Unit</option>
              {businessUnits.map((bu: any) => (
                <option key={bu.id} value={bu.id}>{bu.name} ({bu.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Category *
            </label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select Category</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
            >
              <option value="INR">INR - Indian Rupee (₹)</option>
              <option value="USD">USD - US Dollar ($)</option>
              <option value="EUR">EUR - Euro (€)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Evaluation Mode
            </label>
            <select
              value={evaluationType}
              onChange={(e) => setEvaluationType(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
            >
              <option value="L1_PRICE_ONLY">L1 (Lowest Price Conforming)</option>
              <option value="QCBS">QCBS (Quality & Cost Based Selection)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Reverse Auction Settings (Conditional) */}
      {(biddingMode === "LIVE_AUCTION" || biddingMode === "HYBRID") && (
        <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-xl border border-amber-500/30 dark:border-amber-500/20 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Reverse Auction Engine Settings
              </h2>
            </div>
            <Badge variant="review">Real-Time WebSocket Leaderboard</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Minimum Decrement Type
              </label>
              <select
                value={minDecrementType}
                onChange={(e) => setMinDecrementType(e.target.value as any)}
                className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
              >
                <option value="PERCENTAGE">Percentage of Current L1 (%)</option>
                <option value="ABSOLUTE">Absolute Amount ({currency})</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Decrement Value ({minDecrementType === "PERCENTAGE" ? "%" : currency})
              </label>
              <input
                type="number"
                step="0.1"
                min="0.01"
                value={minDecrementValue}
                onChange={(e) => setMinDecrementValue(parseFloat(e.target.value) || 0.5)}
                className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Supplier Rank Visibility
              </label>
              <select
                value={rankVisibility}
                onChange={(e) => setRankVisibility(e.target.value as any)}
                className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
              >
                <option value="PRICE_AND_RANK">L1 Price + Current Rank (Standard)</option>
                <option value="RANK_ONLY">Rank Only (Hidden Price)</option>
                <option value="NO_RANK">Blind Bidding (Own Bid Confirmation Only)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Anti-Sniping Trigger (Mins)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={triggerMinutes}
                onChange={(e) => setTriggerMinutes(parseInt(e.target.value) || 5)}
                className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Bids placed within last {triggerMinutes} min extend auction.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Auto-Extension Duration (Mins)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={extendDuration}
                onChange={(e) => setExtendDuration(parseInt(e.target.value) || 10)}
                className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Reserve Price Ceiling ({currency})
              </label>
              <input
                type="number"
                placeholder="Optional Target Cap"
                value={reservePrice}
                onChange={(e) => setReservePrice(e.target.value)}
                className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Strictly hidden from suppliers at all times.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Bidding Timeline & Validity */}
      <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-white/10 pb-3">
          {biddingMode === "SEALED" ? "2." : "3."} Bidding Timeline & Validity
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Bid Submission Deadline *
            </label>
            <input
              type="datetime-local"
              required
              value={bidCloseAt}
              onChange={(e) => setBidCloseAt(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Minimum {isEmergency ? "24 hours (Emergency)" : "72 hours (Standard)"} window required by CVC policy.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Bid Validity Period (Days) *
            </label>
            <input
              type="number"
              min={30}
              max={180}
              value={bidValidityDays}
              onChange={(e) => setBidValidityDays(Number(e.target.value))}
              className="w-full text-sm border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Standard commercial quote validity (between 30 and 180 days).
            </p>
          </div>
        </div>
      </div>

      {/* 4. Items & Deliverables */}
      <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {biddingMode === "SEALED" ? "3." : "4."} Items & Deliverables
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Specify line items, quantities, and benchmark estimates.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addLine}
            icon={<Plus className="w-3.5 h-3.5 mr-1" />}
          >
            Add Line
          </Button>
        </div>

        <div className="space-y-4">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="p-4 border border-slate-200/80 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/[0.02] space-y-3"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Line #{idx + 1}</span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="text-red-500 hover:text-red-700 text-xs inline-flex items-center gap-1 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
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
                    className="w-full text-xs border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <select
                    required
                    value={line.uom_id}
                    onChange={(e) => updateLine(idx, "uom_id", e.target.value)}
                    className="w-full text-xs border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
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
                    className="w-full text-xs border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
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
                    className="w-full text-xs border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Technical specifications (optional)"
                    value={line.specifications}
                    onChange={(e) => updateLine(idx, "specifications", e.target.value)}
                    className="w-full text-xs border border-slate-200 dark:border-white/15 rounded-lg p-2.5 bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-white/10 text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">
          Total Estimated Value: {currency} {estimatedValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </div>
      </div>
    </form>
  );
}
