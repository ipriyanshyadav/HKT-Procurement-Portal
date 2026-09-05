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
  VendorDocument,
} from "@procurement/hooks";
import { ComplianceExpiryAlert, VendorStatusBadge, PermissionGuard, DocumentList } from "@procurement/ui";

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <Link href="/vendors" className="text-xs text-blue-600 hover:underline mb-1 inline-block">
            ← Back to Vendors List
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{vendor.company_name}</h1>
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
                <button
                  onClick={() => setModalAction("QUALIFY")}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Qualify Vendor
                </button>
              </PermissionGuard>
              <PermissionGuard permission="vendor.reject">
                <button
                  onClick={() => setModalAction("RESUBMIT")}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Request Resubmission
                </button>
              </PermissionGuard>
              <PermissionGuard permission="vendor.reject">
                <button
                  onClick={() => setModalAction("REJECT")}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Reject
                </button>
              </PermissionGuard>
            </>
          )}

          {vendor.status === "QUALIFIED" && (
            <PermissionGuard permission="vendor.activate">
              <button
                onClick={() => setModalAction("ACTIVATE")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                Activate Vendor
              </button>
            </PermissionGuard>
          )}

          {vendor.status === "ACTIVE" && (
            <>
              <PermissionGuard permission="vendor.suspend">
                <button
                  onClick={() => setModalAction("SUSPEND")}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Suspend
                </button>
              </PermissionGuard>
              <PermissionGuard permission="vendor.blacklist_initiate">
                <button
                  onClick={() => setModalAction("INITIATE_BLACKLIST")}
                  className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Initiate Blacklist
                </button>
              </PermissionGuard>
            </>
          )}

          {vendor.status === "SUSPENDED" && (
            <>
              <PermissionGuard permission="vendor.reinstate">
                <button
                  onClick={() => setModalAction("REINSTATE")}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Reinstate Vendor
                </button>
              </PermissionGuard>
              <PermissionGuard permission="vendor.blacklist_initiate">
                <button
                  onClick={() => setModalAction("INITIATE_BLACKLIST")}
                  className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Initiate Blacklist
                </button>
              </PermissionGuard>
            </>
          )}

          {vendor.blacklist_reason && !vendor.blacklisted_at && (
            <PermissionGuard permission="vendor.blacklist_approve">
              <button
                onClick={() => setModalAction("CONFIRM_BLACKLIST")}
                className="px-3.5 py-2 bg-red-900 hover:bg-red-950 text-white rounded-lg text-xs font-semibold shadow-sm transition animate-pulse"
              >
                Confirm Blacklisting (Dual-Approval)
              </button>
            </PermissionGuard>
          )}
        </div>
      </div>

      {/* Grid: Overview + Compliance + Scorecard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details & Documents */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-4">Vendor Profile</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-gray-500 font-medium">Legal Name</dt>
                <dd className="font-semibold text-gray-800">{vendor.legal_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 font-medium">Registration Type</dt>
                <dd className="font-semibold text-gray-800">{vendor.registration_type}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 font-medium">PAN</dt>
                <dd className="font-mono font-semibold text-gray-800">{vendor.pan || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 font-medium">GSTIN</dt>
                <dd className="font-mono font-semibold text-gray-800">{vendor.gstin || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 font-medium">CIN</dt>
                <dd className="font-mono font-semibold text-gray-800">{vendor.cin || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 font-medium">DUNS Number</dt>
                <dd className="font-mono font-semibold text-gray-800">{vendor.duns_number || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 font-medium">Email</dt>
                <dd className="font-semibold text-gray-800">{vendor.primary_email}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 font-medium">Phone</dt>
                <dd className="font-semibold text-gray-800">{vendor.primary_phone || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500 font-medium">Address</dt>
                <dd className="text-gray-800">
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
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Bank Accounts & Verification</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Penny-drop automated verification for secure vendor disbursements.
                </p>
              </div>
              <span className="text-xs font-semibold text-gray-500">
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
              <p className="text-sm text-gray-400 italic">No bank accounts added.</p>
            ) : (
              <div className="space-y-3">
                {vendor.bank_accounts.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900">{b.bank_name}</p>
                        {b.is_primary && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-mono">
                        A/C: {b.account_number_masked} · IFSC: {b.ifsc_code}
                      </p>
                      <p className="text-xs text-gray-500">
                        Holder: <span className="font-medium text-gray-700">{b.account_holder_name}</span>
                        {b.penny_test_reference && (
                          <span className="ml-2 font-mono text-[11px] text-gray-400">
                            Ref: {b.penny_test_reference}
                          </span>
                        )}
                      </p>
                      {b.penny_test_validated_at && (
                        <p className="text-[11px] text-emerald-600">
                          Validated on {new Date(b.penny_test_validated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-center">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          b.penny_test_status === "VALIDATED"
                            ? "bg-emerald-100 text-emerald-800"
                            : b.penny_test_status === "PENNY_TEST_INITIATED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-700"
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
                          <button
                            onClick={() => {
                              setPennyBankId(b.id);
                              setPennyAmountInput("");
                              setPennyFeedback(null);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                          >
                            Verify Deposit
                          </button>
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
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 underline disabled:opacity-50"
                          >
                            Re-send
                          </button>
                        </div>
                      ) : b.penny_test_status !== "VALIDATED" ? (
                        <button
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
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                        >
                          {initiatePennyTest.isPending ? "Initiating..." : "Initiate Penny Test"}
                        </button>
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
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-3">Performance Scorecard</h2>
            {vendor.scorecard ? (
              <div className="space-y-4">
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-extrabold text-blue-600">
                    {vendor.scorecard.overall_score}%
                  </div>
                  <div className="text-xs font-medium text-gray-500 mt-1">Overall Score</div>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">On-Time Delivery (40%):</span>
                    <span className="font-semibold">{vendor.scorecard.on_time_delivery_rate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Quality Acceptance (30%):</span>
                    <span className="font-semibold">{vendor.scorecard.quality_acceptance_rate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Commercial Compliance (20%):</span>
                    <span className="font-semibold">{vendor.scorecard.commercial_compliance_score}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Responsiveness (10%):</span>
                    <span className="font-semibold">{vendor.scorecard.responsiveness_score}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No scorecard calculated yet.</p>
            )}
          </div>

          {/* Status & Lifecycle Notes */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 text-xs space-y-3">
            <h2 className="text-base font-bold text-gray-900 mb-2">Lifecycle History</h2>
            {vendor.submitted_at && (
              <div>
                <span className="text-gray-400">Submitted:</span>{" "}
                <span className="font-medium text-gray-700">
                  {new Date(vendor.submitted_at).toLocaleString()}
                </span>
              </div>
            )}
            {vendor.qualified_at && (
              <div>
                <span className="text-gray-400">Qualified:</span>{" "}
                <span className="font-medium text-gray-700">
                  {new Date(vendor.qualified_at).toLocaleString()}
                </span>
              </div>
            )}
            {vendor.activated_at && (
              <div>
                <span className="text-gray-400">Activated:</span>{" "}
                <span className="font-medium text-gray-700">
                  {new Date(vendor.activated_at).toLocaleString()}
                </span>
              </div>
            )}
            {vendor.suspension_reason && (
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded text-amber-900">
                <strong>Reason:</strong> {vendor.suspension_reason}
              </div>
            )}
            {vendor.blacklist_reason && (
              <div className="bg-red-50 border border-red-200 p-2.5 rounded text-red-900">
                <strong>Blacklist Reason:</strong> {vendor.blacklist_reason}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Modal */}
      {modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {modalAction.replace(/_/g, " ")} Confirmation
            </h3>
            <p className="text-xs text-gray-500">
              Please enter notes or justification for this lifecycle transition.
            </p>
            {modalAction !== "ACTIVATE" && (
              <textarea
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                placeholder="Reason or notes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setModalAction(null);
                  setModalInput("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleActionSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Penny Test Verification Modal */}
      {pennyBankId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Confirm Penny-Drop Deposit</h3>
              <p className="text-xs text-gray-500 mt-1">
                Enter the exact micro-deposit amount that appeared in the vendor's bank account
                statement for{" "}
                <span className="font-semibold text-gray-700">
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Amount Received (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={pennyAmountInput}
                onChange={(e) => setPennyAmountInput(e.target.value)}
                placeholder="e.g. 1.05"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                autoFocus
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Amount must exactly match the micro-deposit generated during test initiation.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setPennyBankId(null);
                  setPennyAmountInput("");
                }}
                disabled={confirmPennyTest.isPending}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {confirmPennyTest.isPending ? "Validating..." : "Confirm & Validate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
