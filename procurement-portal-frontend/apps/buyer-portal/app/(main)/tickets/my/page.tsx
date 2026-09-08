"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Ticket, Plus, ExternalLink, AlertCircle } from "lucide-react";
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
