"use client";

import React, { useState } from "react";
import Link from "next/link";
import { UserCheck, ExternalLink, Clock, AlertCircle } from "lucide-react";
import { useMyAssignedTickets } from "@procurement/hooks";
import { TicketSLAIndicator } from "@procurement/ui";

export default function BuyerAssignedTicketsPage() {
  const { data: tickets = [], isLoading, refetch } = useMyAssignedTickets();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-blue-600" />
            <span>Assigned to Me</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inquiries and tickets where you are the designated assignee.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading assigned tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p>You have no tickets currently assigned to you.</p>
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
                    <span>Priority: {ticket.priority}</span>
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
    </div>
  );
}
