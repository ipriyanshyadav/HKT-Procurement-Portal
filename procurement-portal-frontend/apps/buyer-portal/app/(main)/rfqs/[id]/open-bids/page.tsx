"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useRfq,
  useBidCount,
  useInitiateBidOpening,
  useCoAuthorizeBidOpening,
} from "@procurement/hooks";
import { PermissionGuard } from "@procurement/ui";

export default function DualAuthBidOpeningPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: rfq, isLoading, isError, refetch } = useRfq(id);
  const { data: bidCountData } = useBidCount(id);

  const initiateMutation = useInitiateBidOpening();
  const coAuthorizeMutation = useCoAuthorizeBidOpening();

  const [message, setMessage] = useState<string | null>(null);

  if (isLoading) {
    return <div className="p-12 text-center text-sm text-gray-500">Loading opening authorization...</div>;
  }
  if (isError || !rfq) {
    return <div className="p-12 text-center text-sm text-red-500">Failed to load RFQ.</div>;
  }

  const bidCount = bidCountData?.bid_count ?? 0;
  const isInitiated = Boolean(rfq.bid_opening_initiated_at);
  const isCompleted = Boolean(rfq.bids_opened_at);

  const handleInitiate = async () => {
    try {
      await initiateMutation.mutateAsync(id);
      setMessage("Bid opening initiated successfully! Awaiting co-authorization from a second committee member.");
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to initiate bid opening");
    }
  };

  const handleCoAuthorize = async () => {
    try {
      await coAuthorizeMutation.mutateAsync(id);
      setMessage("Dual-authorization complete! Bids have been cryptographically unsealed and converted.");
      refetch();
      setTimeout(() => {
        router.push(`/rfqs/${id}`);
      }, 2500);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to co-authorize bid opening");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="border-b pb-4">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <Link href="/rfqs" className="hover:underline">RFQs</Link>
          <span>/</span>
          <Link href={`/rfqs/${id}`} className="hover:underline font-mono">{rfq.rfq_number}</Link>
          <span>/</span>
          <span>Bid Opening Authorization</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Dual-Authorization Bid Opening
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          In compliance with CVC guidelines and security policy, tender unsealing requires two independent authorizations.
        </p>
      </div>

      {message && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-sm font-medium">
          {message}
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Tender Parameters</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-gray-500 block">RFQ Number</span>
            <span className="font-mono font-semibold text-gray-800">{rfq.rfq_number}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Status</span>
            <span className="font-semibold text-amber-700">{rfq.status}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Sealed Bids Received</span>
            <span className="font-semibold text-gray-900 text-sm">{bidCount} Bids</span>
          </div>
          <div>
            <span className="text-gray-500 block">Submission Deadline</span>
            <span className="font-semibold text-gray-800">
              {rfq.bid_close_at ? new Date(rfq.bid_close_at).toLocaleString() : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Two-Step Protocol Stepper */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
          Authorization Protocol
        </h2>

        {/* Step 1 */}
        <div className={`p-5 rounded-xl border ${isInitiated ? "bg-green-50/70 border-green-200" : "bg-gray-50 border-gray-200"} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isInitiated ? "bg-green-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                {isInitiated ? "✓" : "1"}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Step 1: Committee Member Initiation</h3>
                <p className="text-xs text-gray-500">
                  Must be initiated by an authorized officer (cannot be the RFQ creator).
                </p>
              </div>
            </div>
            {isInitiated ? (
              <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                Initiated
              </span>
            ) : (
              <PermissionGuard permission="rfq.open_bids">
                <button
                  type="button"
                  disabled={initiateMutation.isPending}
                  onClick={handleInitiate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {initiateMutation.isPending ? "Initiating..." : "Initiate Opening"}
                </button>
              </PermissionGuard>
            )}
          </div>
          {isInitiated && rfq.bid_opening_initiated_at && (
            <p className="text-[11px] text-green-800 pl-10">
              Initiated at {new Date(rfq.bid_opening_initiated_at).toLocaleString()} by User ID {rfq.bid_opening_initiated_by?.slice(0, 8)}.
            </p>
          )}
        </div>

        {/* Step 2 */}
        <div className={`p-5 rounded-xl border ${isCompleted ? "bg-green-50/70 border-green-200" : !isInitiated ? "opacity-50 bg-gray-50 border-gray-200" : "bg-amber-50/60 border-amber-200"} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isCompleted ? "bg-green-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                {isCompleted ? "✓" : "2"}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Step 2: Second Committee Co-Authorization</h3>
                <p className="text-xs text-gray-500">
                  Must be authorized by a different officer than the initiator. Triggers cryptographic price decryption.
                </p>
              </div>
            </div>
            {isCompleted ? (
              <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                Decrypted & Opened
              </span>
            ) : (
              <PermissionGuard permission="rfq.open_bids">
                <button
                  type="button"
                  disabled={!isInitiated || coAuthorizeMutation.isPending}
                  onClick={handleCoAuthorize}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {coAuthorizeMutation.isPending ? "Unsealing Bids..." : "Co-Authorize & Unseal"}
                </button>
              </PermissionGuard>
            )}
          </div>
          {isCompleted && rfq.bids_opened_at && (
            <p className="text-[11px] text-green-800 pl-10">
              Officially opened at {new Date(rfq.bids_opened_at).toLocaleString()}. All line item prices are now accessible for evaluation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
