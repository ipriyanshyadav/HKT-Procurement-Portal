"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Gavel,
  Clock,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useLiveAuctions, useCreateLiveAuction, useRfqs } from "@procurement/hooks";

interface LiveAuctionListProps {
  portalType: "buyer" | "supplier";
}

export function LiveAuctionList({ portalType }: LiveAuctionListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Queries
  const { data: auctions = [], isLoading } = useLiveAuctions({
    status: statusFilter === "ALL" ? undefined : statusFilter,
  });
  const { data: rfqsData } = useRfqs();
  const rfqs = rfqsData?.rfqs || [];

  // Form State
  const [selectedRfqId, setSelectedRfqId] = useState("");
  const [minDecrement, setMinDecrement] = useState(10000);
  const [durationMins, setDurationMins] = useState(60);
  const [autoExtend, setAutoExtend] = useState(true);

  const createMutation = useCreateLiveAuction();

  const handleCreateAuction = async () => {
    if (!selectedRfqId) {
      alert("Please select an eligible RFQ.");
      return;
    }
    try {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 5); // 5 mins in future
      await createMutation.mutateAsync({
        rfq_id: selectedRfqId,
        config: {
          auction_start_at: now.toISOString(),
          auction_duration_minutes: durationMins,
          min_decrement_type: "ABSOLUTE",
          min_decrement_value: minDecrement,
          rank_visibility: "RANK_ONLY",
          auto_extend: autoExtend,
          auto_extend_trigger_minutes: 2,
          auto_extend_duration_minutes: 3,
          max_extensions: 5,
          allow_proxy_bid: true,
          require_all_lots: false,
        },
      });
      setCreateModalOpen(false);
    } catch (e: any) {
      alert(`Failed to create auction: ${e?.response?.data?.detail || e?.message}`);
    }
  };

  const isBuyer = portalType === "buyer";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2e2e32] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Live Reverse Auctions</h1>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/20">
              SPEC_11B Dynamic Bidding
            </span>
          </div>
          <p className="mt-1 text-sm text-[#8E8E93]">
            Real-time English reverse bidding floor with anti-sniping soft-close extensions and automated decrement enforcement.
          </p>
        </div>

        {isBuyer && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Schedule New Auction
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {["ALL", "OPEN", "SCHEDULED", "CLOSED"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === st
                ? "bg-blue-600 text-white"
                : "bg-[#252529] text-[#8E8E93] hover:text-white"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Auction Cards */}
      {isLoading ? (
        <div className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-12 text-center text-sm text-[#8E8E93]">
          Loading active auction rooms...
        </div>
      ) : auctions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2e2e32] bg-[#1C1C1F] p-12 text-center">
          <Gavel className="mx-auto h-8 w-8 text-[#636366]" />
          <h3 className="mt-3 text-sm font-medium text-white">No active auctions found</h3>
          <p className="mt-1 text-xs text-[#8E8E93]">
            {isBuyer ? "Schedule a new reverse auction from an approved RFQ." : "You currently have no live auction invitations."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {auctions.map((auc) => {
            const isLive = auc.status === "OPEN";
            const roomUrl = isBuyer ? `/auctions/${auc.id}` : `/auctions/${auc.id}/live`;
            return (
              <div
                key={auc.id}
                className="flex flex-col justify-between rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-5 hover:border-[#3e3e44] transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        isLive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse"
                          : auc.status === "SCHEDULED"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-[#252529] text-[#8E8E93] border border-[#2e2e32]"
                      }`}
                    >
                      {isLive ? "● LIVE BIDDING" : auc.status}
                    </span>
                    <span className="font-mono text-xs text-[#8E8E93]">
                      RFQ #{auc.rfq_number || "RFQ"}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white mt-3 line-clamp-1">
                    {auc.rfq_title || `Reverse Auction #${auc.id.slice(0, 8)}`}
                  </h3>

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-b border-[#2e2e32] py-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#8E8E93] block">Decrement Type</span>
                      <span className="font-mono font-bold text-white">
                        {auc.config?.min_decrement_type || "ABSOLUTE"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8E8E93] block">Min Decrement</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ₹{(auc.config?.min_decrement_value || 1000).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-[#8E8E93]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Duration: {auc.config?.auction_duration_minutes || 60} mins</span>
                    </div>
                    {auc.extension_count > 0 && (
                      <div className="text-amber-400 text-[11px]">
                        Anti-sniping extensions: +{auc.extension_count} rounds
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#2e2e32]">
                  <Link
                    href={roomUrl}
                    className={`flex items-center justify-center gap-1.5 w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
                      isLive
                        ? "bg-emerald-600 text-white hover:bg-emerald-500"
                        : "bg-[#252529] text-[#E5E5EA] hover:bg-[#2e2e32]"
                    }`}
                  >
                    <span>{isLive ? "Enter Live Floor" : "View Auction Room"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Schedule Auction */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 text-white text-base font-semibold border-b border-[#2e2e32] pb-3">
              <Gavel className="h-5 w-5 text-blue-400" />
              <span>Schedule Live Reverse Auction (SPEC_11B)</span>
            </div>

            <div>
              <label className="text-[#8E8E93] block mb-1 font-medium">Select Source RFQ</label>
              <select
                value={selectedRfqId}
                onChange={(e) => setSelectedRfqId(e.target.value)}
                className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- Choose an RFQ in LIVE_AUCTION mode --</option>
                {rfqs.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.rfq_number} - {r.title} ({r.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#8E8E93] block mb-1">Min Decrement (₹)</label>
                <input
                  type="number"
                  value={minDecrement}
                  onChange={(e) => setMinDecrement(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[#8E8E93] block mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  value={durationMins}
                  onChange={(e) => setDurationMins(Number(e.target.value))}
                  min={5}
                  max={480}
                  className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-[#E5E5EA]">
                <input
                  type="checkbox"
                  checked={autoExtend}
                  onChange={(e) => setAutoExtend(e.target.checked)}
                  className="rounded border-[#2e2e32] bg-[#252529]"
                />
                <span>Anti-Sniping (+3 min on bid within last 2 mins)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#2e2e32]">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[#2e2e32] text-[#8E8E93] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAuction}
                disabled={createMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50"
              >
                {createMutation.isPending ? "Scheduling..." : "Create Auction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
