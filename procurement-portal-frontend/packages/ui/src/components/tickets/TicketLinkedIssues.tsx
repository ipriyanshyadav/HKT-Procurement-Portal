"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Link2, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { useTicketLinks, useCreateTicketLink, useRemoveTicketLink } from "@procurement/hooks";
import type { TicketLinkItem, TicketLinkType } from "@procurement/types";

interface TicketLinkedIssuesProps {
  ticketId: string;
  canLink?: boolean;
}

const LINK_TYPE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  BLOCKS: { label: "Blocks", bg: "bg-rose-100", text: "text-rose-800" },
  IS_BLOCKED_BY: { label: "Is blocked by", bg: "bg-rose-50", text: "text-rose-700" },
  RELATES_TO: { label: "Relates to", bg: "bg-blue-100", text: "text-blue-800" },
  DUPLICATES: { label: "Duplicates", bg: "bg-purple-100", text: "text-purple-800" },
  IS_DUPLICATED_BY: { label: "Is duplicated by", bg: "bg-purple-50", text: "text-purple-700" },
  CLONES: { label: "Clones", bg: "bg-teal-100", text: "text-teal-800" },
  IS_CLONED_BY: { label: "Is cloned by", bg: "bg-teal-50", text: "text-teal-700" },
};

const LINK_TYPES: { value: TicketLinkType; label: string }[] = [
  { value: "BLOCKS", label: "Blocks" },
  { value: "IS_BLOCKED_BY", label: "Is blocked by" },
  { value: "RELATES_TO", label: "Relates to" },
  { value: "DUPLICATES", label: "Duplicates" },
  { value: "IS_DUPLICATED_BY", label: "Is duplicated by" },
  { value: "CLONES", label: "Clones" },
  { value: "IS_CLONED_BY", label: "Is cloned by" },
];

export function TicketLinkedIssues({ ticketId, canLink = true }: TicketLinkedIssuesProps) {
  const { data: links = [], isLoading, refetch } = useTicketLinks(ticketId);
  const createLink = useCreateTicketLink();
  const removeLink = useRemoveTicketLink();

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedType, setSelectedType] = useState<TicketLinkType>("RELATES_TO");
  const [targetTicketId, setTargetTicketId] = useState("");
  const [formError, setFormError] = useState("");

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTicketId.trim()) {
      setFormError("Please provide a target ticket UUID or ID.");
      return;
    }
    setFormError("");
    try {
      await createLink.mutateAsync({
        ticketId,
        data: {
          target_ticket_id: targetTicketId.trim(),
          link_type: selectedType,
        },
      });
      setTargetTicketId("");
      setShowAddForm(false);
      refetch();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || err?.message || "Failed to link ticket");
    }
  };

  const handleRemove = async (linkId: string) => {
    try {
      await removeLink.mutateAsync({ ticketId, linkId });
      refetch();
    } catch {
      // Handled by mutation state
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-800">
            Linked Issues <span className="text-slate-400 font-normal">({links.length})</span>
          </h3>
        </div>
        {canLink && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Link Issue
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateLink} className="mb-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
          <div className="font-semibold text-slate-700 mb-2">Create Issue Relationship</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-slate-500 mb-1">Relationship</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as TicketLinkType)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {LINK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    This ticket {t.label.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Target Ticket ID (UUID)</label>
              <input
                type="text"
                placeholder="Paste ticket UUID..."
                value={targetTicketId}
                onChange={(e) => setTargetTicketId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
          {formError && (
            <div className="flex items-center gap-1 text-rose-600 mb-2 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{formError}</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLink.isPending}
              className="px-3 py-1 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
            >
              {createLink.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Link
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-xs text-slate-400">Loading links...</div>
      ) : links.length === 0 ? (
        <div className="text-xs text-slate-400 italic py-2">No linked issues for this ticket.</div>
      ) : (
        <div className="space-y-2">
          {links.map((link: TicketLinkItem) => {
            const typeInfo = LINK_TYPE_LABELS[link.link_type] || {
              label: link.link_type,
              bg: "bg-slate-100",
              text: "text-slate-700",
            };
            return (
              <div
                key={link.id}
                className="flex items-center justify-between p-2 rounded border border-slate-100 hover:bg-slate-50 transition-colors text-xs"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${typeInfo.bg} ${typeInfo.text}`}>
                    {typeInfo.label}
                  </span>
                  <Link
                    href={`/tickets/${link.target_ticket_id}`}
                    className="font-mono font-medium text-blue-600 hover:underline"
                  >
                    {link.target_ticket_number || link.target_ticket_id.slice(0, 8)}
                  </Link>
                  <span className="text-slate-700 max-w-xs truncate" title={link.target_ticket_title || ""}>
                    {link.target_ticket_title || "Linked ticket"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {link.target_ticket_priority && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {link.target_ticket_priority}
                    </span>
                  )}
                  {link.target_ticket_status && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      {link.target_ticket_status}
                    </span>
                  )}
                  {canLink && (
                    <button
                      onClick={() => handleRemove(link.id)}
                      disabled={removeLink.isPending}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded"
                      title="Remove link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
