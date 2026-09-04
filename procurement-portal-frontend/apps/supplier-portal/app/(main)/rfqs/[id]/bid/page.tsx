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
} from "@procurement/hooks";
import { ClarificationThread } from "@procurement/ui";

export default function SupplierBidSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params?.id as string;

  const { data: rfq, isLoading, isError } = useRfq(rfqId);
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
    return <div className="p-12 text-center text-sm text-gray-500">Loading tender specifications...</div>;
  }
  if (isError || !rfq) {
    return <div className="p-12 text-center text-sm text-red-500">Failed to load tender.</div>;
  }

  const isClosed = rfq.bid_close_at && new Date(rfq.bid_close_at) < new Date();

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
      <div className="border-b pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/rfqs" className="hover:underline">Tenders</Link>
            <span>/</span>
            <span className="font-mono">{rfq.rfq_number}</span>
            <span>/</span>
            <span>Commercial Quotation</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bid Submission</h1>
          <p className="text-sm text-gray-500 mt-1">
            Provide your unit pricing and delivery lead times. All financial data is encrypted end-to-end.
          </p>
        </div>

        <div>
          <Link
            href={`/rfqs/${rfqId}/auction`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white shadow-sm transition"
          >
            <span>⚡ Enter Live Auction</span>
          </Link>
        </div>
      </div>

      {/* Sealed Encryption Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <span className="text-lg">🛡️</span>
        <div>
          <span className="font-bold block">Cryptographic Envelope Active</span>
          Your quoted prices are encrypted with AES-256 before storage in our databases. The procurement team cannot view your financial submission until the tender closes and two committee members co-authorize opening.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line Items Pricing Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900 border-b pb-3">
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
                <div key={line.id || idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-blue-600 font-mono block">Line #{line.line_number}</span>
                      <h4 className="font-semibold text-gray-900 text-sm">{line.item_description}</h4>
                      {line.specifications && (
                        <p className="text-xs text-gray-500 mt-0.5">{line.specifications}</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-white border rounded">
                      Qty: {Number(line.quantity)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
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
                        className="w-full text-sm border rounded-lg p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Delivery Lead Time (Days) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={quote.delivery_days || 14}
                        onChange={(e) => handleQuoteChange(line.id || "", "delivery_days", e.target.value)}
                        className="w-full text-sm border rounded-lg p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        GST / Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={quote.tax_rate || 0}
                        onChange={(e) => handleQuoteChange(line.id || "", "tax_rate", e.target.value)}
                        className="w-full text-sm border rounded-lg p-2 bg-white"
                      />
                    </div>
                  </div>

                  <div className="text-right text-xs font-semibold text-gray-800 pt-1">
                    Line Total: ₹{total.toLocaleString("en-IN")}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-3 border-t text-base font-bold text-gray-900">
            Total Quotation Amount: ₹{totalQuotedAmount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* Technical & Commercial Compliance */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-gray-900 border-b pb-3">
            2. Commercial Terms & Compliance
          </h2>

          <div className="space-y-4 text-xs text-gray-700">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={technicalCompliant}
                onChange={(e) => setTechnicalCompliant(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span className="font-semibold text-gray-900">
                I certify that our offer strictly complies with the technical specifications outlined.
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hasDeviations}
                onChange={(e) => setHasDeviations(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>We have deviations / exceptions to the standard terms or specifications.</span>
            </label>

            {hasDeviations && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deviation Specifics</label>
                <textarea
                  value={deviationDetails}
                  onChange={(e) => setDeviationDetails(e.target.value)}
                  rows={3}
                  placeholder="Detail exact technical or commercial deviations..."
                  className="w-full text-sm border rounded-lg p-2.5"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Proposed Payment Terms</label>
                <select
                  value={paymentTermsCode}
                  onChange={(e) => setPaymentTermsCode(e.target.value)}
                  className="w-full text-sm border rounded-lg p-2 bg-white"
                >
                  <option value="NET_30">Net 30 Days</option>
                  <option value="NET_45">Net 45 Days</option>
                  <option value="NET_60">Net 60 Days</option>
                  <option value="IMMEDIATE">Immediate</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Delivery Terms (Incoterm)</label>
                <select
                  value={incoterm}
                  onChange={(e) => setIncoterm(e.target.value)}
                  className="w-full text-sm border rounded-lg p-2 bg-white"
                >
                  <option value="DDP">DDP - Delivered Duty Paid</option>
                  <option value="FOB">FOB - Free on Board</option>
                  <option value="CIF">CIF - Cost, Insurance, Freight</option>
                  <option value="EXW">EXW - Ex Works</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bid Validity (Days)</label>
                <input
                  type="number"
                  min={30}
                  max={180}
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  className="w-full text-sm border rounded-lg p-2 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Covering Letter / Remarks</label>
              <textarea
                value={coveringLetter}
                onChange={(e) => setCoveringLetter(e.target.value)}
                rows={3}
                placeholder="Optional notes or remarks to the committee..."
                className="w-full text-sm border rounded-lg p-2.5"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link href="/rfqs" className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Back
            </Link>
            <button
              type="submit"
              disabled={isClosed || submitBidMutation.isPending || reviseBidMutation.isPending}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm disabled:opacity-50"
            >
              {submitBidMutation.isPending || reviseBidMutation.isPending
                ? "Encrypting & Submitting..."
                : isClosed
                ? "Bidding Closed"
                : "Encrypt & Submit Sealed Bid"}
            </button>
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
