"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  LifeBuoy,
  Search,
  User,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Timer,
  CheckSquare,
  Square,
} from "lucide-react";
import { useTickets, useBulkStatusTickets, useBulkAssignTickets } from "@procurement/hooks";
import { TicketSLAIndicator } from "@procurement/ui";
import type { TicketStatus, TicketPriority, TicketType, TicketListResponse } from "@procurement/types";

export default function AdminTicketsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [drawerTicket, setDrawerTicket] = useState<TicketListResponse | null>(null);

  const { data: tickets = [], isLoading, refetch } = useTickets({
    search: search || undefined,
    status: (status as TicketStatus) || undefined,
    priority: (priority as TicketPriority) || undefined,
    page_size: 100,
  });

  const bulkStatus = useBulkStatusTickets();
  const bulkAssign = useBulkAssignTickets();

  const handleSelectAll = () => {
    if (selectedIds.length === tickets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tickets.map((t) => t.id));
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedIds.length || !assigneeId.trim()) return;
    await bulkAssign.mutateAsync({
      ticket_ids: selectedIds,
      assigned_to: assigneeId.trim(),
    });
    setSelectedIds([]);
    setAssigneeId("");
    refetch();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-blue-600" />
            <span>Support Tickets &amp; SLA Management</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Global queue of buyer inquiries, vendor queries, and SLA tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/tickets/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <span>SLA Dashboard</span>
          </Link>
          <Link
            href="/tickets/sla-config"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Timer className="w-4 h-4" />
            <span>Configure SLAs</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, titles, or authors..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING_RESPONSE">Pending Response</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <button
          onClick={() => refetch()}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Bulk Action Controls */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-4 text-xs">
          <span className="font-semibold text-blue-900">
            {selectedIds.length} tickets selected
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Assignee User UUID"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="px-2 py-1 border border-blue-200 rounded text-xs w-48"
            />
            <button
              onClick={handleBulkAssign}
              disabled={!assigneeId.trim()}
              className="px-3 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Assign
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-sm">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No tickets found</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="p-3.5 w-10">
                  <button onClick={handleSelectAll}>
                    {selectedIds.length === tickets.length && tickets.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
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
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => {
                const isSelected = selectedIds.includes(t.id);
                const isDrawerActive = drawerTicket?.id === t.id;

                return (
                  <tr
                    key={t.id}
                    onClick={() => setDrawerTicket(t)}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                      isDrawerActive
                        ? "bg-blue-50/70"
                        : isSelected
                        ? "bg-blue-50/30"
                        : ""
                    }`}
                  >
                    <td
                      className="p-3.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(t.id, e);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-xs font-semibold text-blue-600">
                      {t.ticket_number}
                    </td>
                    <td className="p-3.5 font-medium text-slate-900 max-w-xs truncate">
                      {t.title}
                    </td>
                    <td className="p-3.5 text-xs text-slate-600 uppercase font-medium">{t.ticket_type}</td>
                    <td className="p-3.5 text-xs font-semibold">{t.priority}</td>
                    <td className="p-3.5 text-xs font-medium">{t.status}</td>
                    <td className="p-3.5">
                      <TicketSLAIndicator
                        slaStatus={t.sla_status}
                        slaBreachAt={t.sla_breach_at}
                        firstResponseAt={t.first_response_at}
                        resolvedAt={t.resolved_at}
                        status={t.status}
                        compact
                      />
                    </td>
                    <td className="p-3.5 text-xs text-slate-500">
                      {t.assigned_to ? (
                        <span className="flex items-center gap-1 text-slate-800 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.assigned_to.slice(0, 8)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/tickets/${t.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium p-1 hover:bg-blue-50 rounded"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Drawer Preview */}
      {drawerTicket && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/20 z-40 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerTicket(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 p-6 overflow-y-auto">
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
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                aria-label="Close drawer"
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
                  <span className="text-xs px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-600 uppercase">
                    {drawerTicket.ticket_type}
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

              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Assignee
                </span>
                <span className="text-xs text-slate-700 font-medium">
                  {drawerTicket.assigned_to ? drawerTicket.assigned_to : "Unassigned"}
                </span>
              </div>

              {drawerTicket.entity_type && (
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Linked Entity
                  </span>
                  <span className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1 rounded inline-block font-mono">
                    {drawerTicket.entity_type.toUpperCase()} • {drawerTicket.entity_id}
                  </span>
                </div>
              )}

              {drawerTicket.description && (
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Description
                  </span>
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap">
                    {drawerTicket.description}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200">
                <Link
                  href={`/tickets/${drawerTicket.id}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <span>Open Full Ticket Workspace</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
