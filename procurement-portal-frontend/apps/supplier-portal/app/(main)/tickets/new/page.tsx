"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, AlertCircle, Loader2 } from "lucide-react";
import { useCreateTicket } from "@procurement/hooks";
import type { TicketType, TicketPriority, TicketCreateRequest } from "@procurement/types";

const SUPPLIER_TICKET_TYPES: { value: TicketType; label: string }[] = [
  { value: "RFQ_QUERY", label: "Tender / RFQ Clarification" },
  { value: "INVOICE_DISPUTE", label: "Invoice / Payment Issue" },
  { value: "PO_QUERY", label: "Purchase Order Query" },
  { value: "CONTRACT_QUERY", label: "Contract Inquiry" },
  { value: "VENDOR_ONBOARDING", label: "Profile & Compliance Help" },
  { value: "TECHNICAL_SUPPORT", label: "Portal Technical Support" },
  { value: "GENERAL", label: "General Inquiry" },
];

export default function SupplierNewTicketPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [ticketType, setTicketType] = useState<TicketType>("RFQ_QUERY");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateTicket();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a title for your query");
      return;
    }

    setError(null);
    try {
      const payload: TicketCreateRequest = {
        title: title.trim(),
        ticket_type: ticketType,
        priority,
        description:
          description.trim().length >= 20
            ? description.trim()
            : `${description.trim() ? description.trim() + " - " : ""}Inquiry details for query: ${title.trim()}`,
        entity_type: entityType.trim() || undefined,
        entity_id: entityId.trim() || undefined,
        is_private: false,
      };

      const result = await createMutation.mutateAsync(payload);
      router.push(`/tickets/${result.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to submit query");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Queries</span>
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Submit a Query or Dispute
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Our procurement operations team will review your query and respond within the guaranteed SLA.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject / Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Clarification on Technical Spec Section 3.2"
              className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Query Type
              </label>
              <select
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value as TicketType)}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {SUPPLIER_TICKET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="LOW">Low (Standard clarification)</option>
                <option value="MEDIUM">Medium (Normal inquiry)</option>
                <option value="HIGH">High (Bid deadline approaching)</option>
                <option value="CRITICAL">Critical (Urgent blocker / payment dispute)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Related Entity Type (Optional)
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">None / Not Applicable</option>
                <option value="rfq">RFQ / Tender</option>
                <option value="purchase_order">Purchase Order</option>
                <option value="invoice">Invoice</option>
                <option value="contract">Contract</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reference / Number (Optional)
              </label>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="e.g. RFQ-2026-0042 or PO-10023"
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description &amp; Question Details <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your query in detail, including references to specific clauses, amounts, or line items..."
              className="w-full text-sm p-3.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              href="/tickets"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending || !title.trim()}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Submit Query</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
