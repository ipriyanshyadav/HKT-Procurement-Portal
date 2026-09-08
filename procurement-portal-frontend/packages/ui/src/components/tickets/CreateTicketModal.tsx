"use client";

import React, { useState } from "react";
import { X, AlertCircle, Loader2, Calendar, Sliders } from "lucide-react";
import { useCreateTicket, useCustomFieldDefs } from "@procurement/hooks";
import type {
  TicketType,
  TicketPriority,
  TicketCreateRequest,
  TicketDetailResponse,
  CustomFieldDefItem,
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
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState(initialEntityType || "");
  const [entityId, setEntityId] = useState(initialEntityId || "");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateTicket();
  const { data: customFieldDefs = [] } = useCustomFieldDefs();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a ticket title");
      return;
    }

    // Validate required custom fields
    for (const def of customFieldDefs) {
      if (def.is_required && (customFieldValues[def.id] === undefined || customFieldValues[def.id] === "")) {
        setError(`Custom field "${def.name}" is required.`);
        return;
      }
    }

    setError(null);
    try {
      const cfPayload: any[] = [];
      for (const [defId, val] of Object.entries(customFieldValues)) {
        if (val === "" || val === null || val === undefined) continue;
        const def = customFieldDefs.find((d) => d.id === defId);
        if (!def) continue;
        if (def.field_type === "NUMBER") {
          cfPayload.push({ field_def_id: defId, value_number: Number(val) });
        } else if (def.field_type === "BOOLEAN") {
          cfPayload.push({ field_def_id: defId, value_json: Boolean(val) });
        } else if (def.field_type === "MULTI_SELECT") {
          const arr = typeof val === "string" ? val.split(",").map((s) => s.trim()).filter(Boolean) : val;
          cfPayload.push({ field_def_id: defId, value_json: arr });
        } else {
          cfPayload.push({ field_def_id: defId, value_text: String(val) });
        }
      }

      const payload: TicketCreateRequest = {
        title: title.trim(),
        ticket_type: ticketType,
        priority,
        due_date: dueDate || undefined,
        description:
          description.trim().length >= 20
            ? description.trim()
            : `${description.trim() ? description.trim() + " - " : ""}Inquiry details for ticket: ${title.trim()}`,
        entity_type: entityType.trim() || undefined,
        entity_id: entityId.trim() || undefined,
        is_private: false,
        custom_fields: cfPayload.length > 0 ? cfPayload : undefined,
      };

      const result = await createMutation.mutateAsync(payload);
      onCreated?.(result);
      onClose();
      // Reset
      setTitle("");
      setDescription("");
      setDueDate("");
      setCustomFieldValues({});
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Due Date (Optional)
            </label>
            <div className="relative">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              />
            </div>
          </div>

          {customFieldDefs && customFieldDefs.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Custom Fields ({customFieldDefs.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customFieldDefs.map((def: CustomFieldDefItem) => {
                  const val = customFieldValues[def.id] ?? "";
                  return (
                    <div key={def.id}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {def.name} {def.is_required && <span className="text-rose-500">*</span>}
                      </label>
                      {def.field_type === "TEXT" && (
                        <input
                          type="text"
                          required={def.is_required}
                          value={val}
                          onChange={(e) =>
                            setCustomFieldValues({ ...customFieldValues, [def.id]: e.target.value })
                          }
                          placeholder={`Enter ${def.name}`}
                          className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      )}
                      {def.field_type === "NUMBER" && (
                        <input
                          type="number"
                          required={def.is_required}
                          value={val}
                          onChange={(e) =>
                            setCustomFieldValues({ ...customFieldValues, [def.id]: Number(e.target.value) })
                          }
                          placeholder="0"
                          className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      )}
                      {def.field_type === "DATE" && (
                        <input
                          type="date"
                          required={def.is_required}
                          value={val}
                          onChange={(e) =>
                            setCustomFieldValues({ ...customFieldValues, [def.id]: e.target.value })
                          }
                          className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      )}
                      {def.field_type === "SELECT" && (
                        <select
                          required={def.is_required}
                          value={val}
                          onChange={(e) =>
                            setCustomFieldValues({ ...customFieldValues, [def.id]: e.target.value })
                          }
                          className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">Select an option</option>
                          {def.options?.map((opt: any, i: number) => (
                            <option key={i} value={String(opt)}>
                              {String(opt)}
                            </option>
                          ))}
                        </select>
                      )}
                      {def.field_type === "BOOLEAN" && (
                        <div className="flex items-center gap-2 pt-2">
                          <input
                            type="checkbox"
                            id={`check-${def.id}`}
                            checked={Boolean(val)}
                            onChange={(e) =>
                              setCustomFieldValues({ ...customFieldValues, [def.id]: e.target.checked })
                            }
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <label htmlFor={`check-${def.id}`} className="text-xs text-slate-700">
                            Yes / Enabled
                          </label>
                        </div>
                      )}
                      {def.field_type === "MULTI_SELECT" && (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) =>
                            setCustomFieldValues({ ...customFieldValues, [def.id]: e.target.value })
                          }
                          placeholder="Comma-separated selections"
                          className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
