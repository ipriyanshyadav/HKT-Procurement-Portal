"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useContract,
  useCompleteMilestone,
  useConfirmContractEsign,
  ContractLine,
  ContractAmendment,
} from "@procurement/hooks";
import {
  ContractExpiryCountdown,
  MilestoneTracker,
  RateCardTable,
  ContractAmendmentHistory,
  DocumentList,
  UnderlineTabs,
  Button,
} from "@procurement/ui";
import {
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  TrendingUp,
  Award,
  Layers,
  FileSignature,
  DollarSign,
  Calendar,
} from "lucide-react";

export default function SupplierContractDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data: contract, isLoading, isError } = useContract(id);
  const completeMilestoneMut = useCompleteMilestone();
  const confirmEsignMut = useConfirmContractEsign();

  const [activeTab, setActiveTab] = useState<
    "overview" | "lines" | "milestones" | "amendments" | "esign"
  >("overview");

  if (isLoading) {
    return (
      <div className="p-20 text-center text-slate-500 dark:text-slate-400">
        <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
        Loading contract agreement...
      </div>
    );
  }

  if (isError || !contract) {
    return (
      <div className="p-20 text-center text-rose-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-rose-500" />
        Contract not found or you do not have permission to view it.
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

  const handleSignContract = async () => {
    try {
      await confirmEsignMut.mutateAsync({ contractId: id });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to sign contract");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/contracts" className="hover:underline">
              Contracts & Agreements
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              {contract.status.replace(/_/g, " ")}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#252529] text-slate-600 dark:text-slate-300 font-mono">
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

      {/* Supplier Action / Status Banner */}
      {contract.status === "PENDING_ESIGN" && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileSignature className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Action Required: Sign Procurement Contract
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                This contract has been approved by the buying organization and is awaiting digital signature execution.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSignContract}
            disabled={confirmEsignMut.isPending}
            className="shrink-0"
          >
            <FileCheck className="w-4 h-4 mr-1.5" />
            {confirmEsignMut.isPending ? "Signing..." : "Execute Digital Signature"}
          </Button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="w-full">
        <UnderlineTabs
          tabs={[
            { id: "overview", label: "Agreement Overview" },
            { id: "lines", label: "Agreed Rate Schedule", badge: lines.length },
            { id: "milestones", label: "Milestones & Obligations", badge: milestones.length },
            { id: "amendments", label: "Amendments", badge: amendments.length },
            { id: "esign", label: "Signature Audit Trail", badge: signingLogs.length },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          ariaLabel="Supplier Contract Tabs"
        />
      </div>

      {/* Tab 1: Agreement Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Agreement Summary & Legal Terms
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
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5 font-mono">
                    {contract.currency} {totalVal.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Effective Start Date</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {new Date(contract.start_date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Expiration Date</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {new Date(contract.end_date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Auto Renewal Clause</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                    {contract.auto_renew ? (
                      <span className="text-emerald-600">Active ({contract.renewal_notice_days}d notice)</span>
                    ) : (
                      <span className="text-slate-500">Not Applicable</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SLA Obligations */}
            <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Agreed Service Level Agreements (SLAs)
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
                  Standard enterprise supplier delivery and quality service terms apply.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Rate Drawdown & Documents */}
          <div className="space-y-6">
            {contract.contract_type === "RATE_CONTRACT" && (
              <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Rate Contract Drawdown
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Ceiling Limit</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                      {contract.currency} {totalVal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Invoiced / PO Draw</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      {contract.currency} {utilVal.toLocaleString()}
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-[#252529] rounded-full h-3 overflow-hidden mt-2">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        utilPct > 90
                          ? "bg-rose-500"
                          : utilPct > 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${utilPct}%` }}
                    />
                  </div>
                  <div className="text-right text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {utilPct}% Drawn
                  </div>
                </div>
              </div>
            )}

            {/* Supporting Legal Documents */}
            <DocumentList
              entityType="CONTRACT"
              entityId={contract.id}
              title="Contract Documents & Attachments"
              defaultDocumentType="SIGNED_CONTRACT"
            />
          </div>
        </div>
      )}

      {/* Tab 2: Rate Card Lines */}
      {activeTab === "lines" && (
        <RateCardTable
          lines={lines as any}
          contractType={contract.contract_type}
          currency={contract.currency}
          totalValue={contract.total_value}
          utilizedValue={contract.utilized_value}
          canEdit={false}
        />
      )}

      {/* Tab 3: Milestones & Obligations */}
      {activeTab === "milestones" && (
        <MilestoneTracker
          milestones={milestones as any}
          canComplete={contract.status === "ACTIVE" || contract.status === "AMENDED"}
          onCompleteMilestone={handleCompleteMilestone}
          isCompleting={completeMilestoneMut.isPending}
        />
      )}

      {/* Tab 4: Amendments History */}
      {activeTab === "amendments" && (
        <ContractAmendmentHistory
          amendments={amendments as any}
          currency={contract.currency}
          currentValue={contract.total_value}
          currentEndDate={contract.end_date}
          canAmend={false}
        />
      )}

      {/* Tab 5: eSign Audit */}
      {activeTab === "esign" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Electronic Signature Status & Verification
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-6">
              <div>
                <span className="text-slate-400">eSign Platform</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {contract.esign_provider || "Internal Direct"}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Reference ID</span>
                <div className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                  {contract.esign_request_id || "N/A"}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Signatures Logged</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {signingLogs.length} signatures
                </div>
              </div>
              <div>
                <span className="text-slate-400">Legal Compliance</span>
                <div className="font-semibold text-emerald-600 mt-0.5">
                  IT Act 2000 Compliant
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
    </div>
  );
}