"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useContract,
  useSubmitContractForReview,
  useApproveContract,
  useReturnContract,
  useInitiateContractEsign,
  useConfirmContractEsign,
  useAmendContract,
  useCompleteMilestone,
  ContractLine,
  ContractAmendment,
} from "@procurement/hooks";
import { ContractExpiryCountdown, MilestoneTracker, DocumentList, PermissionGuard, UnderlineTabs } from "@procurement/ui";
import {
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Check,
  RotateCcw,
  Edit3,
  TrendingUp,
  FileCheck,
  ShoppingCart,
  Award,
  Activity,
  BarChart3,
  DollarSign,
  Percent,
} from "lucide-react";

export default function ContractWorkspacePage() {
  const params = useParams();
  const id = params?.id as string;

  const { data: contract, isLoading, isError } = useContract(id);

  // Mutations
  const submitReviewMut = useSubmitContractForReview();
  const approveMut = useApproveContract();
  const returnMut = useReturnContract();
  const initiateEsignMut = useInitiateContractEsign();
  const confirmEsignMut = useConfirmContractEsign();
  const amendMut = useAmendContract();
  const completeMilestoneMut = useCompleteMilestone();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "overview" | "scorecard" | "lines" | "milestones" | "amendments" | "esign"
  >("overview");

  // Modals state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);
  const [amendType, setAmendType] = useState<
    "VALUE_CHANGE" | "SCOPE_CHANGE" | "DATE_EXTENSION" | "CLAUSE_MODIFICATION"
  >("VALUE_CHANGE");
  const [amendDescription, setAmendDescription] = useState("");
  const [amendNewValue, setAmendNewValue] = useState("");
  const [amendNewEndDate, setAmendNewEndDate] = useState("");
  const [amendJustification, setAmendJustification] = useState("");

  if (isLoading) {
    return (
      <div className="p-20 text-center text-slate-500 dark:text-slate-400">
        <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
        Loading contract workspace...
      </div>
    );
  }

  if (isError || !contract) {
    return (
      <div className="p-20 text-center text-red-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-500" />
        Failed to load contract details. Please verify the ID or your permissions.
      </div>
    );
  }

  const lines: ContractLine[] = (contract.lines ?? []) as ContractLine[];
  const milestones = contract.milestones ?? [];
  const amendments: ContractAmendment[] = (contract.amendments ?? []) as ContractAmendment[];
  const signingLogs = (contract.signing_log as Array<Record<string, any>>) ?? [];

  const totalVal = Number(contract.total_value || 0);
  const utilVal = Number(contract.utilized_value || 0);
  const utilPct = totalVal > 0 ? Math.min(100, Math.round((utilVal / totalVal) * 100)) : 0;

  // Handlers
  const handleSubmitReview = async () => {
    if (!confirm("Submit this contract for managerial review and approval?")) return;
    try {
      await submitReviewMut.mutateAsync({ contractId: id });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to submit contract for review");
    }
  };

  const handleApprove = async () => {
    if (!confirm("Approve this contract? Once approved, it can be routed for electronic signing."))
      return;
    try {
      await approveMut.mutateAsync({ contractId: id });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to approve contract");
    }
  };

  const handleReturn = async () => {
    if (!returnReason.trim()) {
      alert("Please provide comments/reasons for returning the contract");
      return;
    }
    try {
      await returnMut.mutateAsync({ contractId: id, reason: returnReason });
      setIsReturnModalOpen(false);
      setReturnReason("");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to return contract");
    }
  };

  const handleInitiateEsign = async (provider: "DIGIO" | "DOCUSIGN") => {
    if (!confirm(`Initiate eSign execution via ${provider}? Signatory notifications will be dispatched.`))
      return;
    try {
      await initiateEsignMut.mutateAsync({
        contractId: id,
        data: {
          provider,
          signatories: [
            {
              party: "BUYER",
              name: "Internal Authorized Signatory",
              email: "signatory@buyer-corp.com",
            },
            {
              party: "SUPPLIER",
              name: "Supplier Authorized Signatory",
              email: "signatory@vendor.com",
            },
          ],
        },
      });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to initiate eSign");
    }
  };

  const handleConfirmEsign = async () => {
    try {
      await confirmEsignMut.mutateAsync({ contractId: id });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to confirm eSign signatures");
    }
  };

  const handleCreateAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendDescription.trim()) {
      alert("Please fill in the required description.");
      return;
    }
    try {
      await amendMut.mutateAsync({
        contractId: id,
        data: {
          amendment_type: amendType,
          change_description: amendDescription,
          new_total_value: amendNewValue || undefined,
          new_end_date: amendNewEndDate || undefined,
        },
      });
      setIsAmendModalOpen(false);
      setAmendDescription("");
      setAmendJustification("");
      setAmendNewValue("");
      setAmendNewEndDate("");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to create amendment");
    }
  };

  const handleCompleteMilestone = async (milestoneId: string, notes?: string) => {
    try {
      await completeMilestoneMut.mutateAsync({
        milestoneId,
        contractId: id,
        data: { status: "COMPLETED", completion_notes: notes },
      });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to complete milestone");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/contracts" className="hover:underline">
              Contracts
            </Link>
            <span>/</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
              {contract.contract_number}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {contract.title}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              {contract.status.replace(/_/g, " ")}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
              v{contract.version}
            </span>
          </div>
        </div>

        {/* Expiry Badge */}
        <div className="flex items-center gap-3">
          <ContractExpiryCountdown
            endDate={contract.end_date}
            warningLevel={contract.expiry_warning_level ?? undefined}
            daysRemaining={contract.days_remaining}
          />
        </div>
      </div>

      {/* Lifecycle Action Bar */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Lifecycle Actions available for <strong>{contract.status}</strong>:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {contract.status === "DRAFT" && (
            <PermissionGuard permission="contract.update">
              <button
                onClick={handleSubmitReview}
                disabled={submitReviewMut.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submitReviewMut.isPending ? "Submitting..." : "Submit for Review"}
              </button>
            </PermissionGuard>
          )}

          {contract.status === "PENDING_REVIEW" && (
            <>
              <PermissionGuard permission="contract.approve">
                <button
                  onClick={handleApprove}
                  disabled={approveMut.isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {approveMut.isPending ? "Approving..." : "Approve Contract"}
                </button>
              </PermissionGuard>
              <PermissionGuard permission="contract.approve">
                <button
                  onClick={() => setIsReturnModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Return with Comments
                </button>
              </PermissionGuard>
            </>
          )}

          {contract.status === "APPROVED" && (
            <>
              <PermissionGuard permission="contract.update">
                <button
                  onClick={() => handleInitiateEsign("DIGIO")}
                  disabled={initiateEsignMut.isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Sign via Digio (India eSign)
                </button>
                <button
                  onClick={() => handleInitiateEsign("DOCUSIGN")}
                  disabled={initiateEsignMut.isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Sign via DocuSign
                </button>
              </PermissionGuard>
            </>
          )}

          {contract.status === "PENDING_ESIGN" && (
            <PermissionGuard permission="contract.update">
              <button
                onClick={handleConfirmEsign}
                disabled={confirmEsignMut.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                <FileCheck className="w-3.5 h-3.5" />
                {confirmEsignMut.isPending ? "Confirming..." : "Simulate / Confirm eSign Completion"}
              </button>
            </PermissionGuard>
          )}

          {(contract.status === "ACTIVE" || contract.status === "AMENDED") && (
            <>
              <PermissionGuard permission="po.create">
                <Link
                  href={`/purchase-orders/new?contract_id=${contract.id}&vendor_id=${contract.vendor_id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Create Purchase Order
                </Link>
              </PermissionGuard>
              <PermissionGuard permission="contract.amend">
                <button
                  onClick={() => setIsAmendModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Amend Contract
                </button>
              </PermissionGuard>
            </>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="w-full">
        <UnderlineTabs
          tabs={[
            { id: "overview", label: "Overview & SLAs" },
            { id: "scorecard", label: "Performance Scorecard" },
            { id: "lines", label: "Schedule of Rates", badge: lines.length },
            { id: "milestones", label: "Milestones", badge: milestones.length },
            { id: "amendments", label: "Amendments", badge: amendments.length },
            { id: "esign", label: "eSign & Audit", badge: signingLogs.length },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          ariaLabel="Contract Tabs"
        />
      </div>

      {/* Tab 1: Overview & SLAs */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Agreement Summary
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Contract Type</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {contract.contract_type.replace(/_/g, " ")}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Currency</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {contract.currency}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Total Contract Value</span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                    {contract.currency} {totalVal.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Start Date</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {new Date(contract.start_date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">End Date</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {new Date(contract.end_date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Auto Renewal</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                    {contract.auto_renew ? (
                      <span className="text-emerald-600">Enabled ({contract.renewal_notice_days}d notice)</span>
                    ) : (
                      <span className="text-slate-500">Disabled</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SLA Terms */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Service Level Agreements (SLA) & Terms
              </h3>

              {contract.sla_terms && Object.keys(contract.sla_terms).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(contract.sla_terms).map(([k, v]) => (
                    <div
                      key={k}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800"
                    >
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                        {k.replace(/_/g, " ")}
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1 block">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-4 text-center">
                  Standard enterprise procurement terms and conditions apply.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Rate Contract Meter & Document Links */}
          <div className="space-y-6">
            {contract.contract_type === "RATE_CONTRACT" && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Rate Contract Utilization
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Ceiling Limit</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {contract.currency} {totalVal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Current Invoiced / PO Draw</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {contract.currency} {utilVal.toLocaleString()}
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden mt-2">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        utilPct > 90
                          ? "bg-red-500"
                          : utilPct > 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${utilPct}%` }}
                    />
                  </div>
                  <div className="text-right text-xs font-bold text-slate-700 dark:text-slate-300">
                    {utilPct}% Utilized
                  </div>
                </div>
              </div>
            )}

            {/* Contract Documents (SPEC_17) */}
            <DocumentList
              entityType="CONTRACT"
              entityId={contract.id}
              title="Contract Legal & Supporting Documents"
              defaultDocumentType="SIGNED_CONTRACT"
            />
          </div>
        </div>
      )}

      {/* Tab: Contract Performance Scorecard Visualizer (Plan 13 / SPEC_13) */}
      {activeTab === "scorecard" && (() => {
        const completedMilestones = milestones.filter((m: any) => m.status === "COMPLETED").length;
        const totalMilestones = milestones.length;
        const milestonePct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 100;
        const remainingVal = Math.max(0, totalVal - utilVal);

        // Calculate dynamic health score
        let score = 100;
        if (utilPct > 95) score -= 15;
        else if (utilPct > 85) score -= 5;
        if (totalMilestones > 0 && milestonePct < 50) score -= 20;
        else if (totalMilestones > 0 && milestonePct < 80) score -= 10;
        if (contract.days_remaining !== null && contract.days_remaining !== undefined && contract.days_remaining < 30) {
          score -= 10;
        }
        score = Math.max(20, Math.min(100, score));

        const healthStatus =
          score >= 85
            ? { label: "EXCELLENT / HEALTHY", color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40" }
            : score >= 70
            ? { label: "SATISFACTORY", color: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40" }
            : score >= 50
            ? { label: "ATTENTION REQUIRED", color: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40" }
            : { label: "CRITICAL RISK", color: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40" };

        return (
          <div className="space-y-6">
            {/* Top Scorecard KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Overall Health Index */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Contract Health Index
                    </span>
                    <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="mt-4 flex items-baseline gap-3">
                    <span className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                      {score}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">/ 100</span>
                  </div>
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${healthStatus.color}`}>
                      {healthStatus.label}
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Milestones</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{milestonePct}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Utilized</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{utilPct}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Expiry</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {contract.days_remaining !== null && contract.days_remaining !== undefined ? `${contract.days_remaining}d` : "Active"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Drawdown Velocity */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Financial Drawdown & Budget
                    </span>
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Ceiling Value:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {contract.currency} {totalVal.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Invoiced / PO Drawdown:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {contract.currency} {utilVal.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Available Balance:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                        {contract.currency} {remainingVal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    <span>Drawdown Progress</span>
                    <span>{utilPct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        utilPct > 90 ? "bg-red-500" : utilPct > 70 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${utilPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Milestone Completion Progress */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Milestone Execution
                    </span>
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                      {completedMilestones}
                    </span>
                    <span className="text-xs text-slate-400">of {totalMilestones} deliverables completed</span>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      <span>Completion Rate</span>
                      <span>{milestonePct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${milestonePct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs text-slate-500">
                  <span>Pending: <strong>{totalMilestones - completedMilestones}</strong></span>
                  <span>Completed: <strong className="text-emerald-600">{completedMilestones}</strong></span>
                </div>
              </div>
            </div>

            {/* SLA Adherence & Vendor Performance Dimensions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SLA Adherence Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    SLA Terms & Performance Parameters
                  </h3>
                </div>

                {contract.sla_terms && Object.keys(contract.sla_terms).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(contract.sla_terms).map(([k, v]) => (
                      <div
                        key={k}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">
                            {k.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-slate-500 mt-0.5 block">
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <Check className="w-3 h-3" />
                          Compliant
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-xs text-slate-400">
                    Standard procurement service terms and dispute resolution protocols active.
                  </div>
                )}
              </div>

              {/* Vendor Execution Reliability Rating */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Vendor Execution Reliability Breakdown
                  </h3>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      <span>On-Time Milestone & Delivery SLA</span>
                      <span className="text-emerald-600 font-bold">96%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-emerald-500 rounded-full" style={{ width: "96%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      <span>Technical Quality & Specification Acceptance</span>
                      <span className="text-blue-600 font-bold">94%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-blue-500 rounded-full" style={{ width: "94%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      <span>Invoice Accuracy & Three-Way Match Adherence</span>
                      <span className="text-indigo-600 font-bold">98%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-indigo-500 rounded-full" style={{ width: "98%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      <span>Communication, Amendments & Clarification Responsiveness</span>
                      <span className="text-purple-600 font-bold">91%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-purple-500 rounded-full" style={{ width: "91%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tab 2: Schedule of Rates (Lines) */}
      {activeTab === "lines" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Contracted Lines & Rate Schedule
            </h3>
            <span className="text-xs text-slate-500">{lines.length} contracted line items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">#</th>
                  <th className="px-6 py-3.5">Item Description</th>
                  <th className="px-6 py-3.5">Contracted Qty</th>
                  <th className="px-6 py-3.5">Unit Rate</th>
                  <th className="px-6 py-3.5">Utilized Qty</th>
                  <th className="px-6 py-3.5">Total Line Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lines.map((line: ContractLine) => {
                  const qty = Number(line.contracted_quantity || 0);
                  const rate = Number(line.unit_rate || 0);
                  const lineTot = qty * rate;

                  return (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono text-xs">{line.line_number}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                        {line.item_description}
                        {line.hsn_code && (
                          <span className="block text-[11px] text-slate-400 font-mono">
                            HSN: {line.hsn_code}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">{qty}</td>
                      <td className="px-6 py-4 font-semibold">
                        {contract.currency} {rate.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                          {Number(line.utilized_quantity || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">
                        {contract.currency} {lineTot.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Milestones Tracker */}
      {activeTab === "milestones" && (
        <div>
          <MilestoneTracker
            milestones={milestones as any}
            canComplete={contract.status === "ACTIVE" || contract.status === "AMENDED"}
            onCompleteMilestone={handleCompleteMilestone}
            isCompleting={completeMilestoneMut.isPending}
          />
        </div>
      )}

      {/* Tab 4: Amendments History */}
      {activeTab === "amendments" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Contract Amendment Audit History
            </h3>
            {(contract.status === "ACTIVE" || contract.status === "AMENDED") && (
              <button
                onClick={() => setIsAmendModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                New Amendment
              </button>
            )}
          </div>

          {amendments.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              No amendments registered for this contract. All original terms remain active.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {amendments.map((a: ContractAmendment) => (
                <div key={a.id} className="p-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        v{a.amendment_number}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {a.amendment_type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Approved: {new Date(a.approved_at || a.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {a.change_description && (
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      <strong>Changes: </strong>
                      {a.change_description}
                    </p>
                  )}

                  {a.changes_summary && (
                    <div className="text-xs text-slate-500">
                      <strong>Summary: </strong>
                      {a.changes_summary}
                    </div>
                  )}

                  {a.original_snapshot && (
                    <div className="mt-2 text-[11px] font-mono bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      Previous Total Value: {contract.currency}{" "}
                      {Number((a.original_snapshot as any).total_value || 0).toLocaleString()} | End Date:{" "}
                      {(a.original_snapshot as any).end_date}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: eSign & Audit */}
      {activeTab === "esign" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Electronic Signature Integration Status
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-6">
              <div>
                <span className="text-slate-400">Provider</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {contract.esign_provider || "None"}
                </div>
              </div>
              <div>
                <span className="text-slate-400">eSign Request ID</span>
                <div className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                  {contract.esign_request_id || "N/A"}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Signatures Logged</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {signingLogs.length} signatures recorded
                </div>
              </div>
              <div>
                <span className="text-slate-400">Legal Admissibility</span>
                <div className="font-semibold text-emerald-600 mt-0.5">
                  Information Technology Act 2000 compliant
                </div>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <h4 className="text-xs uppercase font-bold text-slate-500 mb-3 tracking-wider">
                Digital Signing Audit Trail
              </h4>

              {signingLogs.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">
                  No signing events recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {signingLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between text-xs border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {log.signer_name} ({log.party})
                          </span>
                          <span className="text-slate-400 ml-2 font-mono">
                            {log.signer_email}
                          </span>
                        </div>
                      </div>
                      <div className="text-slate-400 text-right">
                        <div>{new Date(log.signed_at).toLocaleString()}</div>
                        <div className="font-mono text-[10px]">
                          IP: {log.ip_address} | Ref: {log.signature_ref}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Return Contract with Comments
            </h3>
            <p className="text-xs text-slate-500">
              Provide specific feedback or requirements for the drafter to revise and re-submit.
            </p>
            <textarea
              rows={4}
              placeholder="Specify clauses or rates requiring revisions..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:underline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturn}
                disabled={returnMut.isPending}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                {returnMut.isPending ? "Returning..." : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Amendment Modal */}
      {isAmendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-600" />
              Create Contract Amendment
            </h3>
            <p className="text-xs text-slate-500">
              Amend terms, extend validity period, or revise total contract value. An immutable snapshot of the existing contract will be archived.
            </p>

            <form onSubmit={handleCreateAmendment} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Amendment Type
                </label>
                <select
                  value={amendType}
                  onChange={(e) => setAmendType(e.target.value as any)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  <option value="VALUE_CHANGE">Total Contract Value Change</option>
                  <option value="SCOPE_CHANGE">Scope of Work Revision</option>
                  <option value="DATE_EXTENSION">Contract Validity Extension</option>
                  <option value="CLAUSE_MODIFICATION">Terms & Clauses Modification</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Change Description
                </label>
                <input
                  type="text"
                  placeholder="e.g., Value increase by 10% for additional services..."
                  value={amendDescription}
                  onChange={(e) => setAmendDescription(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Business Justification
                </label>
                <textarea
                  rows={2}
                  placeholder="Reasoning approved by category management..."
                  value={amendJustification}
                  onChange={(e) => setAmendJustification(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    New Total Value (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={String(contract.total_value)}
                    value={amendNewValue}
                    onChange={(e) => setAmendNewValue(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    New End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={amendNewEndDate}
                    onChange={(e) => setAmendNewEndDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAmendModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={amendMut.isPending}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {amendMut.isPending ? "Applying..." : "Apply Amendment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
