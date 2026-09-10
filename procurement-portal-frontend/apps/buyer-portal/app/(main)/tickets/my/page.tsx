"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Ticket, Plus, ExternalLink, AlertCircle, List, Kanban, User, UserCheck } from "lucide-react";
import { useMyRaisedTickets } from "@procurement/hooks";
import { TicketSLAIndicator, CreateTicketModal } from "@procurement/ui";

export default function BuyerMyRaisedTicketsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: tickets = [], isLoading, refetch } = useMyRaisedTickets();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Ticket className="w-6 h-6 text-blue-600" />
            <span>Raised by Me</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track inquiries and support tickets that you have submitted.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create Ticket</span>
        </button>
      </div>

      {/* Ticket View Tabs Strip */}
      <div className="w-full flex items-center gap-1.5 p-1.5 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 overflow-x-auto shadow-xs">
        <Link
          href="/tickets"
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/50 transition-colors text-center"
        >
          <List className="w-4 h-4" />
          <span>All Tickets</span>
        </Link>
        <Link
          href="/tickets/board"
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/50 transition-colors text-center"
        >
          <Kanban className="w-4 h-4" />
          <span>Kanban Board</span>
        </Link>
        <Link
          href="/tickets/my"
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm text-center"
        >
          <User className="w-4 h-4 text-blue-600" />
          <span>Raised by Me</span>
        </Link>
        <Link
          href="/tickets/assigned"
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/50 transition-colors text-center"
        >
          <UserCheck className="w-4 h-4" />
          <span>Assigned to Me</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p>You have not raised any tickets yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-blue-600">
                      {ticket.ticket_number}
                    </span>
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-600"
                    >
                      {ticket.title}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="uppercase text-[10px] font-semibold tracking-wider bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                      {ticket.ticket_type}
                    </span>
                    <span>•</span>
                    <span className="font-medium">{ticket.status}</span>
                    <span>•</span>
                    <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <TicketSLAIndicator
                    slaStatus={ticket.sla_status}
                    slaBreachAt={ticket.sla_breach_at}
                    firstResponseAt={ticket.first_response_at}
                    resolvedAt={ticket.resolved_at}
                    status={ticket.status}
                    compact
                  />

                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="p-1 text-slate-400 hover:text-blue-600 rounded"
                    title="Open ticket"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateTicketModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
