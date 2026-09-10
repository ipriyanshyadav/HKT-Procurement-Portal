"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useRfq,
  useSubmitBid,
  useReviseBid,
  useWithdrawBid,
  useAddClarification,
  useIncoterms,
} from "@procurement/hooks";
import { ClarificationThread, Button, Badge } from "@procurement/ui";
import { ShieldCheck, Lock, Zap, Clock, ArrowLeft, AlertCircle, KeyRound, CheckCircle2 } from "lucide-react";

export default function SupplierBidSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params?.id as string;

  const { data: rfq, isLoading, isError } = useRfq(rfqId);
  const { data: incoterms = [] } = useIncoterms({ active_only: true });
  const submitBidMutation = useSubmitBid();
  const reviseBidMutation = useReviseBid();
  const withdrawBidMutation = useWithdrawBid();
  const addClarificationMutation = useAddClarification();

  // Commercial / Technical metadata
  const [hasDeviations, setHasDeviations] = useState(false);
  const [deviationDetails, setDeviationDetails] = useState("");
  const [technicalCompliant, setTechnicalCompliant] = useState(true);
  const [paymentTermsCode, setPaymentTermsCode] = useState("NET_30");
  const [incoterm, setIncoterm] = useState("DDP");
  const [validityDays, setValidityDays] = useState(90);
  const [coveringLetter, setCoveringLetter] = useState("");

  // Line quotations
  const [lineQuotes, setLineQuotes] = useState<Record<string, {
    unit_price: number;
    delivery_days: number;
    tax_rate: number;
    freight: number;
    country_of_origin: string;
    remarks: string;
  }>>({});

  if (isLoading) {
    return <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading tender specifications...</div>;
  }
  if (isError || !rfq) {
    return <div className="p-12 text-center text-sm text-rose-500 dark:text-rose-400">Failed to load tender.</div>;
  }

  const isClosed = rfq.bid_close_at && new Date(rfq.bid_close_at) < new Date();
  const isEmergency = rfq.rfq_type === "EMERGENCY";
  const isLiveAuction = rfq.bidding_mode === "LIVE_AUCTION" || rfq.bidding_mode === "HYBRID";

  const handleQuoteChange = (lineId: string, field: string, value: any) => {
    setLineQuotes((prev) => ({
      ...prev,
      [lineId]: {
        ...(prev[lineId] || {
          unit_price: 0,
          delivery_days: 14,
          tax_rate: 18,
          freight: 0,
          country_of_origin: "IN",
          remarks: "",
        }),
        [field]: value,
      },
    }));
  };

  const totalQuotedAmount = rfq.lines.reduce((sum, line) => {
    const q = lineQuotes[line.id || ""]?.unit_price || 0;
    return sum + q * Number(line.quantity);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isClosed) {
      alert("Submission deadline has passed.");
      return;
    }

    const payload = {
      has_deviations: hasDeviations,
      deviation_details: hasDeviations ? deviationDetails : undefined,
      technical_offer_compliant: technicalCompliant,
      payment_terms_code: paymentTermsCode,
      delivery_terms_incoterm: incoterm,
      bid_validity_days: Number(validityDays),
      covering_letter: coveringLetter || undefined,
      lines: rfq.lines.map((line) => {
        const quote = lineQuotes[line.id || ""] || {
          unit_price: 0,
          delivery_days: 14,
          tax_rate: 0,
          freight: 0,
          country_of_origin: "IN",
          remarks: "",
        };
        return {
          rfq_line_id: line.id,
          unit_price: Number(quote.unit_price),
          total_price: Number(quote.unit_price) * Number(line.quantity),
          currency: rfq.currency || "INR",
          quantity: Number(line.quantity),
          delivery_days: Number(quote.delivery_days),
          tax_rate_declared: Number(quote.tax_rate || 0),
          freight_quoted: Number(quote.freight || 0),
          country_of_origin: quote.country_of_origin || "IN",
          remarks: quote.remarks || undefined,
        };
      }),
    };

    try {
      await submitBidMutation.mutateAsync({ rfqId, payload });
      alert("Bid submitted successfully! Prices have been encrypted at rest.");
      router.push("/rfqs");
    } catch (err: any) {
      // If already submitted, offer revision
      if (err?.response?.data?.error?.code === "BID_ALREADY_SUBMITTED") {
        if (confirm("You have already submitted a bid for this RFQ. Would you like to submit this as a Revision?")) {
          try {
            await reviseBidMutation.mutateAsync({ rfqId, payload });
            alert("Bid revised successfully! New version snapshot created.");
            router.push("/rfqs");
          } catch (revErr: any) {
            alert(revErr?.response?.data?.error?.message || "Revision failed");
          }
        }
      } else {
        alert(err?.response?.data?.error?.message || "Failed to submit bid");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/rfqs" className="hover:underline">Tenders</Link>
            <span>/</span>
            <span className="font-mono">{rfq.rfq_number}</span>
            <span>/</span>
            <span>Commercial Quotation</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Bid Submission</h1>
            {isEmergency && (
              <span className="px-2.5 py-0.5 bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-full font-bold text-xs flex items-center gap-1">
                <span>🚨</span> 24h Emergency Track
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Provide your unit pricing and delivery lead times. All financial figures are encrypted end-to-end.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLiveAuction && (
            <Link href={`/rfqs/${rfqId}/auction`}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Zap className="w-3.5 h-3.5 text-amber-500" />}
              >
                Enter Live Auction
              </Button>
            </Link>
          )}
          <Link href="/rfqs">
            <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back to Tenders
            </Button>
          </Link>
        </div>
      </div>

      {/* Emergency RFQ Banner */}
      {isEmergency && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-4 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-3">
          <span className="text-lg">🚨</span>
          <div>
            <span className="font-bold block">Accelerated Emergency Window Active</span>
            This tender is operating on an accelerated 24-hour response window. Please ensure your quotations, delivery lead times, and compliance declarations are finalized promptly.
          </div>
        </div>
      )}

      {/* Sealed Cryptographic Envelope Protection Card */}
      <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-500/30 rounded-xl p-5 text-xs text-slate-800 dark:text-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5 text-blue-800 dark:text-blue-300 font-bold text-sm">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>Cryptographic Envelope & Sealed Bid Protection (AES-256-GCM)</span>
        </div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          Your quoted prices and commercial details are encrypted at the client boundary using AES-256 before storage in secure data stores.
          In strict compliance with statutory procurement integrity guidelines:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="flex items-start gap-2 bg-white/60 dark:bg-white/[0.04] p-2.5 rounded-lg border border-blue-100 dark:border-white/5">
            <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-900 dark:text-slate-100">Zero Early Disclosure</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Buyers and admins cannot view prices prior to tender close.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white/60 dark:bg-white/[0.04] p-2.5 rounded-lg border border-blue-100 dark:border-white/5">
            <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-900 dark:text-slate-100">Dual Authorization</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Requires 2 distinct committee members to unseal bids.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white/60 dark:bg-white/[0.04] p-2.5 rounded-lg border border-blue-100 dark:border-white/5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-900 dark:text-slate-100">Audit Trail Logging</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Every submission, revision, and opening event is SHA-256 hashed.</span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line Items Pricing Table */}
        <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-white/10 pb-3">
            1. Line Items Quotation
          </h2>

          <div className="space-y-6">
            {rfq.lines.map((line, idx) => {
              const quote = lineQuotes[line.id || ""] || {
                unit_price: 0,
                delivery_days: 14,
                tax_rate: 18,
                freight: 0,
                country_of_origin: "IN",
                remarks: "",
              };
              const total = (Number(quote.unit_price) || 0) * Number(line.quantity);

              return (
                <div key={line.id || idx} className="p-4 bg-slate-50 dark:bg-[#252529] rounded-xl border border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono block">Line #{line.line_number}</span>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{line.item_description}</h4>
                      {line.specifications && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{line.specifications}</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-white dark:bg-[#1C1C1F] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-200 rounded font-mono">
                      Qty: {Number(line.quantity)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Unit Price (₹ Excl. Tax) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min={0.01}
                        placeholder="Quoted unit price"
                        value={quote.unit_price || ""}
                        onChange={(e) => handleQuoteChange(line.id || "", "unit_price", e.target.value)}
                        className="w-full text-sm border border-slate-300 dark:border-white/15 rounded-lg p-2 bg-white dark:bg-[#1C1C1F] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Delivery Lead Time (Days) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={quote.delivery_days || 14}
                        onChange={(e) => handleQuoteChange(line.id || "", "delivery_days", e.target.value)}
                        className="w-full text-sm border border-slate-300 dark:border-white/15 rounded-lg p-2 bg-white dark:bg-[#1C1C1F] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        GST / Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={quote.tax_rate || 0}
                        onChange={(e) => handleQuoteChange(line.id || "", "tax_rate", e.target.value)}
                        className="w-full text-sm border border-slate-300 dark:border-white/15 rounded-lg p-2 bg-white dark:bg-[#1C1C1F] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200 pt-1 font-mono">
                    Line Total: ₹{total.toLocaleString("en-IN")}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-white/10 text-base font-bold font-mono text-slate-900 dark:text-slate-100">
            Total Quotation Amount: ₹{totalQuotedAmount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* Technical & Commercial Compliance */}
        <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-white/10 pb-3">
            2. Commercial Terms & Compliance
          </h2>

          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={technicalCompliant}
                onChange={(e) => setTechnicalCompliant(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                I certify that our offer strictly complies with the technical specifications outlined.
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hasDeviations}
                onChange={(e) => setHasDeviations(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>We have deviations / exceptions to the standard terms or specifications.</span>
            </label>

            {hasDeviations && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Deviation Specifics</label>
                <textarea
                  value={deviationDetails}
                  onChange={(e) => setDeviationDetails(e.target.value)}
                  rows={3}
                  placeholder="Detail exact technical or commercial deviations..."
                  className="w-full text-sm border border-slate-300 dark:border-white/15 rounded-lg p-2.5 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Proposed Payment Terms</label>
                <select
                  value={paymentTermsCode}
                  onChange={(e) => setPaymentTermsCode(e.target.value)}
                  className="w-full text-sm border border-slate-300 dark:border-white/15 rounded-lg p-2 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="NET_30">Net 30 Days</option>
                  <option value="NET_45">Net 45 Days</option>
                  <option value="NET_60">Net 60 Days</option>
                  <option value="IMMEDIATE">Immediate</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Delivery Terms (Incoterm)</label>
                <select
                  value={incoterm}
                  onChange={(e) => setIncoterm(e.target.value)}
                  className="w-full text-sm border border-slate-300 dark:border-white/15 rounded-lg p-2 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {incoterms.length > 0 ? (
                    incoterms.map((it) => (
                      <option key={it.id} value={it.code}>
                        {it.code} — {it.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="DDP">DDP - Delivered Duty Paid</option>
                      <option value="FOB">FOB - Free on Board</option>
                      <option value="CIF">CIF - Cost, Insurance, Freight</option>
                      <option value="EXW">EXW - Ex Works</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bid Validity (Days)</label>
                <input
                  type="number"
                  min={30}
                  max={180}
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  className="w-full text-sm border border-slate-300 dark:border-white/15 rounded-lg p-2 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Covering Letter / Remarks</label>
              <textarea
                value={coveringLetter}
                onChange={(e) => setCoveringLetter(e.target.value)}
                rows={3}
                placeholder="Optional notes or remarks to the committee..."
                className="w-full text-sm border border-slate-300 dark:border-white/15 rounded-lg p-2.5 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
            <Link href="/rfqs">
              <Button variant="secondary" size="md">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isClosed || submitBidMutation.isPending || reviseBidMutation.isPending}
              loading={submitBidMutation.isPending || reviseBidMutation.isPending}
              icon={isClosed ? <Clock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            >
              {isClosed ? "Bidding Closed" : "Encrypt & Submit Sealed Bid"}
            </Button>
          </div>
        </div>
      </form>

      {/* Clarification Q&A thread */}
      <ClarificationThread
        rfqId={rfqId}
        clarifications={rfq.clarifications}
        isBuyer={false}
        onAskQuestion={async (question) => {
          await addClarificationMutation.mutateAsync({ rfq_id: rfqId, question });
        }}
      />
    </div>
  );
}
