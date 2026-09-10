"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  Star,
  Loader2,
  Paperclip,
  Download,
  Calendar,
} from "lucide-react";
import {
  useTicket,
  useCloseTicket,
  useReopenTicket,
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

export default function SupplierTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const currentUserId = useAuthStore((state) => state.user?.id);

  const { data: ticket, isLoading, refetch } = useTicket(ticketId);

  const [rating, setRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [showReopenModal, setShowReopenModal] = useState(false);

  const close = useCloseTicket();
  const reopen = useReopenTicket();

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
        Loading query details...
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-12 text-center text-slate-600">
        <p className="text-base font-semibold">Query not found</p>
        <Link href="/tickets" className="text-sm text-emerald-600 hover:underline mt-2 inline-block">
          Return to Queries
        </Link>
      </div>
    );
  }

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await close.mutateAsync({
      id: ticketId,
      data: {
        feedback_rating: rating,
        feedback_comment: feedbackComment.trim() || undefined,
      },
    });
    setShowCloseModal(false);
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Queries</span>
      </Link>

      {/* Main Card */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200/70 dark:border-emerald-800/70">
              {ticket.ticket_number}
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#252529] px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-white/10">
              {ticket.ticket_type}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/10">
              {ticket.status}
            </span>
            {ticket.due_date && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#252529] text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border border-slate-200/60 dark:border-white/10">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Target Due: {ticket.due_date}</span>
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

        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{ticket.title}</h1>
          {ticket.description && (
            <div className="text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {ticket.description}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Resolution Banner */}
        {ticket.status === "RESOLVED" && (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Procurement Team has marked this query as Resolved</span>
              </div>
            </div>

            {ticket.resolution_note && (
              <p className="text-xs text-emerald-900 dark:text-emerald-200 bg-white/70 dark:bg-[#252529]/80 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-800/40 whitespace-pre-wrap">
                {ticket.resolution_note}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setShowCloseModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                Accept &amp; Close Query
              </button>
              <button
                onClick={() => setShowReopenModal(true)}
                className="px-4 py-2 bg-white dark:bg-[#252529] hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-white/15 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Not Satisfied? Reopen</span>
              </button>
            </div>
          </div>
        )}

        {/* Closed Banner */}
        {ticket.status === "CLOSED" && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#252529] border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
            <span>This query is closed. Thank you for your feedback!</span>
            {Boolean((ticket as any).feedback_rating) && (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= ((ticket as any).feedback_rating || 0)
                        ? "text-amber-400 fill-amber-400"
                        : "text-slate-200 dark:text-slate-700"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attachments */}
        {Boolean(ticket.attachments?.length) && (
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-white/10">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Attachments ({ticket.attachments?.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ticket.attachments?.map((att) => (
                <div
                  key={att.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-[#252529] transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{att.file_name}</span>
                  </div>
                  <a
                    href={`/api/v1/documents/${att.document_id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Linked Queries / Issues */}
      <TicketLinkedIssues ticketId={ticketId} canLink={false} />

      {/* Custom Fields */}
      <TicketCustomFieldsPanel ticketId={ticketId} />

      {/* Discussion & Responses */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200/80 dark:border-white/15 p-6 sm:p-8 shadow-xs space-y-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Responses &amp; Clarifications
        </h3>

        {ticket.status !== "CLOSED" && (
          <TicketCommentBox
            ticketId={ticketId}
            allowInternalNotes={false}
            onCommentAdded={() => refetch()}
          />
        )}

        <TicketCommentFeed
          ticketId={ticketId}
          comments={ticket.comments}
          currentUserId={currentUserId}
          isBuyerOrAdmin={false}
        />
      </div>

      {/* Close Modal with CSAT rating */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleCloseSubmit}
            className="bg-white dark:bg-[#1C1C1F] rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200/80 dark:border-white/15 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Rate Your Support Experience</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please rate how satisfied you were with the resolution provided by the procurement team.
            </p>

            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 text-slate-300 dark:text-slate-600 hover:text-amber-400 transition-colors focus:outline-none"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= rating
                        ? "text-amber-400 fill-amber-400"
                        : "text-slate-300 dark:text-slate-600"
                    }`}
                  />
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Feedback Comment (Optional)
              </label>
              <textarea
                rows={3}
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Any additional feedback..."
                className="w-full text-sm p-3 bg-white dark:bg-[#252529] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={close.isPending}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors shadow-xs"
              >
                Submit &amp; Close Query
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
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Reopen Query</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Reopening <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="What part of the resolution was incomplete or needs further clarification?"
                className="w-full text-sm p-3 bg-white dark:bg-[#252529] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
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
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors shadow-xs"
              >
                Reopen Query
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
