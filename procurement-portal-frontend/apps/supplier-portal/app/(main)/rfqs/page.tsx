"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRfqs } from "@procurement/hooks";
import { Badge, Button } from "@procurement/ui";
import { Zap, Lock, Clock, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

export default function SupplierRfqListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useRfqs({
    page,
    page_size: 20,
    search: search || undefined,
  });

  const rfqs = data?.rfqs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Tender Invitations & Sourcing Events</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review active tenders, examine specifications, ask clarifications, and submit cryptographically sealed bids.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-xl border border-slate-200 dark:border-white/15 shadow-sm">
        <input
          type="text"
          placeholder="Search by tender title or RFQ number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* Cards / Table */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15">Loading tenders...</div>
        ) : isError ? (
          <div className="p-12 text-center text-sm text-rose-500 dark:text-rose-400 bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15">Failed to load tenders.</div>
        ) : rfqs.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15">No active tenders found.</div>
        ) : (
          rfqs.map((rfq) => {
            const isClosed = rfq.bid_close_at && new Date(rfq.bid_close_at) < new Date();
            const isEmergency = rfq.rfq_type === "EMERGENCY";
            const isLiveAuction = rfq.bidding_mode === "LIVE_AUCTION" || rfq.bidding_mode === "HYBRID";

            return (
              <div
                key={rfq.id}
                className={`bg-white dark:bg-[#1C1C1F] rounded-xl border p-5 shadow-sm transition-all space-y-4 ${
                  isEmergency
                    ? "border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-500/20"
                    : "border-slate-200 dark:border-white/15 hover:border-slate-300 dark:hover:border-white/25"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{rfq.rfq_number}</span>
                      {isEmergency && (
                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                          <span>🚨</span> 24h Emergency Track
                        </span>
                      )}
                      {isLiveAuction && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
                          <span>⚡</span> Reverse Auction
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{rfq.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rfq.status}>
                      {rfq.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block font-medium">Sourcing Type</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{rfq.sourcing_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block font-medium">Evaluation Mode</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{rfq.evaluation_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block font-medium">Submission Deadline</span>
                    <span className={`font-medium ${isClosed ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"}`}>
                      {rfq.bid_close_at ? new Date(rfq.bid_close_at).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block font-medium">Bid Validity</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{rfq.bid_validity_days} Days</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/10 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <span>Cryptographic AES-256 envelope active &bull; Unopened until closing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLiveAuction && (
                      <Link href={`/rfqs/${rfq.id}/auction`}>
                        <Button variant="secondary" size="sm" icon={<Zap className="w-3.5 h-3.5 text-amber-500" />}>
                          Live Auction Room
                        </Button>
                      </Link>
                    )}
                    <Link href={`/rfqs/${rfq.id}/bid`}>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={Boolean(isClosed)}
                        icon={isClosed ? <Clock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      >
                        {isClosed ? "Deadline Passed" : "Submit / Revise Bid"}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
