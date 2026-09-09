"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  TrendingUp,
  Paperclip,
  Download,
  Trash2,
  Eye,
  EyeOff,
  UserPlus,
  Loader2,
  Users,
  Calendar,
  Edit2,
  Check,
  X,
} from "lucide-react";
import {
  useTicket,
  useUpdateTicket,
  useStartTicketProgress,
  useSetTicketPendingResponse,
  useResolveTicket,
  useCloseTicket,
  useReopenTicket,
  useEscalateTicket,
  useAssignTicket,
  useAddTicketWatcher,
  useRemoveTicketWatcher,
  useDeleteTicketAttachment,
} from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import {
  TicketSLAIndicator,
  TicketCommentBox,
  TicketCommentFeed,
  TicketLinkedIssues,
  TicketCustomFieldsPanel,
} from "@procurement/ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function AdminTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const currentUserId = useAuthStore((state) => state.user?.id);

  const { data: ticket, isLoading, refetch } = useTicket(ticketId);

  const [resolutionNotes, setResolutionNotes] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [newDueDate, setNewDueDate] = useState("");

  const updateTicket = useUpdateTicket();
  const startProgress = useStartTicketProgress();
  const setPending = useSetTicketPendingResponse();
  const resolve = useResolveTicket();
  const close = useCloseTicket();
  const reopen = useReopenTicket();
  const escalate = useEscalateTicket();
  const assign = useAssignTicket();
  const addWatcher = useAddTicketWatcher();
  const removeWatcher = useRemoveTicketWatcher();
  const deleteAttachment = useDeleteTicketAttachment();

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        Loading ticket details...
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-12 text-center text-slate-600">
        <p className="text-base font-semibold">Ticket not found</p>
        <Link href="/tickets" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          Return to Tickets
        </Link>
      </div>
    );
  }

  const isWatcher = ticket.watchers?.some((w) => w.user_id === currentUserId);

  const handleToggleWatch = async () => {
    if (!currentUserId) return;
    if (isWatcher) {
      await removeWatcher.mutateAsync({ ticketId, userId: currentUserId });
    } else {
      await addWatcher.mutateAsync({ ticketId, userId: currentUserId });
    }
    refetch();
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNotes.trim()) return;
    await resolve.mutateAsync({
      id: ticketId,
      data: { resolution_note: resolutionNotes.trim() },
    });
    setShowResolveModal(false);
    setResolutionNotes("");
    refetch();
  };

  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateReason.trim()) return;
    await escalate.mutateAsync({
      id: ticketId,
      data: { reason: escalateReason.trim() },
    });
    setShowEscalateModal(false);
    setEscalateReason("");
    refetch();
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;
    await reopen.mutateAsync({
      id: ticketId,
      data: { reason: reopenReason.trim() },
    });
    setShowReopenModal(false);
    setReopenReason("");
    refetch();
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigneeInput.trim()) return;
    await assign.mutateAsync({
      id: ticketId,
      data: { user_id: assigneeInput.trim() },
    });
    setShowAssignModal(false);
    setAssigneeInput("");
    refetch();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top breadcrumb & navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Tickets</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1C1C1F] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#252529] transition-colors shadow-2xs"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Assign Ticket</span>
          </button>
          <button
            onClick={handleToggleWatch}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors shadow-2xs ${
              isWatcher
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800/80"
                : "bg-white dark:bg-[#1C1C1F] text-slate-700 dark:text-slate-200 border-slate-300 dark:border-white/15 hover:bg-slate-50 dark:hover:bg-[#252529]"
            }`}
          >
            {isWatcher ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{isWatcher ? "Unwatch Ticket" : "Watch Ticket"}</span>
          </button>
        </div>
      </div>

      {/* Main 65 / 35 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left pane: 65% (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header Card */}
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-800/60">
                {ticket.ticket_number}
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#252529] px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-white/10">
                {ticket.ticket_type}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/10">
                Status: {ticket.status}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  ticket.priority === "URGENT"
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/70"
                    : ticket.priority === "HIGH"
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70"
                    : ticket.priority === "MEDIUM"
                    ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/70"
                    : "bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-white/15"
                }`}
              >
                Priority: {ticket.priority}
              </span>
            </div>

            <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {ticket.title}
            </h1>

            {ticket.description && (
              <div className="text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none pt-3 border-t border-slate-100 dark:border-white/10">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {ticket.description}
                </ReactMarkdown>
              </div>
            )}

            {ticket.resolution_note && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-sm">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Resolution Details</span>
                </div>
                <p className="text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap">{ticket.resolution_note}</p>
              </div>
            )}
          </div>

          {/* Jira-Style Linked Issues */}
          <TicketLinkedIssues ticketId={ticketId} />

          {/* Custom Fields (EAV) */}
          <TicketCustomFieldsPanel ticketId={ticketId} />

          {/* Attachments Section */}
          {Boolean(ticket.attachments?.length) && (
            <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Attachments ({ticket.attachments?.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ticket.attachments?.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-[#252529] transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{att.file_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={`/api/v1/documents/${att.document_id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() =>
                          deleteAttachment.mutateAsync({ ticketId, attachmentId: att.id })
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments and Conversation */}
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-6 shadow-xs space-y-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Activity &amp; Conversation
            </h3>

            {/* Comment Box */}
            <TicketCommentBox
              ticketId={ticketId}
              allowInternalNotes={true}
              onCommentAdded={() => refetch()}
            />

            {/* Comment Feed */}
            <TicketCommentFeed
              ticketId={ticketId}
              comments={ticket.comments}
              currentUserId={currentUserId}
              isBuyerOrAdmin={true}
            />
          </div>
        </div>

        {/* Right pane: 35% (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions Card */}
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Workflow Actions
            </h3>

            <div className="flex flex-col gap-2">
              {ticket.status === "OPEN" && (
                <button
                  onClick={() => startProgress.mutateAsync(ticketId).then(() => refetch())}
                  disabled={startProgress.isPending}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Start Progress</span>
                </button>
              )}

              {(ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") && (
                <button
                  onClick={() =>
                    setPending
                      .mutateAsync({
                        id: ticketId,
                        data: { reason: "Waiting for user feedback" },
                      })
                      .then(() => refetch())
                  }
                  className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Mark Pending Response</span>
                </button>
              )}

              {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                <button
                  onClick={() => setShowResolveModal(true)}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Resolve Ticket</span>
                </button>
              )}

              {ticket.status === "RESOLVED" && (
                <button
                  onClick={() => close.mutateAsync({ id: ticketId }).then(() => refetch())}
                  className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 dark:bg-white/15 dark:hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>Close Ticket</span>
                </button>
              )}

              {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && (
                <button
                  onClick={() => setShowReopenModal(true)}
                  className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#252529] dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen Ticket</span>
                </button>
              )}

              {ticket.status !== "CLOSED" && (
                <button
                  onClick={() => setShowEscalateModal(true)}
                  className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Escalate to Manager</span>
                </button>
              )}
            </div>
          </div>

          {/* Ticket Metadata Card */}
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-5 shadow-xs space-y-4 text-xs">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ticket Properties
            </h3>

            <div className="space-y-3 divide-y divide-slate-100 dark:divide-white/10">
              <div className="pt-2">
                <span className="text-slate-400 dark:text-slate-500 block mb-1 font-medium">Assignee</span>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {ticket.assigned_to ? ticket.assigned_to.slice(0, 8) : "Unassigned"}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 dark:text-slate-500 block font-medium">Due Date</span>
                  {!isEditingDueDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewDueDate(ticket.due_date || "");
                        setIsEditingDueDate(true);
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                      <span>{ticket.due_date ? "Edit" : "+ Set"}</span>
                    </button>
                  )}
                </div>

                {isEditingDueDate ? (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="text-xs p-1.5 border border-slate-300 dark:border-white/15 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white dark:bg-[#252529] text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={updateTicket.isPending}
                      onClick={async () => {
                        await updateTicket.mutateAsync({
                          id: ticketId,
                          data: { due_date: newDueDate || undefined },
                        });
                        setIsEditingDueDate(false);
                        refetch();
                      }}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingDueDate(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : ticket.due_date ? (
                  <div className="flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span
                      className={
                        new Date(ticket.due_date).setHours(23, 59, 59, 999) < Date.now() &&
                        ticket.status !== "RESOLVED" &&
                        ticket.status !== "CLOSED"
                          ? "text-rose-600 dark:text-rose-400 font-bold"
                          : "text-slate-800 dark:text-slate-200"
                      }
                    >
                      {ticket.due_date}
                    </span>
                    {new Date(ticket.due_date).setHours(23, 59, 59, 999) < Date.now() &&
                      ticket.status !== "RESOLVED" &&
                      ticket.status !== "CLOSED" && (
                        <span className="text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold px-1.5 py-0.5 rounded">
                          OVERDUE
                        </span>
                      )}
                  </div>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic">Not set</span>
                )}
              </div>

              <div className="pt-2">
                <span className="text-slate-400 dark:text-slate-500 block mb-1 font-medium">Target SLA</span>
                <TicketSLAIndicator
                  slaStatus={ticket.sla_status}
                  slaBreachAt={ticket.sla_breach_at}
                  firstResponseAt={ticket.first_response_at}
                  resolvedAt={ticket.resolved_at}
                  status={ticket.status}
                />
              </div>

              {ticket.entity_type && (
                <div className="pt-2">
                  <span className="text-slate-400 dark:text-slate-500 block mb-1 font-medium">Related Object</span>
                  <span className="font-mono bg-slate-50 dark:bg-[#252529] px-2.5 py-1 border border-slate-200 dark:border-white/10 rounded-lg block text-slate-800 dark:text-slate-200">
                    {ticket.entity_type.toUpperCase()}: {ticket.entity_id}
                  </span>
                </div>
              )}

              {Boolean(ticket.watchers?.length) && (
                <div className="pt-2">
                  <span className="text-slate-400 dark:text-slate-500 block mb-1 font-medium">
                    Watchers ({ticket.watchers?.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {ticket.watchers?.map((w) => (
                      <span
                        key={w.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#252529] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 text-[11px]"
                      >
                        <Users className="w-3 h-3 text-slate-400" />
                        {w.user_id ? w.user_id.slice(0, 8) : "Unknown"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <span className="text-slate-400 dark:text-slate-500 block mb-1 font-medium">Created At</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(ticket.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Log Timeline */}
          {Boolean(ticket.activity_logs?.length) && (
            <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Audit Timeline
              </h3>
              <div className="space-y-3 border-l-2 border-slate-100 dark:border-white/10 pl-3 ml-2 text-xs">
                {ticket.activity_logs?.map((log) => (
                  <div key={log.id} className="relative">
                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-white/30 absolute -left-[17px] top-1" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {log.activity_type}
                    </span>
                    {log.old_value && log.new_value && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        {log.old_value} → {log.new_value}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleAssignSubmit}
            className="bg-white dark:bg-[#1C1C1F] rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 dark:border-white/15 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Assign Ticket</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assignee User UUID <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="text"
                value={assigneeInput}
                onChange={(e) => setAssigneeInput(e.target.value)}
                placeholder="e.g. 00000000-0000-0000-0000-000000000001"
                className="w-full text-sm p-3 bg-white dark:bg-[#252529] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!assigneeInput.trim() || assign.isPending}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-xs"
              >
                Confirm Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleResolveSubmit}
            className="bg-white dark:bg-[#1C1C1F] rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 dark:border-white/15 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Resolve Ticket</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Resolution Notes <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Explain the solution or resolution details..."
                className="w-full text-sm p-3 bg-white dark:bg-[#252529] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!resolutionNotes.trim() || resolve.isPending}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-xs"
              >
                Confirm Resolution
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Escalate Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleEscalateSubmit}
            className="bg-white dark:bg-[#1C1C1F] rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 dark:border-white/15 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Escalate Ticket</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Escalation Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Why is this ticket being escalated?"
                className="w-full text-sm p-3 bg-white dark:bg-[#252529] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEscalateModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!escalateReason.trim() || escalate.isPending}
                className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-xs"
              >
                Confirm Escalation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleReopenSubmit}
            className="bg-white dark:bg-[#1C1C1F] rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 dark:border-white/15 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Reopen Ticket</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reopen Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="State the reason for reopening this ticket..."
                className="w-full text-sm p-3 bg-white dark:bg-[#252529] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!reopenReason.trim() || reopen.isPending}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-xs"
              >
                Confirm Reopen
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
