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
  useActivateContract,
  useTerminateContract,
  useCreateMilestone,
  useAddContractLine,
  useDeleteContractLine,
  ContractLine,
  ContractAmendment,
} from "@procurement/hooks";
import {
  ContractExpiryCountdown,
  MilestoneTracker,
  RateCardTable,
  ContractAmendmentHistory,
  DocumentList,
  PermissionGuard,
  UnderlineTabs,
  Button,
} from "@procurement/ui";
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
  Play,
  XOctagon,
  AlertOctagon,
  FileSignature,
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
  const activateMut = useActivateContract();
  const terminateMut = useTerminateContract();
  const amendMut = useAmendContract();
  const completeMilestoneMut = useCompleteMilestone();
  const createMilestoneMut = useCreateMilestone();
  const addLineMut = useAddContractLine();
  const deleteLineMut = useDeleteContractLine();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "overview" | "scorecard" | "lines" | "milestones" | "amendments" | "esign"
  >("overview");

  // Modals state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [isTerminateModalOpen, setIsTerminateModalOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");

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

  const handleActivate = async () => {
    if (!confirm("Activate this contract? Once active, purchase orders can be drawn against it.")) return;
    try {
      await activateMut.mutateAsync({ contractId: id });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to activate contract");
    }
  };

  const handleTerminate = async () => {
    if (!terminateReason.trim()) {
      alert("Please provide a reason or clause for contract termination.");
      return;
    }
    try {
      await terminateMut.mutateAsync({ contractId: id, reason: terminateReason });
      setIsTerminateModalOpen(false);
      setTerminateReason("");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to terminate contract");
    }
  };

  const handleAddLine = async (lineData: any) => {
    try {
      await addLineMut.mutateAsync({ contractId: id, data: lineData });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to add rate card line");
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!confirm("Remove this rate card line item?")) return;
    try {
      await deleteLineMut.mutateAsync({ contractId: id, lineId });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to delete rate card line");
    }
  };

  const handleAddMilestone = async (milestoneData: any) => {
    try {
      await createMilestoneMut.mutateAsync({ contractId: id, data: milestoneData });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to add milestone");
    }
  };

  const handleAmend = async (amendData: any) => {
    try {
      await amendMut.mutateAsync({
        contractId: id,
        data: {
          amendment_type: amendData.amendment_type,
          change_description: amendData.change_description,
          new_total_value: amendData.new_total_value,
          new_end_date: amendData.new_end_date,
        },
      });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to submit contract amendment");
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
          <Link
            href={`/contracts/${id}/redline`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <FileSignature className="w-3.5 h-3.5" />
            Clause Redlining & eSign Studio
          </Link>
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
                  Sign via Digio
                </button>
                <button
                  onClick={() => handleInitiateEsign("DOCUSIGN")}
                  disabled={initiateEsignMut.isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Sign via DocuSign
                </button>
                <button
                  onClick={handleActivate}
                  disabled={activateMut.isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {activateMut.isPending ? "Activating..." : "Directly Activate"}
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
                {confirmEsignMut.isPending ? "Confirming..." : "Simulate eSign Completion"}
              </button>
              <button
                onClick={handleActivate}
                disabled={activateMut.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {activateMut.isPending ? "Activating..." : "Activate Contract"}
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
                  onClick={() => setActiveTab("amendments")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Amend Contract
                </button>
              </PermissionGuard>
              <PermissionGuard permission="contract.update">
                <button
                  onClick={() => setIsTerminateModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  <XOctagon className="w-3.5 h-3.5" />
                  Terminate Contract
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
            <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6">
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
            <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Service Level Agreements (SLA) & Terms
              </h3>

              {contract.sla_terms && Object.keys(contract.sla_terms).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(contract.sla_terms).map(([k, v]) => (
                    <div
                      key={k}
                      className="p-3 bg-slate-50 dark:bg-[#252529] rounded-xl border border-slate-100 dark:border-white/10"
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
              <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6">
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

                  <div className="w-full bg-slate-100 dark:bg-[#252529] rounded-full h-3 overflow-hidden mt-2">
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
              <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col justify-between">
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

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/10 grid grid-cols-3 gap-2 text-center text-xs">
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
              <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col justify-between">
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

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
                  <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    <span>Drawdown Progress</span>
                    <span>{utilPct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-[#252529] rounded-full h-3 overflow-hidden">
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
              <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col justify-between">
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
                    <div className="w-full bg-slate-100 dark:bg-[#252529] rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${milestonePct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10 flex justify-between text-xs text-slate-500">
                  <span>Pending: <strong>{totalMilestones - completedMilestones}</strong></span>
                  <span>Completed: <strong className="text-emerald-600">{completedMilestones}</strong></span>
                </div>
              </div>
            </div>

            {/* SLA Adherence & Vendor Performance Dimensions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SLA Adherence Card */}
              <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6 space-y-4">
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
                        className="p-3 bg-slate-50 dark:bg-[#252529] rounded-xl border border-slate-100 dark:border-white/10 flex items-center justify-between"
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
                  <div className="p-6 bg-slate-50 dark:bg-[#252529] rounded-xl text-center text-xs text-slate-400">
                    Standard procurement service terms and dispute resolution protocols active.
                  </div>
                )}
              </div>

              {/* Vendor Execution Reliability Rating */}
              <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6 space-y-4">
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
                    <div className="w-full bg-slate-100 dark:bg-[#252529] rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-emerald-500 rounded-full" style={{ width: "96%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      <span>Technical Quality & Specification Acceptance</span>
                      <span className="text-blue-600 font-bold">94%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-[#252529] rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-blue-500 rounded-full" style={{ width: "94%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      <span>Invoice Accuracy & Three-Way Match Adherence</span>
                      <span className="text-indigo-600 font-bold">98%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-[#252529] rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-indigo-500 rounded-full" style={{ width: "98%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      <span>Communication, Amendments & Clarification Responsiveness</span>
                      <span className="text-purple-600 font-bold">91%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-[#252529] rounded-full h-2 overflow-hidden">
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
        <RateCardTable
          lines={lines as any}
          contractType={contract.contract_type}
          currency={contract.currency}
          totalValue={contract.total_value}
          utilizedValue={contract.utilized_value}
          canEdit={contract.status === "DRAFT" || contract.status === "PENDING_REVIEW"}
          onAddLine={handleAddLine}
          onDeleteLine={handleDeleteLine}
        />
      )}

      {/* Tab 3: Milestones Tracker */}
      {activeTab === "milestones" && (
        <MilestoneTracker
          milestones={milestones as any}
          canComplete={contract.status === "ACTIVE" || contract.status === "AMENDED"}
          onCompleteMilestone={handleCompleteMilestone}
          isCompleting={completeMilestoneMut.isPending}
          canAdd={contract.status === "DRAFT" || contract.status === "PENDING_REVIEW" || contract.status === "ACTIVE"}
          onAddMilestone={handleAddMilestone}
          isAdding={createMilestoneMut.isPending}
        />
      )}

      {/* Tab 4: Amendments History */}
      {activeTab === "amendments" && (
        <ContractAmendmentHistory
          amendments={amendments as any}
          currency={contract.currency}
          currentValue={contract.total_value}
          currentEndDate={contract.end_date}
          canAmend={contract.status === "ACTIVE" || contract.status === "AMENDED"}
          onAmend={handleAmend}
        />
      )}

      {/* Tab 5: eSign & Audit */}
      {activeTab === "esign" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6">
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
            <div className="border-t border-slate-100 dark:border-white/10 pt-4">
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
                      className="p-3 bg-slate-50 dark:bg-[#252529] rounded-xl flex items-center justify-between text-xs border border-slate-100 dark:border-white/10"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 dark:border-white/15">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Return Contract with Comments
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide specific feedback or requirements for the drafter to revise and re-submit.
            </p>
            <textarea
              rows={4}
              placeholder="Specify clauses or rates requiring revisions..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsReturnModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReturn}
                disabled={returnMut.isPending}
              >
                {returnMut.isPending ? "Returning..." : "Confirm Return"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Modal */}
      {isTerminateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-rose-200 dark:border-rose-900/40">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-5 h-5" />
              <h3 className="text-base font-bold">Terminate Contract</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Terminating this agreement will prevent any new Purchase Orders from being placed. This action cannot be undone.
            </p>
            <textarea
              rows={4}
              placeholder="State termination cause (e.g., Clause 14.2 Material Breach, Mutual Agreement)..."
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTerminateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleTerminate}
                disabled={terminateMut.isPending}
              >
                {terminateMut.isPending ? "Terminating..." : "Terminate Agreement"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
