"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Link2, Plus, Trash2, Loader2, AlertCircle, Search, X } from "lucide-react";
import { useTicketLinks, useCreateTicketLink, useRemoveTicketLink, useTickets } from "@procurement/hooks";
import type { TicketLinkItem, TicketLinkType, TicketListResponse } from "@procurement/types";

interface TicketLinkedIssuesProps {
  ticketId: string;
  canLink?: boolean;
}

const LINK_TYPE_LABELS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  BLOCKS: {
    label: "Blocks",
    bg: "bg-rose-100 dark:bg-rose-950/60",
    text: "text-rose-800 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800/70",
  },
  IS_BLOCKED_BY: {
    label: "Is blocked by",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-900/60",
  },
  RELATES_TO: {
    label: "Relates to",
    bg: "bg-blue-100 dark:bg-blue-950/60",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800/70",
  },
  DUPLICATES: {
    label: "Duplicates",
    bg: "bg-purple-100 dark:bg-purple-950/60",
    text: "text-purple-800 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800/70",
  },
  IS_DUPLICATED_BY: {
    label: "Is duplicated by",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-900/60",
  },
  CLONES: {
    label: "Clones",
    bg: "bg-teal-100 dark:bg-teal-950/60",
    text: "text-teal-800 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800/70",
  },
  IS_CLONED_BY: {
    label: "Is cloned by",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-400",
    border: "border-teal-200 dark:border-teal-900/60",
  },
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
  const [targetTicketLabel, setTargetTicketLabel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [formError, setFormError] = useState("");

  // Query tickets matching search
  const { data: searchResults = [], isLoading: isSearching } = useTickets({
    search: searchQuery.trim() || undefined,
    page_size: 6,
  });

  const availableTickets = searchResults.filter((t) => t.id !== ticketId);

  const handleSelectTicket = (t: TicketListResponse) => {
    setTargetTicketId(t.id);
    setTargetTicketLabel(`${t.ticket_number} — ${t.title}`);
    setSearchQuery("");
  };

  const handleClearSelected = () => {
    setTargetTicketId("");
    setTargetTicketLabel("");
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTargetId = targetTicketId.trim() || searchQuery.trim();
    if (!finalTargetId) {
      setFormError("Please select a target ticket or paste a ticket UUID.");
      return;
    }
    setFormError("");
    try {
      await createLink.mutateAsync({
        ticketId,
        data: {
          target_ticket_id: finalTargetId,
          link_type: selectedType,
        },
      });
      setTargetTicketId("");
      setTargetTicketLabel("");
      setSearchQuery("");
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
    <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-5 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-3.5 border-b border-slate-100 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Linked Issues{" "}
            <span className="text-slate-400 dark:text-slate-500 font-normal">
              ({links.length})
            </span>
          </h3>
        </div>
        {canLink && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-3 py-1.5 rounded-xl border border-blue-200/60 dark:border-blue-800/60 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Link Issue</span>
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleCreateLink}
          className="mb-4 p-4 bg-slate-50 dark:bg-[#252529] rounded-xl border border-slate-200 dark:border-white/15 text-xs space-y-3"
        >
          <div className="font-semibold text-slate-800 dark:text-white">
            Create Issue Relationship
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">
                Relationship
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as TicketLinkType)}
                className="w-full bg-white dark:bg-[#1C1C1F] border border-slate-300 dark:border-white/15 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LINK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    This ticket {t.label.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">
                Target Ticket
              </label>

              {targetTicketLabel ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200">
                  <span className="font-medium truncate mr-2">{targetTicketLabel}</span>
                  <button
                    type="button"
                    onClick={handleClearSelected}
                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded text-blue-700 dark:text-blue-300"
                    title="Clear selection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search ticket # or title, or paste UUID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white dark:bg-[#1C1C1F] border border-slate-300 dark:border-white/15 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {isSearching && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 absolute right-2.5 top-2.5" />
                    )}
                  </div>

                  {searchQuery.trim().length > 0 && availableTickets.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#1C1C1F] border border-slate-200 dark:border-white/15 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-white/10">
                      {availableTickets.map((ticketItem) => (
                        <button
                          key={ticketItem.id}
                          type="button"
                          onClick={() => handleSelectTicket(ticketItem)}
                          className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-[#252529] transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="truncate">
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 mr-1.5">
                              {ticketItem.ticket_number}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {ticketItem.title}
                            </span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 uppercase font-medium flex-shrink-0">
                            {ticketItem.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFormError("");
                setTargetTicketId("");
                setTargetTicketLabel("");
                setSearchQuery("");
              }}
              className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLink.isPending}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-xs"
            >
              {createLink.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Link Issue</span>
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500">
          Loading linked issues...
        </div>
      ) : links.length === 0 ? (
        <div className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
          No linked issues for this ticket.
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link: TicketLinkItem) => {
            const typeInfo = LINK_TYPE_LABELS[link.link_type] || {
              label: link.link_type,
              bg: "bg-slate-100 dark:bg-white/10",
              text: "text-slate-700 dark:text-slate-300",
              border: "border-slate-200 dark:border-white/15",
            };
            return (
              <div
                key={link.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/10 hover:bg-slate-50/80 dark:hover:bg-[#252529] transition-colors text-xs"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border ${typeInfo.bg} ${typeInfo.text} ${typeInfo.border}`}
                  >
                    {typeInfo.label}
                  </span>
                  <Link
                    href={`/tickets/${link.target_ticket_id}`}
                    className="font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {link.target_ticket_number || link.target_ticket_id.slice(0, 8)}
                  </Link>
                  <span
                    className="text-slate-700 dark:text-slate-300 max-w-sm truncate"
                    title={link.target_ticket_title || ""}
                  >
                    {link.target_ticket_title || "Linked ticket"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {link.target_ticket_priority && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#252529] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/10">
                      {link.target_ticket_priority}
                    </span>
                  )}
                  {link.target_ticket_status && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                      {link.target_ticket_status}
                    </span>
                  )}
                  {canLink && (
                    <button
                      onClick={() => handleRemove(link.id)}
                      disabled={removeLink.isPending}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg transition-colors"
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
