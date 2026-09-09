"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Bot,
  Radar,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ShieldCheck,
  Send,
  Plus,
  Play,
  Award,
  RefreshCw,
  Scale,
  DollarSign,
  Briefcase,
  X,
} from "lucide-react";
import {
  useCalculateRadarScores,
  useConvertDraftToRfq,
  useGenerateSmartRfq,
  useNegotiationSession,
  useNegotiationSessions,
  useSmartRfqDrafts,
  useStartBotNegotiation,
  useSubmitNegotiationCounter,
  useSupplierRadarScores,
  useVendors,
} from "@procurement/hooks";
import type { AiRfqDraft, NegotiationSession, SupplierRadarScore } from "@procurement/types";

export function AISourcingCopilot() {
  const [activeTab, setActiveTab] = useState<"smart-rfq" | "negotiation-bot" | "supplier-radar">("smart-rfq");

  // --- Smart RFQ State ---
  const [createRfqModalOpen, setCreateRfqModalOpen] = useState(false);
  const [rfqTitleInput, setRfqTitleInput] = useState("Autonomous Infrastructure Hardware Procurement");
  const [lotItemDesc, setLotItemDesc] = useState("Enterprise Core Layer-3 Network Switches");
  const [lotQty, setLotQty] = useState(8);
  const [lotPrice, setLotPrice] = useState(145000);
  const [convertedSuccess, setConvertedSuccess] = useState<string | null>(null);

  // --- Negotiation Bot State ---
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [startSessionModalOpen, setStartSessionModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [botItemDesc, setBotItemDesc] = useState("Annual Enterprise Cloud Backup & DR Tier-3");
  const [botInitialQuote, setBotInitialQuote] = useState(85000);
  const [botTargetPrice, setBotTargetPrice] = useState(68000);
  const [botMaxPrice, setBotMaxPrice] = useState(74000);
  const [botStrategy, setBotStrategy] = useState<"AGGRESSIVE" | "BALANCED" | "COLLABORATIVE">("BALANCED");
  const [supplierCounterInput, setSupplierCounterInput] = useState<number>(76000);
  const [supplierMessageInput, setSupplierMessageInput] = useState<string>("Can provide 10% discount for multi-year term.");

  // Queries
  const { data: drafts = [], isLoading: loadingDrafts } = useSmartRfqDrafts();
  const { data: sessions = [], isLoading: loadingSessions } = useNegotiationSessions();
  const { data: selectedSession } = useNegotiationSession(selectedSessionId || "");
  const { data: radarScores = [], isLoading: loadingRadar } = useSupplierRadarScores();
  const { data: vendorsData } = useVendors();
  const vendors = vendorsData?.vendors || [];

  // Mutations
  const generateRfqMutation = useGenerateSmartRfq();
  const convertRfqMutation = useConvertDraftToRfq();
  const startNegotiationMutation = useStartBotNegotiation();
  const submitCounterMutation = useSubmitNegotiationCounter();
  const calculateRadarMutation = useCalculateRadarScores();

  // Handlers
  const handleCreateSmartRfq = async () => {
    await generateRfqMutation.mutateAsync({
      title: rfqTitleInput,
      custom_lot_items: [
        {
          lot_name: lotItemDesc,
          item_code: "HW-NET-9200",
          quantity: lotQty,
          estimated_unit_price: lotPrice,
        },
      ],
    });
    setCreateRfqModalOpen(false);
  };

  const handleConvertDraft = async (draftId: string) => {
    const res = await convertRfqMutation.mutateAsync({ draft_id: draftId });
    setConvertedSuccess(`Successfully converted to Live RFQ: ${res.rfq_number} with ${res.lot_count} lots.`);
  };

  const handleStartNegotiation = async () => {
    if (!selectedVendorId) return;
    const res = await startNegotiationMutation.mutateAsync({
      vendor_id: selectedVendorId,
      item_description: botItemDesc,
      initial_quote_price: botInitialQuote,
      target_price: botTargetPrice,
      max_acceptable_price: botMaxPrice,
      concession_strategy: botStrategy,
    });
    setSelectedSessionId(res.id);
    setStartSessionModalOpen(false);
  };

  const handleSubmitCounter = async () => {
    if (!selectedSessionId || !supplierCounterInput) return;
    await submitCounterMutation.mutateAsync({
      session_id: selectedSessionId,
      vendor_counter_price: supplierCounterInput,
      vendor_message: supplierMessageInput,
    });
  };

  return (
    <div className="min-h-screen bg-[#0E0E10] text-[#E4E4E7] p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#27272A]">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600/20 to-blue-500/20 border border-purple-500/30 text-purple-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              AI Sourcing & Negotiation Copilot
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Autonomous
              </span>
            </h1>
            <p className="text-sm text-[#A1A1AA]">
              PR lot clustering with anomaly detection, tail-spend counter-bidding bots, and supplier radar
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#141416] p-1 rounded-xl border border-[#27272A]">
          <button
            onClick={() => setActiveTab("smart-rfq")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "smart-rfq"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-[#A1A1AA] hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Smart RFQ Generator</span>
          </button>
          <button
            onClick={() => setActiveTab("negotiation-bot")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "negotiation-bot"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-[#A1A1AA] hover:text-white"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Negotiation Bot</span>
          </button>
          <button
            onClick={() => setActiveTab("supplier-radar")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "supplier-radar"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-[#A1A1AA] hover:text-white"
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>Supplier Radar</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {convertedSuccess && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{convertedSuccess}</span>
          </div>
          <button
            onClick={() => setConvertedSuccess(null)}
            className="text-xs text-emerald-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* --- TAB 1: Smart RFQ Generator --- */}
      {activeTab === "smart-rfq" && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Smart RFQ Lots & Pricing Anomaly Radar</h2>
              <p className="text-xs text-[#A1A1AA]">
                PR items structured into bidding packages with historical market benchmark variance flags
              </p>
            </div>
            <button
              onClick={() => setCreateRfqModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Smart RFQ</span>
            </button>
          </div>

          <div className="space-y-4">
            {loadingDrafts ? (
              <div className="space-y-3">
                {[1, 2].map((idx) => (
                  <div key={idx} className="h-44 rounded-2xl bg-[#141416] border border-[#27272A] animate-pulse" />
                ))}
              </div>
            ) : drafts.length > 0 ? (
              drafts.map((d) => (
                <div
                  key={d.id}
                  className="p-5 rounded-2xl bg-[#141416] border border-[#27272A] space-y-4 hover:border-[#38383E] transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-bold text-white">{d.rfq_title}</h3>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            d.status === "CONVERTED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#71717A] mt-0.5">
                        Generated: {new Date(d.created_at).toLocaleDateString()} • Estimated Value: ₹
                        {d.estimated_total_value.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {d.status !== "CONVERTED" && (
                        <button
                          onClick={() => handleConvertDraft(d.id)}
                          disabled={convertRfqMutation.isPending}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <span>Publish to RFQ</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Anomaly Flags Highlight */}
                  {d.anomaly_flags && d.anomaly_flags.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Historical Pricing Anomalies Detected</span>
                      </div>
                      <div className="space-y-1">
                        {d.anomaly_flags.map((af, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs text-[#E4E4E7]">
                            <span className="truncate max-w-md">{af.item_description}</span>
                            <span className="font-semibold text-amber-400 font-mono">
                              +{af.variance_pct}% vs Benchmark
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lots List */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#222226] text-[#71717A]">
                          <th className="pb-2 font-medium">Lot #</th>
                          <th className="pb-2 font-medium">Description</th>
                          <th className="pb-2 font-medium">Qty</th>
                          <th className="pb-2 font-medium">Quoted Rate</th>
                          <th className="pb-2 font-medium">Catalog Benchmark</th>
                          <th className="pb-2 font-medium">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F1F23]">
                        {d.lots.map((lot, idx) => (
                          <tr key={idx} className="hover:bg-[#18181B] transition-colors">
                            <td className="py-2.5 font-mono text-[#A1A1AA]">{lot.lot_number}</td>
                            <td className="py-2.5 font-medium text-white">{lot.lot_name}</td>
                            <td className="py-2.5 text-[#A1A1AA]">{lot.quantity}</td>
                            <td className="py-2.5 font-semibold text-white">
                              ₹{lot.estimated_unit_price.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 text-[#A1A1AA]">
                              ₹{lot.benchmark_price?.toLocaleString("en-IN") || "—"}
                            </td>
                            <td className="py-2.5 font-mono">
                              {lot.variance_pct > 15 ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                                  +{lot.variance_pct}%
                                </span>
                              ) : (
                                <span className="text-emerald-400">Normal</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center rounded-2xl bg-[#141416] border border-[#27272A]">
                <Layers className="w-10 h-10 text-[#71717A] mx-auto mb-3" />
                <p className="text-sm font-semibold text-white">No Smart RFQs generated yet</p>
                <p className="text-xs text-[#71717A] mt-1">Click Generate Smart RFQ to cluster PR items autonomously</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 2: Autonomous Tail-Spend Negotiation Bot --- */}
      {activeTab === "negotiation-bot" && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sessions List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Active Bot Sessions</h2>
              <button
                onClick={() => setStartSessionModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Session</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {loadingSessions ? (
                <div className="h-32 rounded-xl bg-[#141416] border border-[#27272A] animate-pulse" />
              ) : sessions.length > 0 ? (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                      selectedSessionId === s.id
                        ? "bg-[#1C1C20] border-purple-500 shadow-md"
                        : "bg-[#141416] border-[#27272A] hover:border-[#38383E]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold text-white truncate max-w-[180px]">
                        {s.item_description}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          s.bot_status === "CONCLUDED_SUCCESS"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : s.bot_status === "ACTIVE"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {s.bot_status}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#71717A] flex items-center justify-between w-full">
                      <span>{s.vendor_name}</span>
                      <span>Round {s.current_round} / {s.max_rounds}</span>
                    </div>

                    <div className="pt-2 border-t border-[#222226] flex items-center justify-between w-full text-xs">
                      <span className="text-[#A1A1AA]">Current: ₹{s.current_bid_price.toLocaleString("en-IN")}</span>
                      {s.savings_achieved > 0 && (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" />
                          -₹{s.savings_achieved.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center rounded-xl bg-[#141416] border border-[#27272A] text-xs text-[#71717A]">
                  No active negotiation sessions. Click New Session.
                </div>
              )}
            </div>
          </div>

          {/* Session Interactive Timeline & Bot Simulator */}
          <div className="lg:col-span-2 space-y-4">
            {selectedSession ? (
              <div className="p-6 rounded-2xl bg-[#141416] border border-[#27272A] space-y-6">
                {/* Session Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#27272A]">
                  <div>
                    <h3 className="text-base font-bold text-white">{selectedSession.item_description}</h3>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">
                      Partner: <span className="text-white font-medium">{selectedSession.vendor_name}</span> • Strategy:{" "}
                      <span className="font-semibold text-purple-400">{selectedSession.concession_strategy}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <span className="text-[#71717A] block">Target Price</span>
                      <span className="font-bold text-emerald-400">
                        ₹{selectedSession.target_price.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#71717A] block">Max Ceiling</span>
                      <span className="font-bold text-white">
                        ₹{selectedSession.max_acceptable_price.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Negotiation Round Timeline */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {selectedSession.rounds.map((r) => (
                    <div
                      key={r.id}
                      className={`p-4 rounded-xl border ${
                        r.bidder_type === "AI_BOT"
                          ? "bg-purple-950/20 border-purple-500/30"
                          : "bg-[#1B1B1E] border-[#2E2E34]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-bold text-white">
                            {r.bidder_type === "AI_BOT" ? "Autonomous AI Agent" : "Supplier Bidder"} • Round {r.round_number}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-white">
                          ₹{r.counter_offer_price?.toLocaleString("en-IN") || r.offer_price.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="text-xs text-[#A1A1AA] leading-relaxed">{r.rationale}</p>
                    </div>
                  ))}
                </div>

                {/* Supplier Counter Simulator Input */}
                {selectedSession.bot_status === "ACTIVE" ? (
                  <div className="pt-4 border-t border-[#27272A] space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-purple-400" />
                      Simulate Supplier Counter-Bid
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-[#71717A] mb-1">Proposed Counter Price (₹)</label>
                        <input
                          type="number"
                          value={supplierCounterInput}
                          onChange={(e) => setSupplierCounterInput(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-[#71717A] mb-1">Supplier Concession Message</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={supplierMessageInput}
                            onChange={(e) => setSupplierMessageInput(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                          <button
                            onClick={handleSubmitCounter}
                            disabled={submitCounterMutation.isPending}
                            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Submit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <p className="text-xs font-semibold text-emerald-400">
                      Negotiation Concluded: Total Savings of ₹{selectedSession.savings_achieved.toLocaleString("en-IN")} achieved!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-16 text-center rounded-2xl bg-[#141416] border border-[#27272A] text-xs text-[#71717A]">
                Select a session on the left to inspect counter-bidding rounds.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: Supplier Recommendation Radar --- */}
      {activeTab === "supplier-radar" && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Multi-Factor Supplier Recommendation Radar</h2>
              <p className="text-xs text-[#A1A1AA]">
                AI-weighted suitability score based on Quality (35%), Price (25%), Lead Time (20%), and ESG (20%)
              </p>
            </div>
            <button
              onClick={() => calculateRadarMutation.mutate({})}
              disabled={calculateRadarMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1C1C1F] hover:bg-[#252529] border border-[#2E2E32] text-xs font-semibold transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${calculateRadarMutation.isPending ? "animate-spin" : ""}`} />
              <span>Refresh Radar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loadingRadar ? (
              [1, 2, 3].map((idx) => (
                <div key={idx} className="h-64 rounded-2xl bg-[#141416] border border-[#27272A] animate-pulse" />
              ))
            ) : radarScores.length > 0 ? (
              radarScores.map((score) => (
                <div
                  key={score.id}
                  className="p-5 rounded-2xl bg-[#141416] border border-[#27272A] hover:border-[#38383E] transition-all space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">{score.vendor_name}</h3>
                      <p className="text-xs text-[#71717A]">{score.category_name}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        score.recommendation_tier === "PREFERRED"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : score.recommendation_tier === "RECOMMENDED"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {score.recommendation_tier}
                    </span>
                  </div>

                  {/* Overall Fit Metric */}
                  <div className="p-3.5 rounded-xl bg-[#19191D] border border-[#2C2C32] flex items-center justify-between">
                    <span className="text-xs text-[#A1A1AA] font-medium">Overall AI Suitability</span>
                    <span className="text-lg font-bold text-white">{score.overall_fit_score} / 100</span>
                  </div>

                  {/* Score Breakdown Bars */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-[#A1A1AA] mb-1">
                        <span>Quality (35%)</span>
                        <span className="font-semibold text-white">{score.quality_score}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#27272A] overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${score.quality_score}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-[#A1A1AA] mb-1">
                        <span>Price Competitiveness (25%)</span>
                        <span className="font-semibold text-white">{score.price_competitiveness_score}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#27272A] overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${score.price_competitiveness_score}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-[#A1A1AA] mb-1">
                        <span>Delivery & Lead Time (20%)</span>
                        <span className="font-semibold text-white">{score.lead_time_score}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#27272A] overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${score.lead_time_score}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-[#A1A1AA] mb-1">
                        <span>ESG & SAIF Compliance (20%)</span>
                        <span className="font-semibold text-white">{score.esg_score}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#27272A] overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${score.esg_score}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Strengths Insights */}
                  {score.insights?.strengths && score.insights.strengths.length > 0 && (
                    <div className="pt-2 border-t border-[#222226]">
                      <span className="text-[10px] uppercase font-semibold text-[#71717A] block mb-1">
                        Verified Strengths:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {score.insights.strengths.map((str, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded bg-[#1F1F23] text-[#A1A1AA]"
                          >
                            {str}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-3 p-12 text-center rounded-2xl bg-[#141416] border border-[#27272A]">
                <Radar className="w-10 h-10 text-[#71717A] mx-auto mb-3" />
                <p className="text-sm font-semibold text-white">No radar assessments generated yet</p>
                <p className="text-xs text-[#71717A] mt-1">Click Refresh Radar above to compute multi-factor scores</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate Smart RFQ Modal */}
      {createRfqModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141416] border border-[#2E2E32] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <h3 className="text-base font-bold text-white">Generate Smart RFQ Draft</h3>
              <button onClick={() => setCreateRfqModalOpen(false)} className="text-[#71717A] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#A1A1AA] mb-1">RFQ Package Title</label>
                <input
                  type="text"
                  value={rfqTitleInput}
                  onChange={(e) => setRfqTitleInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#A1A1AA] mb-1">Primary Lot Description</label>
                <input
                  type="text"
                  value={lotItemDesc}
                  onChange={(e) => setLotItemDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#A1A1AA] mb-1">Quantity</label>
                  <input
                    type="number"
                    value={lotQty}
                    onChange={(e) => setLotQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#A1A1AA] mb-1">Quoted Unit Price (₹)</label>
                  <input
                    type="number"
                    value={lotPrice}
                    onChange={(e) => setLotPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272A]">
              <button
                onClick={() => setCreateRfqModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#A1A1AA]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSmartRfq}
                disabled={generateRfqMutation.isPending}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                {generateRfqMutation.isPending ? "Clustering Lots..." : "Generate Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Negotiation Session Modal */}
      {startSessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#141416] border border-[#2E2E32] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <h3 className="text-base font-bold text-white">Start Autonomous Negotiation Session</h3>
              <button onClick={() => setStartSessionModalOpen(false)} className="text-[#71717A] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#A1A1AA] mb-1">Target Vendor *</label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-white"
                >
                  <option value="">Select Vendor...</option>
                  {vendors.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.company_name || v.legal_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#A1A1AA] mb-1">Item / Scope Description</label>
                <input
                  type="text"
                  value={botItemDesc}
                  onChange={(e) => setBotItemDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#A1A1AA] mb-1">Opening Quote (₹)</label>
                  <input
                    type="number"
                    value={botInitialQuote}
                    onChange={(e) => setBotInitialQuote(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#A1A1AA] mb-1">Target Price (₹)</label>
                  <input
                    type="number"
                    value={botTargetPrice}
                    onChange={(e) => setBotTargetPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#A1A1AA] mb-1">Max Ceiling (₹)</label>
                  <input
                    type="number"
                    value={botMaxPrice}
                    onChange={(e) => setBotMaxPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[#A1A1AA] mb-1">Concession Strategy</label>
                <select
                  value={botStrategy}
                  onChange={(e) => setBotStrategy(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-white"
                >
                  <option value="BALANCED">Balanced (Standard corridor)</option>
                  <option value="AGGRESSIVE">Aggressive (Tail-spend max savings)</option>
                  <option value="COLLABORATIVE">Collaborative (Strategic partner)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272A]">
              <button
                onClick={() => setStartSessionModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#A1A1AA]"
              >
                Cancel
              </button>
              <button
                onClick={handleStartNegotiation}
                disabled={startNegotiationMutation.isPending || !selectedVendorId}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {startNegotiationMutation.isPending ? "Starting Bot..." : "Launch Bot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
