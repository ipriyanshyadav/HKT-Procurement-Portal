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
import { TicketCard, CreateTicketModal } from "@procurement/ui";
import type { TicketListResponse, TicketStatus } from "@procurement/types";

interface Column {
  id: TicketStatus;
  title: string;
  badgeBg: string;
  badgeText: string;
}

const COLUMNS: Column[] = [
  { id: "OPEN", title: "Open", badgeBg: "bg-blue-100", badgeText: "text-blue-800" },
  { id: "IN_PROGRESS", title: "In Progress", badgeBg: "bg-indigo-100", badgeText: "text-indigo-800" },
  { id: "PENDING_RESPONSE", title: "Pending Response", badgeBg: "bg-amber-100", badgeText: "text-amber-800" },
  { id: "RESOLVED", title: "Resolved", badgeBg: "bg-emerald-100", badgeText: "text-emerald-800" },
  { id: "CLOSED", title: "Closed", badgeBg: "bg-slate-100", badgeText: "text-slate-700" },
];

export default function BuyerTicketsBoardPage() {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<TicketListResponse | null>(null);

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
      // Transition validation error or failure
      refetch();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Ticket Kanban Board
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Drag cards across columns to update workflow statuses in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="Refresh board"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/tickets"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <List className="w-4 h-4 text-slate-500" />
            <span>List View</span>
          </Link>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Ticket</span>
          </button>
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
            const colTickets = tickets.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                id={col.id}
                className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800">{col.title}</h3>
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
                      <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
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
