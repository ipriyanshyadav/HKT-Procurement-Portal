"use client";

import React, { useState } from "react";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { useCreateTicket } from "@procurement/hooks";
import type {
  TicketType,
  TicketPriority,
  TicketCreateRequest,
  TicketDetailResponse,
} from "@procurement/types";

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (ticket: TicketDetailResponse) => void;
  initialEntityType?: string;
  initialEntityId?: string;
  isSupplier?: boolean;
}

const TICKET_TYPES: { value: TicketType; label: string }[] = [
  { value: "RFQ_QUERY", label: "RFQ / Tender Query" },
  { value: "INVOICE_DISPUTE", label: "Invoice Dispute" },
  { value: "PO_QUERY", label: "Purchase Order Query" },
  { value: "CONTRACT_QUERY", label: "Contract Clarification" },
  { value: "VENDOR_ONBOARDING", label: "Vendor Onboarding / Compliance" },
  { value: "TECHNICAL_SUPPORT", label: "Technical Support" },
  { value: "GENERAL", label: "General Inquiry" },
];

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

export function CreateTicketModal({
  isOpen,
  onClose,
  onCreated,
  initialEntityType,
  initialEntityId,
  isSupplier = false,
}: CreateTicketModalProps) {
  const [title, setTitle] = useState("");
  const [ticketType, setTicketType] = useState<TicketType>("GENERAL");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState(initialEntityType || "");
  const [entityId, setEntityId] = useState(initialEntityId || "");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateTicket();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a ticket title");
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
            : `${description.trim() ? description.trim() + " - " : ""}Inquiry details for ticket: ${title.trim()}`,
        entity_type: entityType.trim() || undefined,
        entity_id: entityId.trim() || undefined,
        is_private: false,
      };

      const result = await createMutation.mutateAsync(payload);
      onCreated?.(result);
      onClose();
      // Reset
      setTitle("");
      setDescription("");
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to create ticket");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {isSupplier ? "Raise a Query / Ticket" : "Create New Ticket"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summary of the issue or inquiry"
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ticket Type
              </label>
              <select
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value as TicketType)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {TICKET_TYPES.map((t) => (
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
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed information, context, or expected outcome (min 20 characters)..."
              className="w-full text-sm p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Related Entity Type (Optional)
              </label>
              <input
                type="text"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                placeholder="e.g. rfq, po, invoice"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Related Entity ID (Optional)
              </label>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="UUID or Reference"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !title.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create Ticket</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
