"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Kanban,
  List,
  UserCheck,
  Search,
  Filter,
  ArrowUpDown,
  User,
  Clock,
  ExternalLink,
  CheckSquare,
  Square,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  useTickets,
  useBulkAssignTickets,
  useBulkStatusTickets,
} from "@procurement/hooks";
import { CreateTicketModal, TicketSLAIndicator } from "@procurement/ui";
import type {
  TicketListResponse,
  TicketType,
  TicketPriority,
  TicketStatus,
} from "@procurement/types";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  IN_PROGRESS: { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700" },
  PENDING_RESPONSE: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  RESOLVED: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  CLOSED: { bg: "bg-slate-100 border-slate-200", text: "text-slate-600" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: "bg-rose-100", text: "text-rose-800" },
  HIGH: { bg: "bg-amber-100", text: "text-amber-800" },
  MEDIUM: { bg: "bg-blue-100", text: "text-blue-800" },
  LOW: { bg: "bg-slate-100", text: "text-slate-600" },
};

export default function BuyerTicketsPage() {
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [drawerTicket, setDrawerTicket] = useState<TicketListResponse | null>(null);

  const { data: tickets = [], isLoading, refetch } = useTickets({
    search: search || undefined,
    status: (selectedStatus as TicketStatus) || undefined,
    priority: (selectedPriority as TicketPriority) || undefined,
    ticket_type: (selectedType as TicketType) || undefined,
    page,
    page_size: 20,
  });

  const bulkAssignMutation = useBulkAssignTickets();
  const bulkStatusMutation = useBulkStatusTickets();

  const handleSelectAll = () => {
    if (selectedTicketIds.length === tickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(tickets.map((t) => t.id));
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTicketIds.includes(id)) {
      setSelectedTicketIds(selectedTicketIds.filter((item) => item !== id));
    } else {
      setSelectedTicketIds([...selectedTicketIds, id]);
    }
  };

  const handleBulkStatusChange = async (status: TicketStatus) => {
    if (!selectedTicketIds.length) return;
    await bulkStatusMutation.mutateAsync({
      ticket_ids: selectedTicketIds,
      status,
    });
    setSelectedTicketIds([]);
    refetch();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Tickets &amp; Inquiries
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage procurement inquiries, tender clarifications, and vendor disputes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Ticket</span>
          </button>
        </div>
      </div>

      {/* Ticket View Tabs Strip */}
      <div className="w-full flex items-center gap-1.5 p-1.5 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 overflow-x-auto shadow-xs">
        <Link
          href="/tickets"
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm text-center"
        >
          <List className="w-4 h-4 text-blue-600" />
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
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/50 transition-colors text-center"
        >
          <User className="w-4 h-4" />
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

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket #, title, or keywords..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING_RESPONSE">Pending Response</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="RFQ_QUERY">RFQ Query</option>
          <option value="INVOICE_DISPUTE">Invoice Dispute</option>
          <option value="PO_QUERY">PO Query</option>
          <option value="CONTRACT_QUERY">Contract Query</option>
          <option value="VENDOR_ONBOARDING">Vendor Onboarding</option>
          <option value="TECHNICAL_SUPPORT">Technical Support</option>
          <option value="GENERAL">General</option>
        </select>

        <button
          onClick={() => refetch()}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Bulk actions bar */}
      {selectedTicketIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between text-xs text-blue-900 animate-fadeIn">
          <span className="font-semibold">
            {selectedTicketIds.length} ticket(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatusChange("IN_PROGRESS")}
              className="px-3 py-1 bg-white border border-blue-300 rounded font-medium hover:bg-blue-50"
            >
              Mark In Progress
            </button>
            <button
              onClick={() => handleBulkStatusChange("RESOLVED")}
              className="px-3 py-1 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700"
            >
              Resolve Selected
            </button>
            <button
              onClick={() => setSelectedTicketIds([])}
              className="px-2.5 py-1 text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            Loading tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-700">No tickets found</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              No tickets match your filters. Try clearing your search or create a new ticket.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="p-3.5 w-10">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {selectedTicketIds.length === tickets.length && tickets.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-3.5">Ticket #</th>
                  <th className="p-3.5">Title</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Priority</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">SLA Target</th>
                  <th className="p-3.5">Assignee</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tickets.map((ticket) => {
                  const isSelected = selectedTicketIds.includes(ticket.id);
                  const statusStyle = STATUS_COLORS[ticket.status] || STATUS_COLORS.OPEN;
                  const priorityStyle = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.LOW;

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setDrawerTicket(ticket)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isSelected ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <td className="p-3.5" onClick={(e) => handleToggleSelect(ticket.id, e)}>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-xs font-semibold text-blue-600">
                        {ticket.ticket_number}
                      </td>
                      <td className="p-3.5 font-medium text-slate-900 max-w-xs truncate">
                        {ticket.title}
                      </td>
                      <td className="p-3.5">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {ticket.ticket_type}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${priorityStyle.bg} ${priorityStyle.text}`}
                        >
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          {ticket.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <TicketSLAIndicator
                          slaStatus={ticket.sla_status}
                          slaBreachAt={ticket.sla_breach_at}
                          firstResponseAt={ticket.first_response_at}
                          resolvedAt={ticket.resolved_at}
                          status={ticket.status}
                          compact
                        />
                      </td>
                      <td className="p-3.5 text-xs text-slate-500">
                        {ticket.assigned_to ? (
                          <span className="flex items-center gap-1 text-slate-800 font-medium">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{ticket.assigned_to.slice(0, 8)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium p-1 hover:bg-blue-50 rounded"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Drawer Preview */}
      {drawerTicket && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 p-6 overflow-y-auto animate-slideInRight">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
            <div>
              <span className="font-mono text-xs font-semibold text-blue-600">
                {drawerTicket.ticket_number}
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                {drawerTicket.title}
              </h3>
            </div>
            <button
              onClick={() => setDrawerTicket(null)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Status &amp; Priority
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 font-medium text-slate-800">
                  {drawerTicket.status}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
                  {drawerTicket.priority}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                SLA Status
              </span>
              <TicketSLAIndicator
                slaStatus={drawerTicket.sla_status}
                slaBreachAt={drawerTicket.sla_breach_at}
                firstResponseAt={drawerTicket.first_response_at}
                resolvedAt={drawerTicket.resolved_at}
                status={drawerTicket.status}
              />
            </div>

            {drawerTicket.entity_type && (
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Linked Entity
                </span>
                <span className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1 rounded inline-block">
                  {drawerTicket.entity_type.toUpperCase()} • {drawerTicket.entity_id}
                </span>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200">
              <Link
                href={`/tickets/${drawerTicket.id}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <span>View Full Details &amp; Discussion</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <CreateTicketModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
