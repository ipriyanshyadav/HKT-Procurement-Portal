"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare, Paperclip, User, GripVertical } from "lucide-react";
import type { TicketListResponse, TicketPriority } from "@procurement/types";
import { TicketSLAIndicator } from "./TicketSLAIndicator";

interface TicketCardProps {
  ticket: TicketListResponse;
  onSelect?: (ticket: TicketListResponse) => void;
  draggable?: boolean;
}

const PRIORITY_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  CRITICAL: { label: "Critical", bg: "bg-rose-100", text: "text-rose-800" },
  HIGH: { label: "High", bg: "bg-amber-100", text: "text-amber-800" },
  MEDIUM: { label: "Medium", bg: "bg-blue-100", text: "text-blue-800" },
  LOW: { label: "Low", bg: "bg-slate-100", text: "text-slate-700" },
};

export function TicketCard({ ticket, onSelect, draggable = true }: TicketCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    disabled: !draggable,
    data: { ticket },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priorityInfo = PRIORITY_BADGES[ticket.priority] || PRIORITY_BADGES.LOW;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer ${
        isDragging ? "ring-2 ring-blue-500 shadow-lg" : ""
      }`}
      onClick={() => onSelect?.(ticket)}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {draggable && (
            <button
              {...attributes}
              {...listeners}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing p-0.5 rounded"
              onClick={(e) => e.stopPropagation()}
              title="Drag to change status"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <span className="font-mono text-xs font-semibold text-slate-700 hover:text-blue-600">
            {ticket.ticket_number}
          </span>
        </div>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${priorityInfo.bg} ${priorityInfo.text}`}
        >
          {priorityInfo.label}
        </span>
      </div>

      <h4 className="text-sm font-medium text-slate-900 line-clamp-2 mb-2 leading-snug">
        {ticket.title}
      </h4>

      {ticket.entity_type && (
        <div className="mb-2">
          <span className="inline-block text-[10px] font-medium uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
            {ticket.entity_type} {ticket.entity_id ? `• ${ticket.entity_id.slice(0, 8)}` : ""}
          </span>
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          {Boolean((ticket as any).comment_count) && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>{(ticket as any).comment_count}</span>
            </span>
          )}
          {Boolean((ticket as any).attachment_count) && (
            <span className="flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
              <span>{(ticket as any).attachment_count}</span>
            </span>
          )}
        </div>

        <TicketSLAIndicator
          slaStatus={ticket.sla_status}
          slaBreachAt={ticket.sla_breach_at}
          firstResponseAt={ticket.first_response_at}
          resolvedAt={ticket.resolved_at}
          status={ticket.status}
          compact
        />
      </div>
    </div>
  );
}
