"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useActivateVendor,
  useConfirmBlacklist,
  useInitiateBlacklist,
  useQualifyVendor,
  useReinstateVendor,
  useRejectVendor,
  useRequestResubmission,
  useSuspendVendor,
  useVendorDetail,
  useInitiatePennyTest,
  useConfirmPennyTest,
  useCalculateVendorScorecard,
  VendorDocument,
} from "@procurement/hooks";
import { ComplianceExpiryAlert, VendorStatusBadge, PermissionGuard, DocumentList, Button, Badge } from "@procurement/ui";

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const { data: vendor, isLoading, isError, refetch } = useVendorDetail(vendorId);

  // Mutation hooks
  const qualifyMutation = useQualifyVendor(vendorId);
  const activateMutation = useActivateVendor(vendorId);
  const rejectMutation = useRejectVendor(vendorId);
  const resubmitMutation = useRequestResubmission(vendorId);
  const suspendMutation = useSuspendVendor(vendorId);
  const reinstateMutation = useReinstateVendor(vendorId);
  const initiateBlacklistMutation = useInitiateBlacklist(vendorId);
  const confirmBlacklistMutation = useConfirmBlacklist(vendorId);
  const calculateScorecardMutation = useCalculateVendorScorecard(vendorId);

  // Penny-Drop Verification State
  const initiatePennyTest = useInitiatePennyTest(vendorId);
  const confirmPennyTest = useConfirmPennyTest(vendorId);
  const [pennyBankId, setPennyBankId] = useState<string | null>(null);
  const [pennyAmountInput, setPennyAmountInput] = useState<string>("");
  const [pennyFeedback, setPennyFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal dialog state
  const [modalAction, setModalAction] = useState<string | null>(null);
  const [modalInput, setModalInput] = useState<string>("");

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-48 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (isError || !vendor) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center">
        <p className="text-red-600 font-semibold mb-2">Vendor not found or access denied.</p>
        <Link href="/vendors" className="text-blue-600 hover:underline text-sm">
          ← Back to Vendors
        </Link>
      </div>
    );
  }

  const handleActionSubmit = async () => {
    if (!modalAction) return;

    try {
      if (modalAction === "QUALIFY") {
        await qualifyMutation.mutateAsync(modalInput || undefined);
      } else if (modalAction === "ACTIVATE") {
        await activateMutation.mutateAsync();
      } else if (modalAction === "REJECT") {
        await rejectMutation.mutateAsync(modalInput);
      } else if (modalAction === "RESUBMIT") {
        await resubmitMutation.mutateAsync(modalInput);
      } else if (modalAction === "SUSPEND") {
        await suspendMutation.mutateAsync(modalInput);
      } else if (modalAction === "REINSTATE") {
        await reinstateMutation.mutateAsync(modalInput || undefined);
      } else if (modalAction === "INITIATE_BLACKLIST") {
        await initiateBlacklistMutation.mutateAsync(modalInput);
      } else if (modalAction === "CONFIRM_BLACKLIST") {
        await confirmBlacklistMutation.mutateAsync({ reason: modalInput || undefined });
      }
      setModalAction(null);
      setModalInput("");
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err.message || "Action failed");
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <Link href="/vendors" className="text-xs text-blue-600 hover:underline mb-1 inline-block">
            ← Back to Vendors List
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{vendor.company_name}</h1>
            <VendorStatusBadge status={vendor.status} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">
            Code: {vendor.vendor_code || "Not Assigned"} | ID: {vendor.id}
          </p>
        </div>

        {/* Action Buttons guarded by current lifecycle status */}
        <div className="flex flex-wrap items-center gap-2">
          {["SUBMITTED", "UNDER_REVIEW"].includes(vendor.status) && (
            <>
              <PermissionGuard permission="vendor.qualify">
                <Button
                  size="sm"
                  onClick={() => setModalAction("QUALIFY")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  Qualify Vendor
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="vendor.reject">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setModalAction("RESUBMIT")}
                >
                  Request Resubmission
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="vendor.reject">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setModalAction("REJECT")}
                >
                  Reject
                </Button>
              </PermissionGuard>
            </>
          )}

          {vendor.status === "QUALIFIED" && (
            <PermissionGuard permission="vendor.activate">
              <Button
                size="sm"
                onClick={() => setModalAction("ACTIVATE")}
              >
                Activate Vendor
              </Button>
            </PermissionGuard>
          )}

          {vendor.status === "ACTIVE" && (
            <>
              <PermissionGuard permission="vendor.suspend">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setModalAction("SUSPEND")}
                >
                  Suspend
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="vendor.blacklist_initiate">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setModalAction("INITIATE_BLACKLIST")}
                >
                  Initiate Blacklist
                </Button>
              </PermissionGuard>
            </>
          )}

          {vendor.status === "SUSPENDED" && (
            <>
              <PermissionGuard permission="vendor.reinstate">
                <Button
                  size="sm"
                  onClick={() => setModalAction("REINSTATE")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Reinstate Vendor
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="vendor.blacklist_initiate">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setModalAction("INITIATE_BLACKLIST")}
                >
                  Initiate Blacklist
                </Button>
              </PermissionGuard>
            </>
          )}

          {vendor.blacklist_reason && !vendor.blacklisted_at && (
            <PermissionGuard permission="vendor.blacklist_approve">
              <Button
                size="sm"
                variant="danger"
                onClick={() => setModalAction("CONFIRM_BLACKLIST")}
                className="animate-pulse"
              >
                Confirm Blacklisting (Dual-Approval)
              </Button>
            </PermissionGuard>
          )}
        </div>
      </div>

      {/* Grid: Overview + Compliance + Scorecard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details & Documents */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information Card */}
          <div className="bg-white dark:bg-[#1C1C1F] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/15 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-3">Vendor Profile</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Legal Name</dt>
                <dd className="font-semibold text-slate-900 dark:text-white mt-0.5">{vendor.legal_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Registration Type</dt>
                <dd className="font-semibold text-slate-900 dark:text-white mt-0.5">{vendor.registration_type}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">PAN</dt>
                <dd className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">{vendor.pan || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">GSTIN</dt>
                <dd className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">{vendor.gstin || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">CIN</dt>
                <dd className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">{vendor.cin || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">DUNS Number</dt>
                <dd className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">{vendor.duns_number || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Email</dt>
                <dd className="font-semibold text-slate-900 dark:text-white mt-0.5">{vendor.primary_email}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Phone</dt>
                <dd className="font-semibold text-slate-900 dark:text-white mt-0.5">{vendor.primary_phone || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Address</dt>
                <dd className="text-slate-800 dark:text-slate-200 mt-0.5">
                  {[vendor.address_line1, vendor.address_line2, vendor.city, vendor.state, vendor.postal_code, vendor.country_code]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Compliance & Documents Card (SPEC_17) */}
          <DocumentList
            entityType="VENDOR"
            entityId={vendorId}
            title="Compliance & Statutory Documents"
            defaultDocumentType="GSTIN_CERTIFICATE"
          />

          {/* Bank Accounts Card */}
          <div className="bg-white dark:bg-[#1C1C1F] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/15 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Bank Accounts & Verification</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Penny-drop automated verification for secure vendor disbursements.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {vendor.bank_accounts.length} account{vendor.bank_accounts.length === 1 ? "" : "s"}
              </span>
            </div>

            {pennyFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
                  pennyFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <span>{pennyFeedback.message}</span>
                <button
                  onClick={() => setPennyFeedback(null)}
                  className="text-xs opacity-70 hover:opacity-100 font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {vendor.bank_accounts.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No bank accounts added.</p>
            ) : (
              <div className="space-y-3">
                {vendor.bank_accounts.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#252529] gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white">{b.bank_name}</p>
                        {b.is_primary && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                        A/C: {b.account_number_masked} · IFSC: {b.ifsc_code}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Holder: <span className="font-medium text-slate-700 dark:text-slate-300">{b.account_holder_name}</span>
                        {b.penny_test_reference && (
                          <span className="ml-2 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                            Ref: {b.penny_test_reference}
                          </span>
                        )}
                      </p>
                      {b.penny_test_validated_at && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          Validated on {new Date(b.penny_test_validated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-center">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          b.penny_test_status === "VALIDATED"
                            ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                            : b.penny_test_status === "PENNY_TEST_INITIATED"
                            ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                            : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {b.penny_test_status === "VALIDATED"
                          ? "✓ VALIDATED"
                          : b.penny_test_status === "PENNY_TEST_INITIATED"
                          ? "INITIATED"
                          : b.penny_test_status || "UNVERIFIED"}
                      </span>

                      {b.penny_test_status === "PENNY_TEST_INITIATED" ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => {
                              setPennyBankId(b.id);
                              setPennyAmountInput("");
                              setPennyFeedback(null);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          >
                            Verify Deposit
                          </Button>
                          <button
                            onClick={async () => {
                              try {
                                setPennyFeedback(null);
                                await initiatePennyTest.mutateAsync(b.id);
                                setPennyFeedback({
                                  type: "success",
                                  message: `Penny test re-dispatched for ${b.bank_name}.`,
                                });
                                refetch();
                              } catch (e: any) {
                                setPennyFeedback({
                                  type: "error",
                                  message:
                                    e?.response?.data?.error?.message ||
                                    e.message ||
                                    "Failed to initiate penny test",
                                });
                              }
                            }}
                            disabled={initiatePennyTest.isPending}
                            className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white underline disabled:opacity-50"
                          >
                            Re-send
                          </button>
                        </div>
                      ) : b.penny_test_status !== "VALIDATED" ? (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              setPennyFeedback(null);
                              await initiatePennyTest.mutateAsync(b.id);
                              setPennyFeedback({
                                type: "success",
                                message: `Penny drop initiated for ${b.bank_name}. Test deposit sent.`,
                              });
                              refetch();
                            } catch (e: any) {
                              setPennyFeedback({
                                type: "error",
                                message:
                                  e?.response?.data?.error?.message ||
                                  e.message ||
                                  "Failed to initiate penny test",
                              });
                            }
                          }}
                          disabled={initiatePennyTest.isPending}
                        >
                          {initiatePennyTest.isPending ? "Initiating..." : "Initiate Penny Test"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Scorecard & Lifecycle History */}
        <div className="space-y-6">
          {/* Performance Scorecard Card */}
          <div className="bg-white dark:bg-[#1C1C1F] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/15 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Performance Scorecard</h2>
              <PermissionGuard permission={["vendor.qualify", "vendor.activate"]}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={calculateScorecardMutation.isPending}
                  onClick={async () => {
                    try {
                      await calculateScorecardMutation.mutateAsync({});
                      refetch();
                    } catch (err: any) {
                      alert(err?.response?.data?.error?.message || err.message || "Failed to calculate scorecard");
                    }
                  }}
                  className="text-xs h-7 px-2.5"
                >
                  {calculateScorecardMutation.isPending ? "Calculating..." : "Recalculate"}
                </Button>
              </PermissionGuard>
            </div>
            {vendor.scorecard ? (
              <div className="space-y-4">
                <div className="text-center py-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 rounded-xl">
                  <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                    {vendor.scorecard.overall_score}%
                  </div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1 uppercase">Overall Score</div>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">On-Time Delivery (40%):</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{vendor.scorecard.on_time_delivery_rate}%</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Quality Acceptance (30%):</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{vendor.scorecard.quality_acceptance_rate}%</span>
                  </div>
                  {vendor.scorecard.quality_rejection_rate != null && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-500 dark:text-slate-400">Quality Rejection Rate:</span>
                      <span className="font-semibold text-rose-500 dark:text-rose-400">{vendor.scorecard.quality_rejection_rate}%</span>
                    </div>
                  )}
                  {vendor.scorecard.pricing_competitiveness != null && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-500 dark:text-slate-400">Pricing Competitiveness:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{vendor.scorecard.pricing_competitiveness}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Commercial Compliance (20%):</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{vendor.scorecard.commercial_compliance_score}%</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Responsiveness (10%):</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{vendor.scorecard.responsiveness_score}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No scorecard calculated yet.</p>
            )}
          </div>

          {/* Financial & ESG Risk Profile Card */}
          <div className="bg-white dark:bg-[#1C1C1F] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/15 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Financial & ESG Risk Profile</h2>
              {vendor.risk_assessment && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  vendor.risk_assessment.risk_tier === "CRITICAL"
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                    : vendor.risk_assessment.risk_tier === "HIGH"
                    ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                    : vendor.risk_assessment.risk_tier === "MEDIUM"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                }`}>
                  {vendor.risk_assessment.risk_tier} RISK
                </span>
              )}
            </div>

            {vendor.risk_assessment ? (
              <div className="space-y-4">
                <div className="text-center py-3 bg-slate-50 dark:bg-[#252529] border border-slate-200 dark:border-white/10 rounded-xl">
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {vendor.risk_assessment.overall_risk_score} / 100
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Composite Risk Index</div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider mb-1">Financial Stability</div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Credit Rating:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{vendor.risk_assessment.credit_rating}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Financial Risk Score:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{vendor.risk_assessment.financial_risk_score}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Liquidity / Bankruptcy:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{vendor.risk_assessment.liquidity_risk} / {vendor.risk_assessment.bankruptcy_risk}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs pt-2 border-t border-slate-100 dark:border-white/10">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider mb-1">ESG Health</div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">ESG Rating:</span>
                    <span className="font-semibold text-emerald-500 dark:text-emerald-400">{vendor.risk_assessment.esg_rating}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Env / Social / Gov:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {vendor.risk_assessment.environmental_score} / {vendor.risk_assessment.social_score} / {vendor.risk_assessment.governance_score}
                    </span>
                  </div>
                </div>

                {vendor.risk_assessment.risk_factors && vendor.risk_assessment.risk_factors.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-white/10 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Identified Risk Factors:</span>
                    <ul className="mt-1 space-y-1 list-disc list-inside text-slate-500 dark:text-slate-400">
                      {vendor.risk_assessment.risk_factors.map((f: any, idx: number) => (
                        <li key={idx}>{typeof f === 'string' ? f : JSON.stringify(f)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No risk assessment recorded yet.</p>
            )}
          </div>

          {/* Status & Lifecycle Notes */}
          <div className="bg-white dark:bg-[#1C1C1F] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/15 text-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-3">Lifecycle History</h2>
            {vendor.submitted_at && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Submitted:</span>{" "}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {new Date(vendor.submitted_at).toLocaleString()}
                </span>
              </div>
            )}
            {vendor.qualified_at && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Qualified:</span>{" "}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {new Date(vendor.qualified_at).toLocaleString()}
                </span>
              </div>
            )}
            {vendor.activated_at && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Activated:</span>{" "}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {new Date(vendor.activated_at).toLocaleString()}
                </span>
              </div>
            )}
            {vendor.suspension_reason && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3 rounded-xl text-amber-900 dark:text-amber-200">
                <strong>Suspension Reason:</strong> {vendor.suspension_reason}
              </div>
            )}
            {vendor.blacklist_reason && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 rounded-xl text-rose-900 dark:text-rose-200">
                <strong>Blacklist Reason:</strong> {vendor.blacklist_reason}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Modal */}
      {modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-white/15">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {modalAction.replace(/_/g, " ")} Confirmation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please enter notes or justification for this lifecycle transition.
            </p>
            {modalAction !== "ACTIVATE" && (
              <textarea
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                placeholder="Reason or notes..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 rounded-xl text-sm bg-white dark:bg-[#252529] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setModalAction(null);
                  setModalInput("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleActionSubmit}
              >
                Confirm Action
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Penny Test Verification Modal */}
      {pennyBankId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-white/15">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Penny-Drop Deposit</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter the exact micro-deposit amount that appeared in the vendor&apos;s bank account
                statement for{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {vendor.bank_accounts.find((b) => b.id === pennyBankId)?.bank_name}
                </span>{" "}
                (A/C:{" "}
                {
                  vendor.bank_accounts.find((b) => b.id === pennyBankId)
                    ?.account_number_masked
                }
                ).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount Received (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={pennyAmountInput}
                onChange={(e) => setPennyAmountInput(e.target.value)}
                placeholder="e.g. 1.05"
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 rounded-xl text-sm bg-white dark:bg-[#252529] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                autoFocus
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Amount must exactly match the micro-deposit generated during test initiation.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPennyBankId(null);
                  setPennyAmountInput("");
                }}
                disabled={confirmPennyTest.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const amt = parseFloat(pennyAmountInput);
                  if (isNaN(amt) || amt <= 0) {
                    setPennyFeedback({
                      type: "error",
                      message: "Please enter a valid amount (e.g. 1.05)",
                    });
                    return;
                  }
                  try {
                    const res = await confirmPennyTest.mutateAsync({
                      bankId: pennyBankId,
                      amountReceived: amt,
                    });
                    if (res.is_valid) {
                      setPennyFeedback({
                        type: "success",
                        message: "Penny-drop verified successfully! Bank account validated.",
                      });
                      setPennyBankId(null);
                      setPennyAmountInput("");
                      refetch();
                    } else {
                      setPennyFeedback({
                        type: "error",
                        message:
                          "Amount verification mismatch. Account validation failed.",
                      });
                    }
                  } catch (err: any) {
                    setPennyFeedback({
                      type: "error",
                      message:
                        err?.response?.data?.error?.message ||
                        err.message ||
                        "Failed to confirm penny test",
                    });
                  }
                }}
                disabled={confirmPennyTest.isPending || !pennyAmountInput}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                {confirmPennyTest.isPending ? "Validating..." : "Confirm & Validate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
