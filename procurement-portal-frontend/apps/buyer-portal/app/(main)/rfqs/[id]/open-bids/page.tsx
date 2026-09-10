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
import { PermissionGuard, Button, Badge } from "@procurement/ui";
import { Lock, ShieldCheck, CheckCircle2, KeyRound, ArrowLeft, BarChart3 } from "lucide-react";

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
    return <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading opening authorization...</div>;
  }
  if (isError || !rfq) {
    return <div className="p-12 text-center text-sm text-rose-500 dark:text-rose-400">Failed to load RFQ.</div>;
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
        router.push(`/rfqs/${id}/evaluation`);
      }, 2000);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to co-authorize bid opening");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/rfqs" className="hover:underline">RFQs</Link>
            <span>/</span>
            <Link href={`/rfqs/${id}`} className="hover:underline font-mono">{rfq.rfq_number}</Link>
            <span>/</span>
            <span>Bid Opening Authorization</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Dual-Authorization Bid Opening
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            In compliance with CVC integrity guidelines and security policy, tender unsealing requires two independent authorizations.
          </p>
        </div>

        <Link href={`/rfqs/${id}`}>
          <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Back to RFQ
          </Button>
        </Link>
      </div>

      {message && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-200 rounded-xl text-xs font-medium flex items-center gap-2 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Tender Parameters</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">RFQ Number</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{rfq.rfq_number}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Status</span>
            <span className="mt-0.5 inline-block">
              <Badge variant={rfq.status}>{rfq.status}</Badge>
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Sealed Bids Received</span>
            <span className="font-semibold font-mono text-slate-900 dark:text-slate-100 text-sm">{bidCount} Bids</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Submission Deadline</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {rfq.bid_close_at ? new Date(rfq.bid_close_at).toLocaleString() : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Two-Step Protocol Stepper */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          Dual-Authorization Ceremony
        </h2>

        {/* Step 1 */}
        <div className={`p-5 rounded-xl border transition-colors space-y-3 ${
          isInitiated
            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
            : "bg-slate-50 dark:bg-[#252529] border-slate-200 dark:border-white/10"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isInitiated ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
              }`}>
                {isInitiated ? "✓" : "1"}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Step 1: Committee Member Initiation</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Must be initiated by an authorized officer (cannot be the RFQ creator).
                </p>
              </div>
            </div>
            {isInitiated ? (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
                Initiated
              </span>
            ) : (
              <PermissionGuard permission="rfq.open_bids">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={initiateMutation.isPending}
                  loading={initiateMutation.isPending}
                  onClick={handleInitiate}
                  icon={<KeyRound className="w-3.5 h-3.5" />}
                >
                  Initiate Opening
                </Button>
              </PermissionGuard>
            )}
          </div>
          {isInitiated && rfq.bid_opening_initiated_at && (
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 pl-10 font-mono">
              Initiated at {new Date(rfq.bid_opening_initiated_at).toLocaleString()} by User ID {rfq.bid_opening_initiated_by?.slice(0, 8)}.
            </p>
          )}
        </div>

        {/* Step 2 */}
        <div className={`p-5 rounded-xl border transition-colors space-y-3 ${
          isCompleted
            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
            : !isInitiated
            ? "opacity-50 bg-slate-50 dark:bg-[#252529] border-slate-200 dark:border-white/10"
            : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isCompleted
                  ? "bg-emerald-600 text-white"
                  : isInitiated
                  ? "bg-amber-600 text-white"
                  : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
              }`}>
                {isCompleted ? "✓" : "2"}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Step 2: Second Committee Co-Authorization</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Must be authorized by a different officer than the initiator. Triggers cryptographic price decryption.
                </p>
              </div>
            </div>
            {isCompleted ? (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
                Decrypted & Unsealed
              </span>
            ) : (
              <PermissionGuard permission="rfq.open_bids">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!isInitiated || coAuthorizeMutation.isPending}
                  loading={coAuthorizeMutation.isPending}
                  onClick={handleCoAuthorize}
                  icon={<Lock className="w-3.5 h-3.5" />}
                >
                  Co-Authorize & Unseal
                </Button>
              </PermissionGuard>
            )}
          </div>
          {isCompleted && rfq.bids_opened_at && (
            <div className="space-y-3 pl-10">
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-mono">
                Officially opened at {new Date(rfq.bids_opened_at).toLocaleString()}. All line item prices are now unsealed for evaluation.
              </p>
              <Link href={`/rfqs/${id}/evaluation`}>
                <Button variant="primary" size="sm" icon={<BarChart3 className="w-3.5 h-3.5" />}>
                  Proceed to Evaluation & Comparative Statement &rarr;
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
