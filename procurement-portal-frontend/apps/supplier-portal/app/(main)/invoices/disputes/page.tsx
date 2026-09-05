"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useDisputes,
  useAddDisputeMessage,
} from "@procurement/hooks";
import type { DisputeResponse, DisputeMessageResponse } from "@procurement/types";
import {
  AlertCircle,
  ArrowLeft,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  FileText,
  Search,
  ShieldAlert,
} from "lucide-react";

export default function SupplierDisputeInboxPage() {
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const { data: disputes = [], isLoading } = useDisputes({
    status: statusFilter === "ALL" ? undefined : statusFilter,
  });

  const addMessageMutation = useAddDisputeMessage();

  const filteredDisputes = disputes.filter((d) => {
    const matchesSearch =
      !searchQuery ||
      d.reason_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.invoice_id && d.invoice_id.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const activeDispute = disputes.find((d) => d.id === selectedDisputeId) || filteredDisputes[0] || null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDispute || !newMessage.trim()) return;

    await addMessageMutation.mutateAsync({
      disputeId: activeDispute.id,
      data: {
        message: newMessage.trim(),
      },
    });
    setNewMessage("");
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "OPEN":
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            OPEN UNDER INQUIRY
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            SETTLED / RESOLVED
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" />
            DISALLOWED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/invoices" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              Invoices
            </Link>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-medium">Dispute Desk</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            Invoice Discrepancy & Dispute Inbox
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review buyer hold reasons, submit clarifications, or provide updated credit notes and documentation.
          </p>
        </div>
      </div>

      {/* Main Split-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Dispute List */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[700px]">
          {/* Filters */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search dispute reason or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Inquiries</option>
                <option value="OPEN">Open / Action Needed</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          </div>

          {/* List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Loading inquiries...
              </div>
            ) : filteredDisputes.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                No active invoice disputes found.
              </div>
            ) : (
              filteredDisputes.map((dispute) => {
                const isSelected = activeDispute?.id === dispute.id;
                return (
                  <button
                    key={dispute.id}
                    onClick={() => setSelectedDisputeId(dispute.id)}
                    className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-l-4 border-emerald-500"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white uppercase tracking-wide">
                        {dispute.reason_code.replace(/_/g, " ")}
                      </span>
                      {getStatusBadge(dispute.status)}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {dispute.description}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                      <span>Inv #{dispute.invoice_id.slice(0, 8)}</span>
                      <span>{new Date(dispute.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Dispute Thread */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[700px]">
          {activeDispute ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/75">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase">
                      {activeDispute.reason_code.replace(/_/g, " ")}
                    </h2>
                    {getStatusBadge(activeDispute.status)}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>Dispute Reference: {activeDispute.id.slice(0, 8)}</span>
                  <span>•</span>
                  <Link
                    href={`/invoices`}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <FileText className="w-3 h-3" />
                    View Associated Invoice
                  </Link>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                  <strong className="text-slate-900 dark:text-white">Buyer Remarks:</strong> {activeDispute.description}
                </p>
              </div>

              {/* Resolution details banner if resolved */}
              {activeDispute.status === "RESOLVED" && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      <strong>Settled via:</strong> {activeDispute.resolution_action || "CLAIM_SETTLED"}
                    </span>
                  </div>
                  {activeDispute.credit_note_amount && (
                    <span className="font-mono font-semibold">
                      Adjusted: ₹ {Number(activeDispute.credit_note_amount).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 dark:bg-slate-950/20">
                {(!activeDispute.messages || activeDispute.messages.length === 0) ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    No communication messages exchanged yet. Reply below to clarify discrepancies or confirm credit notes.
                  </div>
                ) : (
                  activeDispute.messages.map((msg: DisputeMessageResponse) => (
                    <div
                      key={msg.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {msg.sender_name || "Buyer Team / Authorized Contact"}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {msg.message}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input Footer */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
                <input
                  type="text"
                  placeholder="Type response to procurement team..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || addMessageMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  Reply
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm">
              <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              Select an inquiry to view dispute details and communications.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
