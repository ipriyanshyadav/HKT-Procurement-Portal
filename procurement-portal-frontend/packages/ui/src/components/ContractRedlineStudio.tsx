"use client";

import React, { useState } from "react";
import {
  FileText,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  BookOpen,
  Plus,
  PenTool,
  RotateCcw,
  Sparkles,
  Lock,
  ArrowRight,
  History,
  Layers,
  Check,
  UserCheck,
} from "lucide-react";
import {
  useContractClauses,
  useContractRedlines,
  useClauseLibrary,
  useSubmitRedline,
  useReviewRedline,
  useInitiateSigningCeremony,
  useSubmitDigitalSignature,
} from "@procurement/hooks";
import type {
  ContractClause,
  ContractClauseInstance,
  ContractRedline,
  ContractEsignSession,
} from "@procurement/types";

export interface ContractRedlineStudioProps {
  contractId: string;
  contractNumber?: string;
  contractTitle?: string;
  userRole?: "BUYER" | "SUPPLIER";
  currentUserEmail?: string;
}

export function ContractRedlineStudio({
  contractId,
  contractNumber = "CNT-2026-0001",
  contractTitle = "Master Services & Software License Agreement",
  userRole = "BUYER",
  currentUserEmail = userRole === "BUYER" ? "buyer@procurement.com" : "supplier@acme.com",
}: ContractRedlineStudioProps) {
  // Active selection states
  const [selectedClause, setSelectedClause] = useState<ContractClauseInstance | null>(null);
  const [libraryModalOpen, setLibraryModalOpen] = useState<boolean>(false);
  const [ceremonyModalOpen, setCeremonyModalOpen] = useState<boolean>(false);
  const [reviewModalRedline, setReviewModalRedline] = useState<ContractRedline | null>(null);
  const [reviewAction, setReviewAction] = useState<"ACCEPT" | "REJECT">("ACCEPT");
  const [reviewComment, setReviewComment] = useState<string>("");

  // Redline proposal form state
  const [isProposing, setIsProposing] = useState<boolean>(false);
  const [proposedText, setProposedText] = useState<string>("");
  const [changeRationale, setChangeRationale] = useState<string>("");

  // Queries
  const {
    data: clauses = [],
    isLoading: loadingClauses,
    refetch: refetchClauses,
  } = useContractClauses(contractId);
  const {
    data: redlines = [],
    isLoading: loadingRedlines,
    refetch: refetchRedlines,
  } = useContractRedlines(contractId);
  const { data: libraryClauses = [] } = useClauseLibrary();

  // Mutations
  const submitRedlineMutation = useSubmitRedline();
  const reviewRedlineMutation = useReviewRedline();
  const initiateCeremonyMutation = useInitiateSigningCeremony();
  const signMutation = useSubmitDigitalSignature();

  // Active signing session
  const [activeSession, setActiveSession] = useState<ContractEsignSession | null>(null);

  // Set default selected clause once loaded
  React.useEffect(() => {
    if (clauses.length > 0 && !selectedClause) {
      setSelectedClause(clauses[0]);
    }
  }, [clauses, selectedClause]);

  const activeClauseRedlines = redlines.filter(
    (r) => r.clause_instance_id === selectedClause?.id
  );

  const handleStartPropose = () => {
    if (!selectedClause) return;
    setProposedText(selectedClause.current_text);
    setChangeRationale("");
    setIsProposing(true);
  };

  const handleSubmitProposal = async () => {
    if (!selectedClause || !proposedText.trim()) return;
    try {
      await submitRedlineMutation.mutateAsync({
        contractId,
        data: {
          clause_instance_id: selectedClause.id,
          original_text: selectedClause.current_text,
          proposed_text: proposedText,
          change_rationale: changeRationale || "Standard legal terms counter-proposal.",
          author_type: userRole === "BUYER" ? "BUYER" : "SUPPLIER",
        },
      });
      setIsProposing(false);
      refetchRedlines();
      refetchClauses();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewAction = async () => {
    if (!reviewModalRedline) return;
    try {
      await reviewRedlineMutation.mutateAsync({
        redlineId: reviewModalRedline.id,
        contractId,
        data: {
          action: reviewAction,
          review_comment: reviewComment,
        },
      });
      setReviewModalRedline(null);
      setReviewComment("");
      refetchRedlines();
      refetchClauses();
    } catch (err) {
      console.error(err);
    }
  };

  const handleInitiateCeremony = async () => {
    try {
      const session = await initiateCeremonyMutation.mutateAsync({
        contractId,
        signers: [
          { name: "Procurement Legal Head", email: "buyer@procurement.com", role: "BUYER" },
          { name: "Vendor Authorized Signatory", email: "supplier@acme.com", role: "SUPPLIER" },
        ],
      });
      setActiveSession(session);
      setCeremonyModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignDocument = async () => {
    try {
      const updated = await signMutation.mutateAsync({
        contractId,
        signerEmail: currentUserEmail,
        signatureToken: `SIG_TOKEN_${Date.now()}`,
      });
      setActiveSession(updated);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 text-xs font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 rounded-md">
              {contractNumber}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              LEGAL REDLINING & REVIEW
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 font-semibold">
              Mode: {userRole}
            </span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-2">
            {contractTitle}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Collaborative Track-Changes Clause Editor, Legal Deviations Matrix, and Multi-Party Signing Ceremony
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLibraryModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
          >
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Clause Library ({libraryClauses.length})
          </button>

          <button
            onClick={handleInitiateCeremony}
            disabled={initiateCeremonyMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all"
          >
            <PenTool className="w-4 h-4" />
            Digital Sign Ceremony
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left Clause List / Right Redline Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Clause Navigator Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xs font-black uppercase tracking-wider text-gray-500">
                Contract Clauses ({clauses.length})
              </h2>
              <span className="text-[11px] text-gray-400 font-medium">Select clause to redline</span>
            </div>

            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
              {loadingClauses ? (
                <div className="p-8 text-center text-xs text-gray-400">Loading clauses...</div>
              ) : (
                clauses.map((c, index) => {
                  const isSelected = selectedClause?.id === c.id;
                  const hasRedlines = redlines.some((r) => r.clause_instance_id === c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedClause(c);
                        setIsProposing(false);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 dark:border-indigo-500 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400">§{index + 1}</span>
                          {c.title}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.2 rounded font-bold ${
                            c.status === "MODIFIED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>

                      <p className="mt-1.5 text-[11px] text-gray-500 line-clamp-2">
                        {c.current_text}
                      </p>

                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-[10px]">
                        <span
                          className={`px-1.5 py-0.2 rounded font-semibold ${
                            c.deviation_risk === "HIGH"
                              ? "bg-rose-100 text-rose-700"
                              : c.deviation_risk === "MEDIUM"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          Risk: {c.deviation_risk}
                        </span>

                        {hasRedlines && (
                          <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                            <GitPullRequest className="w-3 h-3" />
                            Redlines active
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Redlining Workbench (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {!selectedClause ? (
            <div className="h-full min-h-[450px] flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                No Clause Selected
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mt-1">
                Choose a clause from the outline to inspect current terms, propose text redlines, and resolve counter-proposals.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              {/* Clause Header & Action Bar */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {selectedClause.title}
                    </h2>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        selectedClause.status === "MODIFIED"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {selectedClause.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Original Baseline vs Active Redline Proposals
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!isProposing && (
                    <button
                      onClick={handleStartPropose}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      Propose Redline (Track Changes)
                    </button>
                  )}
                </div>
              </div>

              {/* In-Line Redline Proposal Editor Form */}
              {isProposing && (
                <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                      <GitPullRequest className="w-4 h-4 text-indigo-600" />
                      Propose Clause Amendment
                    </h3>
                    <button
                      onClick={() => setIsProposing(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
                    >
                      ✕ Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Proposed Legal Text:
                    </label>
                    <textarea
                      rows={5}
                      value={proposedText}
                      onChange={(e) => setProposedText(e.target.value)}
                      className="w-full text-xs p-3 font-serif bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Legal Justification & Counter-Proposal Rationale:
                    </label>
                    <input
                      type="text"
                      value={changeRationale}
                      onChange={(e) => setChangeRationale(e.target.value)}
                      placeholder="e.g. Standard industry liability cap, compliance with internal policy #82..."
                      className="w-full text-xs p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsProposing(false)}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitProposal}
                      disabled={submitRedlineMutation.isPending}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm"
                    >
                      {submitRedlineMutation.isPending ? "Submitting..." : "Submit Redline for Review"}
                    </button>
                  </div>
                </div>
              )}

              {/* Current Clause Text Display */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                  <span>Current Active Text</span>
                  <span className="font-normal text-[11px] text-gray-500">
                    Version: {selectedClause.status === "MODIFIED" ? "Amended" : "Standard"}
                  </span>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700/80 font-serif text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  {selectedClause.current_text}
                </div>
              </div>

              {/* Collaborative Track Changes Proposals Feed */}
              <div className="p-5 border-t border-gray-200 dark:border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                    <History className="w-4 h-4 text-gray-400" />
                    Proposed Redlines & Track Changes ({activeClauseRedlines.length})
                  </h3>
                </div>

                {activeClauseRedlines.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    No active redlines on this clause. Click "Propose Redline" to draft a modification.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeClauseRedlines.map((r) => {
                      const isPending = r.status === "PENDING";
                      const isAccepted = r.status === "ACCEPTED";
                      const isRejected = r.status === "REJECTED";

                      return (
                        <div
                          key={r.id}
                          className={`p-4 rounded-xl border ${
                            isPending
                              ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/10"
                              : isAccepted
                              ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/10"
                              : "border-gray-200 bg-gray-50/50 dark:border-gray-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                  r.author_type === "BUYER"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {r.author_type} COUNSEL
                              </span>
                              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                Proposed Diff
                              </span>
                            </div>

                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isPending
                                  ? "bg-amber-100 text-amber-800"
                                  : isAccepted
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {r.status}
                            </span>
                          </div>

                          {/* Redline Text Body */}
                          <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700/60 font-serif text-xs leading-relaxed text-gray-800 dark:text-gray-200">
                            {r.proposed_text}
                          </div>

                          {/* Rationale & Diff Metrics */}
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-gray-500 italic">
                              "{r.change_rationale}"
                            </span>

                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              {r.diff_summary?.additions_count !== undefined && (
                                <span className="text-emerald-600 font-bold">
                                  +{r.diff_summary.additions_count} words
                                </span>
                              )}
                              {r.diff_summary?.deletions_count !== undefined && (
                                <span className="text-rose-600 font-bold">
                                  -{r.diff_summary.deletions_count} words
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Review Actions if Pending */}
                          {isPending && (
                            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setReviewModalRedline(r);
                                  setReviewAction("REJECT");
                                }}
                                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded text-xs font-bold"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => {
                                  setReviewModalRedline(r);
                                  setReviewAction("ACCEPT");
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-sm"
                              >
                                Accept & Merge
                              </button>
                            </div>
                          )}

                          {r.review_comment && (
                            <div className="mt-2 text-[11px] text-gray-500 bg-gray-100 dark:bg-gray-800/80 p-2 rounded">
                              <strong>Review Note:</strong> {r.review_comment}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewModalRedline && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              {reviewAction === "ACCEPT" ? "Accept & Merge Redline" : "Reject Redline Proposal"}
            </h3>
            <p className="text-xs text-gray-500">
              {reviewAction === "ACCEPT"
                ? "This will update the active contract clause text to the proposed wording and mark the redline as ACCEPTED."
                : "This proposal will be marked as REJECTED with your feedback."}
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Feedback / Audit Comment:
              </label>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Optional review note for legal record..."
                className="w-full text-xs p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReviewModalRedline(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewAction}
                disabled={reviewRedlineMutation.isPending}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg shadow-sm ${
                  reviewAction === "ACCEPT" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {reviewRedlineMutation.isPending ? "Processing..." : `Confirm ${reviewAction}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Clause Library Drawer / Modal */}
      {libraryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Standard Legal Clause Library
                </h3>
              </div>
              <button
                onClick={() => setLibraryModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {libraryClauses.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                        {c.title}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono">
                        {c.clause_code}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800">
                      Risk: {c.risk_level}
                    </span>
                  </div>

                  <p className="text-xs font-serif text-gray-700 dark:text-gray-300 leading-relaxed">
                    {c.standard_text}
                  </p>

                  {c.guidance_notes && (
                    <p className="text-[11px] text-gray-500 italic">
                      Guidance: {c.guidance_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setLibraryModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg"
              >
                Close Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Signing Ceremony Modal */}
      {ceremonyModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Electronic Digital Signing Ceremony
                </h3>
              </div>
              <button
                onClick={() => setCeremonyModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Cryptographic SHA-256 Hash Display */}
            <div className="p-3 bg-slate-900 text-slate-100 rounded-xl space-y-1 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>CRYPTOGRAPHIC AUDIT INTEGRITY HASH (SHA-256)</span>
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="break-all font-bold text-emerald-400">
                {activeSession?.audit_trail_hash || "Generating cryptographic manifest..."}
              </p>
            </div>

            {/* Signers Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Ceremony Signatories
              </h4>

              {activeSession?.signers?.map((signer) => (
                <div
                  key={signer.email}
                  className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-gray-900 dark:text-gray-100">
                        {signer.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 font-semibold">
                        {signer.role}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{signer.email}</span>
                  </div>

                  {signer.signed ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      Signed
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 font-semibold">
                      Pending Signature
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Sign Action Button */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleSignDocument}
                disabled={signMutation.isPending}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <Check className="w-4 h-4" />
                {signMutation.isPending
                  ? "Committing Cryptographic Signature..."
                  : `Sign Document as ${userRole} (${currentUserEmail})`}
              </button>

              {activeSession?.ceremony_status === "COMPLETED" && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl text-center border border-emerald-200">
                  ✓ All signatories have committed signatures. Contract is now officially ACTIVE!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
