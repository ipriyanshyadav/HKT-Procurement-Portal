"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Search, HelpCircle, ExternalLink, Clock, CheckCircle2 } from "lucide-react";
import { useTickets } from "@procurement/hooks";
import { TicketSLAIndicator } from "@procurement/ui";
import type { TicketStatus } from "@procurement/types";

export default function SupplierTicketsPage() {
  const [tab, setTab] = useState<"all" | "open" | "resolved">("all");
  const [search, setSearch] = useState("");

  const statusFilter: TicketStatus | undefined =
    tab === "open" ? "OPEN" : tab === "resolved" ? "RESOLVED" : undefined;

  const { data: tickets = [], isLoading, refetch } = useTickets({
    search: search || undefined,
    status: statusFilter,
    page_size: 50,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Queries &amp; Support
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track inquiries, invoice disputes, and tender clarifications with the buyer team.
          </p>
        </div>

        <Link
          href="/tickets/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Raise New Query</span>
        </Link>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex-1 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`flex-1 py-2 px-4 text-xs font-semibold rounded-lg transition-colors text-center flex items-center justify-center ${
              tab === "all" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            All Queries
          </button>
          <button
            type="button"
            onClick={() => setTab("open")}
            className={`flex-1 py-2 px-4 text-xs font-semibold rounded-lg transition-colors text-center flex items-center justify-center ${
              tab === "open" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Active &amp; Pending
          </button>
          <button
            type="button"
            onClick={() => setTab("resolved")}
            className={`flex-1 py-2 px-4 text-xs font-semibold rounded-lg transition-colors text-center flex items-center justify-center ${
              tab === "resolved" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Resolved &amp; Closed
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queries..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading queries...</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-base font-medium text-slate-700">No queries found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You haven&apos;t submitted any questions or disputes yet. If you have questions regarding a tender or payment, click &ldquo;Raise New Query&rdquo;.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors block"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {ticket.ticket_number}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {ticket.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="uppercase text-[10px] font-semibold tracking-wider text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {ticket.ticket_type}
                    </span>
                    {ticket.entity_type && (
                      <span>• {ticket.entity_type.toUpperCase()}</span>
                    )}
                    <span>• Status: {ticket.status}</span>
                    <span>• {new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <TicketSLAIndicator
                    slaStatus={ticket.sla_status}
                    slaBreachAt={ticket.sla_breach_at}
                    firstResponseAt={ticket.first_response_at}
                    resolvedAt={ticket.resolved_at}
                    status={ticket.status}
                    compact
                  />
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
