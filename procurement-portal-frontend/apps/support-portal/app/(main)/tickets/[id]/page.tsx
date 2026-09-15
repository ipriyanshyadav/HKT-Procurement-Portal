"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useSupportTicket,
  useAddSupportTicketMessage,
  useUpdateSupportTicket,
  useSubmitSupportCSAT,
  useAppToast,
} from "@procurement/hooks";
import {
  ArrowLeft,
  Loader2,
  Send,
  LifeBuoy,
  User,
  Headphones,
  Bot,
  Star,
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  MessageSquare,
  FileText,
} from "lucide-react";

export default function SupportTicketDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useAppToast();

  const { data: ticket, isLoading, refetch } = useSupportTicket(id);
  const addMessageMutation = useAddSupportTicketMessage(id);
  const updateTicketMutation = useUpdateSupportTicket(id);
  const submitCsatMutation = useSubmitSupportCSAT(id);

  // Form states
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);

  // CSAT state
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [csatComment, setCsatComment] = useState("");
  const [csatSubmitted, setCsatSubmitted] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        <p className="text-xs text-neutral-400">Loading ticket thread & SLA context...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-base font-bold text-neutral-900 dark:text-white">Ticket Not Found</h2>
        <p className="text-xs text-neutral-500">
          The requested ticket does not exist or you do not have permission to view it.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-semibold rounded-xl text-neutral-700 dark:text-neutral-300"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Tickets</span>
        </Link>
      </div>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      await addMessageMutation.mutateAsync({
        message_text: replyText,
        is_internal_note: isInternalNote,
      });
      setReplyText("");
      setIsInternalNote(false);
      await refetch();
      toast.success("Message Sent", "Your response has been added to the ticket timeline.");
    } catch (err: any) {
      toast.error("Send Error", err?.message || "Failed to deliver message");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTicketMutation.mutateAsync({ status: newStatus });
      await refetch();
      toast.success("Status Updated", `Ticket status changed to ${newStatus}`);
    } catch (err: any) {
      toast.error("Update Error", err?.message || "Failed to update ticket status");
    }
  };

  const handleCsatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitCsatMutation.mutateAsync({
        rating: selectedRating,
        comment: csatComment || undefined,
      });
      setCsatSubmitted(true);
      await refetch();
      toast.success("Feedback Recorded", "Thank you for rating our support assistance!");
    } catch (err: any) {
      toast.error("Rating Error", err?.message || "Failed to submit CSAT feedback");
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "CRITICAL":
        return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
      case "HIGH":
        return "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "MEDIUM":
        return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      default:
        return "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700";
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "OPEN":
        return "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800";
      case "IN_PROGRESS":
        return "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "WAITING_ON_CUSTOMER":
        return "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "RESOLVED":
        return "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "CLOSED":
        return "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700";
      default:
        return "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400";
    }
  };

  const isResolvedOrClosed = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-sky-600 dark:text-sky-400">
                {ticket.ticket_number}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getPriorityBadge(
                  ticket.priority
                )}`}
              >
                {ticket.priority}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(
                  ticket.status
                )}`}
              >
                {ticket.status.replace(/_/g, " ")}
              </span>
              <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                {ticket.category}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white mt-1">
              {ticket.subject}
            </h1>
          </div>
        </div>

        {/* Status Dropdown Action */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-neutral-500 font-medium">Status:</span>
          <select
            value={ticket.status}
            disabled={updateTicketMutation.isPending}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-xs font-semibold rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-neutral-800 dark:text-neutral-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_ON_CUSTOMER">Waiting on Customer</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* CSAT Banner when Resolved or Closed */}
      {isResolvedOrClosed && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-neutral-900 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 shadow-sm">
          {ticket.csat_rating || csatSubmitted ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Star className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <span>Customer Satisfaction Rating:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-black">
                    {ticket.csat_rating || selectedRating} / 5 Stars
                  </span>
                </h4>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-0.5">
                  {ticket.csat_comment || csatComment
                    ? `Feedback: "${ticket.csat_comment || csatComment}"`
                    : "No comment provided."}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCsatSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    How satisfied are you with the resolution of this ticket?
                  </h4>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                    Your rating helps our support engineering team maintain fast SLAs.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled =
                      hoverRating !== null ? star <= hoverRating : star <= selectedRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => setSelectedRating(star)}
                        className="p-1 text-amber-500 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            isFilled ? "fill-amber-500 text-amber-500" : "text-neutral-300"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Optional comment on agent responsiveness or resolution..."
                  value={csatComment}
                  onChange={(e) => setCsatComment(e.target.value)}
                  className="flex-1 text-xs rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-neutral-900 px-3 py-1.5 text-neutral-900 dark:text-neutral-100"
                />
                <button
                  type="submit"
                  disabled={submitCsatMutation.isPending}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1"
                >
                  {submitCsatMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Submit CSAT</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Messages Timeline & Reply Box */}
        <div className="lg:col-span-2 space-y-4">
          {/* Initial Ticket Inquiry Description */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-300 font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white">
                    {ticket.customer_email}
                  </div>
                  <div className="text-[10px] text-neutral-400">Customer (Originator)</div>
                </div>
              </div>
              <span className="text-[11px] text-neutral-400">
                {new Date(ticket.created_at).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </p>
          </div>

          {/* Messages Timeline */}
          <div className="space-y-3">
            {(ticket.messages || []).map((msg) => {
              const isCustomer = msg.sender_type === "CUSTOMER";
              const isAgent = msg.sender_type === "AGENT";
              const isSystem = msg.sender_type === "SYSTEM";

              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    className="p-3 bg-neutral-100/80 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500 space-y-1"
                  >
                    <div className="flex items-center justify-center gap-1.5 font-semibold text-neutral-600 dark:text-neutral-400">
                      <Bot className="w-3.5 h-3.5" />
                      <span>Automated System Notice</span>
                    </div>
                    <p>{msg.message_text}</p>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-2xl border shadow-sm space-y-2 ${
                    isAgent
                      ? "bg-sky-50/60 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/60 ml-4 sm:ml-8"
                      : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 mr-4 sm:mr-8"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                          isAgent
                            ? "bg-sky-500 text-white"
                            : "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                        {isAgent ? <Headphones className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {isAgent ? "Support Agent" : ticket.customer_email}
                      </span>
                      {msg.is_internal_note && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                          INTERNAL NOTE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
                    {msg.message_text}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Reply Composer */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                <span>Add Response to Ticket</span>
              </span>

              <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="rounded border-neutral-300 dark:border-neutral-700 text-sky-600 focus:ring-sky-500"
                />
                <span>Internal Staff Note</span>
              </label>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-3">
              <textarea
                rows={4}
                required
                placeholder={
                  isInternalNote
                    ? "Add internal troubleshooting notes (only visible to support agents)..."
                    : "Type your reply to customer..."
                }
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className={`w-full text-xs rounded-xl border p-3 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 ${
                  isInternalNote
                    ? "border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 focus:ring-amber-500"
                    : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-sky-500"
                }`}
              />

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={addMessageMutation.isPending || !replyText.trim()}
                  className={`px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 text-white shadow-md transition-all ${
                    isInternalNote
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-sky-600 hover:bg-sky-700"
                  } disabled:opacity-50`}
                >
                  {addMessageMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isInternalNote ? "Post Internal Note" : "Send Response"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Ticket Context & Metadata Sidebar */}
        <div className="space-y-4">
          {/* Metadata Card */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Ticket Details
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-neutral-500">Originator</span>
                <span className="font-semibold text-neutral-900 dark:text-white truncate max-w-[140px]">
                  {ticket.customer_email}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-neutral-500">Created</span>
                <span className="text-neutral-800 dark:text-neutral-200">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-neutral-500">First Response</span>
                <span className="text-neutral-800 dark:text-neutral-200">
                  {ticket.first_response_at
                    ? new Date(ticket.first_response_at).toLocaleTimeString()
                    : "Pending"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-neutral-500">Resolved At</span>
                <span className="text-neutral-800 dark:text-neutral-200">
                  {ticket.resolved_at
                    ? new Date(ticket.resolved_at).toLocaleDateString()
                    : "Not resolved"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-neutral-500">Total Messages</span>
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {(ticket.messages || []).length}
                </span>
              </div>
            </div>
          </div>

          {/* SLA Tracking Card */}
          <div className="bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-5 shadow-sm space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>SLA Target Matrix</span>
            </div>
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Inquiries categorized under <strong>{ticket.category}</strong> are backed by our enterprise 24-hour resolution SLA with automated executive escalation.
            </p>
            <div className="pt-2 border-t border-sky-200 dark:border-sky-800/60 flex items-center justify-between text-xs font-medium text-sky-900 dark:text-sky-200">
              <span>Escalation Tier:</span>
              <span className="font-bold">Tier 2 Senior Specialist</span>
            </div>
          </div>

          {/* Knowledge Base Recommendations */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 dark:text-white">
              <FileText className="w-4 h-4 text-sky-600" />
              <span>Suggested KB Guides</span>
            </div>
            <div className="space-y-2 text-xs">
              <Link
                href="/kb"
                className="block p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <div className="font-semibold text-[11px] text-sky-600 dark:text-sky-400">
                  Resolving 3-Way Match Quantity Holds
                </div>
                <div className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                  How line tolerances trigger auto-hold and approval clearance.
                </div>
              </Link>

              <Link
                href="/kb"
                className="block p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <div className="font-semibold text-[11px] text-sky-600 dark:text-sky-400">
                  Consignee CRAC Goods Acceptance
                </div>
                <div className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                  Indentor verification protocol upon physical gate entry.
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
