"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, MessageSquare, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { useEntityTickets } from "@procurement/hooks";
import { CreateTicketModal } from "./CreateTicketModal";
import { TicketSLAIndicator } from "./TicketSLAIndicator";
import type { TicketListResponse } from "@procurement/types";

interface EntityTicketsTabProps {
  entityType: string;
  entityId: string;
  isSupplier?: boolean;
}

export function EntityTicketsTab({
  entityType,
  entityId,
  isSupplier = false,
}: EntityTicketsTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: tickets = [], isLoading, refetch } = useEntityTickets(entityType, entityId);

  const basePath = isSupplier ? "/tickets" : "/tickets";

  const openCount = tickets.filter(
    (t) => t.status === "OPEN" || t.status === "IN_PROGRESS"
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Queries & Support Tickets ({tickets.length})
          </h3>
          <p className="text-xs text-slate-500">
            {openCount} active {openCount === 1 ? "query" : "queries"} linked to this {entityType.toUpperCase()}
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Query</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600 font-medium">No queries raised yet</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Need clarification on this {entityType}? Click &ldquo;New Query&rdquo; to open a ticket.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white overflow-hidden">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`${basePath}/${ticket.id}`}
              className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors block"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-blue-600">
                    {ticket.ticket_number}
                  </span>
                  <span className="text-xs font-medium text-slate-900">
                    {ticket.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">
                    {ticket.ticket_type}
                  </span>
                  <span>•</span>
                  <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span className="font-medium text-slate-700">{ticket.status}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <TicketSLAIndicator
                  slaStatus={ticket.sla_status}
                  slaBreachAt={ticket.sla_breach_at}
                  firstResponseAt={ticket.first_response_at}
                  resolvedAt={ticket.resolved_at}
                  status={ticket.status}
                  compact
                />
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateTicketModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        initialEntityType={entityType}
        initialEntityId={entityId}
        isSupplier={isSupplier}
        onCreated={() => refetch()}
      />
    </div>
  );
}
