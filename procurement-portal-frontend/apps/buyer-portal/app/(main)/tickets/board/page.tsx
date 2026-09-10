"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Plus,
  List,
  Kanban,
  User,
  UserCheck,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  useTickets,
  useStartTicketProgress,
  useSetTicketPendingResponse,
  useResolveTicket,
  useCloseTicket,
  useReopenTicket,
} from "@procurement/hooks";
import { TicketCard, CreateTicketModal, Button } from "@procurement/ui";
import type { TicketListResponse, TicketStatus } from "@procurement/types";
import { Search } from "lucide-react";

interface Column {
  id: TicketStatus;
  title: string;
  badgeBg: string;
  badgeText: string;
}

const COLUMNS: Column[] = [
  { id: "OPEN", title: "Open", badgeBg: "bg-blue-100 dark:bg-blue-950/60", badgeText: "text-blue-800 dark:text-blue-300" },
  { id: "IN_PROGRESS", title: "In Progress", badgeBg: "bg-indigo-100 dark:bg-indigo-950/60", badgeText: "text-indigo-800 dark:text-indigo-300" },
  { id: "PENDING_RESPONSE", title: "Pending Response", badgeBg: "bg-amber-100 dark:bg-amber-950/60", badgeText: "text-amber-800 dark:text-amber-300" },
  { id: "RESOLVED", title: "Resolved", badgeBg: "bg-emerald-100 dark:bg-emerald-950/60", badgeText: "text-emerald-800 dark:text-emerald-300" },
  { id: "CLOSED", title: "Closed", badgeBg: "bg-slate-100 dark:bg-white/10", badgeText: "text-slate-700 dark:text-slate-300" },
];

export default function BuyerTicketsBoardPage() {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<TicketListResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const { data: tickets = [], isLoading, refetch } = useTickets({ page_size: 100 });

  const startProgress = useStartTicketProgress();
  const setPending = useSetTicketPendingResponse();
  const resolve = useResolveTicket();
  const close = useCloseTicket();
  const reopen = useReopenTicket();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: any) => {
    const { active } = event;
    const ticket = tickets.find((t) => t.id === active.id);
    if (ticket) setActiveTicket(ticket);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);

    if (!over) return;

    const activeId = active.id as string;
    const currentTicket = tickets.find((t) => t.id === activeId);
    if (!currentTicket) return;

    // The over target might be a column container ID or another ticket
    let targetStatus: TicketStatus | null = null;
    if (COLUMNS.some((col) => col.id === over.id)) {
      targetStatus = over.id as TicketStatus;
    } else {
      const overTicket = tickets.find((t) => t.id === over.id);
      if (overTicket) {
        targetStatus = overTicket.status as TicketStatus;
      }
    }

    if (!targetStatus || targetStatus === currentTicket.status) return;

    try {
      if (targetStatus === "IN_PROGRESS") {
        await startProgress.mutateAsync(activeId);
      } else if (targetStatus === "PENDING_RESPONSE") {
        await setPending.mutateAsync({
          id: activeId,
          data: { reason: "Awaiting additional input" },
        });
      } else if (targetStatus === "RESOLVED") {
        await resolve.mutateAsync({
          id: activeId,
          data: { resolution_note: "Resolved via board status transition" },
        });
      } else if (targetStatus === "CLOSED") {
        await close.mutateAsync({
          id: activeId,
          data: {},
        });
      } else if (targetStatus === "OPEN") {
        await reopen.mutateAsync({
          id: activeId,
          data: { reason: "Reopened via board status transition" },
        });
      }
      refetch();
    } catch (err) {
      refetch();
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = t.ticket_number?.toLowerCase().includes(q);
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchEntity = t.entity_type?.toLowerCase().includes(q) || t.entity_id?.toLowerCase().includes(q);
      if (!matchNum && !matchTitle && !matchEntity) return false;
    }
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Ticket Kanban Board
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Drag cards across columns to update workflow statuses in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#252529] rounded-xl transition-colors border border-slate-200 dark:border-white/15"
            title="Refresh board"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Ticket
          </Button>
        </div>
      </div>

      {/* Ticket View Tabs Strip */}
      <div className="w-full flex items-center gap-1.5 p-1.5 bg-neutral-100 dark:bg-[#1C1C1F] rounded-2xl border border-neutral-200/80 dark:border-white/15 overflow-x-auto shadow-xs">
        <Link
          href="/tickets"
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-white/[0.06] transition-colors text-center"
        >
          <List className="w-4 h-4" />
          <span>All Tickets</span>
        </Link>
        <Link
          href="/tickets/board"
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl bg-white dark:bg-[#252529] text-blue-600 dark:text-blue-400 shadow-sm text-center"
        >
          <Kanban className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Kanban Board</span>
        </Link>
        <Link
          href="/tickets/my"
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-white/[0.06] transition-colors text-center"
        >
          <User className="w-4 h-4" />
          <span>Raised by Me</span>
        </Link>
        <Link
          href="/tickets/assigned"
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-white/[0.06] transition-colors text-center"
        >
          <UserCheck className="w-4 h-4" />
          <span>Assigned to Me</span>
        </Link>
      </div>

      {/* Board Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-3.5 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search board cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#252529] border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-[#252529] border border-slate-200 dark:border-white/15 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <span className="text-xs text-slate-400 font-mono">
            {filteredTickets.length} of {tickets.length} tickets
          </span>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start min-h-[680px]">
          {COLUMNS.map((col) => {
            const colTickets = filteredTickets.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                id={col.id}
                className="bg-slate-50/80 dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-3.5 flex flex-col min-h-[500px] shadow-xs"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">{col.title}</h3>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.badgeBg} ${col.badgeText}`}
                    >
                      {colTickets.length}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <SortableContext
                  id={col.id}
                  items={colTickets.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex-1 space-y-3">
                    {colTickets.map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onSelect={() => router.push(`/tickets/${ticket.id}`)}
                      />
                    ))}

                    {colTickets.length === 0 && (
                      <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/15 rounded-xl text-xs text-slate-400 dark:text-slate-500">
                        Drop tickets here
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTicket ? (
            <div className="rotate-2 scale-105 shadow-2xl">
              <TicketCard ticket={activeTicket} draggable={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CreateTicketModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
