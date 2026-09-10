"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useRfq,
  usePublishRfq,
  useAddRfqParticipants,
  useAddClarification,
  useRespondClarification,
  useBidCount,
  useVendors,
} from "@procurement/hooks";
import {
  BidSealedIndicator,
  ClarificationThread,
  PermissionGuard,
  Button,
  Badge,
} from "@procurement/ui";
import {
  Send,
  Zap,
  Lock,
  BarChart3,
  ArrowLeft,
  UserPlus,
  Clock,
  TrendingDown,
  ShieldCheck,
  FileText,
} from "lucide-react";

export default function RfqDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: rfq, isLoading, isError } = useRfq(id);
  const { data: bidCountData } = useBidCount(id);
  const { data: vendorData } = useVendors({ status: "ACTIVE" });

  const publishMutation = usePublishRfq();
  const addParticipantsMutation = useAddRfqParticipants();
  const addClarificationMutation = useAddClarification();
  const respondClarificationMutation = useRespondClarification();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  if (isLoading) {
    return <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading RFQ details...</div>;
  }
  if (isError || !rfq) {
    return <div className="p-12 text-center text-sm text-red-500">Failed to load RFQ.</div>;
  }

  const vendors = (vendorData as any)?.vendors ?? (vendorData as any) ?? [];
  const bidCount = bidCountData?.bid_count ?? 0;
  const isOpened = Boolean(rfq.bids_opened_at);
  const isEmergency = rfq.rfq_type === "EMERGENCY" || (rfq as any).is_emergency;
  const isLiveAuction = rfq.bidding_mode === "LIVE_AUCTION" || rfq.bidding_mode === "HYBRID";

  const handlePublish = async () => {
    if (!confirm("Are you sure you want to publish this RFQ to invited suppliers?")) return;
    try {
      await publishMutation.mutateAsync(id);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to publish RFQ");
    }
  };

  const handleAddParticipants = async () => {
    if (selectedVendors.length === 0) return;
    try {
      await addParticipantsMutation.mutateAsync({ id, vendor_ids: selectedVendors });
      setIsInviteModalOpen(false);
      setSelectedVendors([]);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to add participants");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Breadcrumb & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/rfqs" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> RFQs
            </Link>
            <span>/</span>
            <span className="font-mono">{rfq.rfq_number}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{rfq.title}</h1>
            <Badge variant={rfq.status.toLowerCase()}>
              {rfq.status.replace(/_/g, " ")}
            </Badge>
            {isEmergency && (
              <Badge variant="warning">
                ⚡ EMERGENCY
              </Badge>
            )}
            <Badge variant={isLiveAuction ? "review" : "draft"}>
              {rfq.bidding_mode?.replace(/_/g, " ") || "SEALED"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {(rfq.status === "DRAFT" || rfq.status === "APPROVED") && (
            <PermissionGuard permission="rfq.publish">
              <Button
                variant="primary"
                size="sm"
                disabled={publishMutation.isPending}
                loading={publishMutation.isPending}
                onClick={handlePublish}
                icon={<Send className="w-3.5 h-3.5 mr-1.5" />}
              >
                Publish RFQ
              </Button>
            </PermissionGuard>
          )}

          {isLiveAuction && (
            <Link href={`/rfqs/${id}/auction`}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" />}
              >
                Live Auction Room
              </Button>
            </Link>
          )}

          {rfq.status === "BID_OPEN" && (
            <Link href={`/rfqs/${id}/open-bids`}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Lock className="w-3.5 h-3.5 mr-1.5 text-blue-500" />}
              >
                Dual-Auth Bid Opening
              </Button>
            </Link>
          )}

          {Boolean(rfq.bids_opened_at) && (
            <Link href={`/rfqs/${id}/evaluation`}>
              <Button
                variant="primary"
                size="sm"
                icon={<BarChart3 className="w-3.5 h-3.5 mr-1.5" />}
              >
                Evaluation & CS
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Bid Sealed Status Banner */}
      <BidSealedIndicator
        bidCount={bidCount}
        isOpened={isOpened}
        openedAt={rfq.bids_opened_at}
        bidCloseAt={rfq.bid_close_at}
      />

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Event Overview</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{rfq.description || "No scope description provided."}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-white/10 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-medium">Tender Type</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{rfq.rfq_type}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-medium">Sourcing Type</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{rfq.sourcing_type}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-medium">Evaluation Mode</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{rfq.evaluation_type}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-medium">Estimated Value</span>
                <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">₹{Number(rfq.estimated_value).toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-medium">Submission Deadline</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {rfq.bid_close_at ? new Date(rfq.bid_close_at).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-medium">Bid Validity</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{rfq.bid_validity_days} Days</span>
              </div>
            </div>
          </div>

          {/* Emergency Track Notice */}
          {rfq.rfq_type === "EMERGENCY" && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-4 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-3">
              <span className="text-lg">🚨</span>
              <div>
                <span className="font-bold block">Accelerated Emergency Procurement Track</span>
                This tender is classified as an Emergency RFQ. Submission window is expedited to a 24-hour minimum window under Delegation of Financial Powers (DoFP) with priority technical and commercial evaluation.
              </div>
            </div>
          )}

          {/* Reverse Auction Engine Configuration */}
          {(isLiveAuction || rfq.auction_config || rfq.bidding_mode !== "SEALED") && (
            <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-amber-200/80 dark:border-amber-500/30 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Reverse Auction Engine Configuration
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Real-time competitive downward decrement rules & anti-sniping protection
                    </p>
                  </div>
                </div>
                <Link href={`/rfqs/${id}/auction`}>
                  <Button variant="primary" size="sm" icon={<Zap className="w-3.5 h-3.5 mr-1.5 text-amber-300" />}>
                    Enter Auction Console
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100 dark:border-white/10 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Bidding Mode</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{rfq.bidding_mode || "LIVE_AUCTION"}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Min. Decrement</span>
                  <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                    {rfq.auction_config?.min_decrement_value ?? 0.5} {rfq.auction_config?.min_decrement_type === "PERCENTAGE" ? "%" : "₹"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Anti-Sniping Trigger</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Last {rfq.auction_config?.auto_extend_trigger_minutes ?? 5} mins
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Auto-Extension</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    +{rfq.auction_config?.auto_extend_duration_minutes ?? 10} mins (Max {rfq.auction_config?.max_extensions ?? 3}x)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Rank Visibility</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {rfq.auction_config?.rank_visibility || "RANK_ONLY"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Reserve Ceiling</span>
                  <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                    {rfq.auction_config?.reserve_price_inr ? `₹${Number(rfq.auction_config.reserve_price_inr).toLocaleString("en-IN")}` : "Hidden / None"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Automated Proxy Floor</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {rfq.auction_config?.allow_proxy_bid ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">All Lots Required</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {rfq.auction_config?.require_all_lots !== false ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Line Items ({rfq.lines.length})</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-[#252529] font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Est. Unit Price</th>
                    <th className="py-2.5 px-3">Est. Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {rfq.lines.map((line) => (
                    <tr key={line.id || line.line_number} className="hover:bg-slate-50 dark:hover:bg-white/[0.04] transition">
                      <td className="py-3 px-3 font-mono font-medium text-slate-500 dark:text-slate-400">{line.line_number}</td>
                      <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {line.item_description}
                        {line.specifications && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{line.specifications}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono">{Number(line.quantity)}</td>
                      <td className="py-3 px-3 font-mono">₹{Number(line.estimated_unit_price).toLocaleString("en-IN")}</td>
                      <td className="py-3 px-3 font-semibold font-mono text-slate-900 dark:text-slate-100">
                        ₹{(Number(line.quantity) * Number(line.estimated_unit_price)).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Clarifications Section */}
          <ClarificationThread
            rfqId={id}
            clarifications={rfq.clarifications}
            isBuyer={true}
            onAnswerQuestion={async (cid, answer, broadcast) => {
              await respondClarificationMutation.mutateAsync({
                rfq_id: id,
                clarification_id: cid,
                answer,
                broadcast,
              });
            }}
          />
        </div>

        {/* Sidebar: Participants */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-slate-200 dark:border-white/15 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Invited Suppliers</h3>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Invite
              </button>
            </div>

            <div className="space-y-3">
              {rfq.participants.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">No suppliers invited yet.</p>
              ) : (
                rfq.participants.map((p) => (
                  <div key={p.id} className="p-3 bg-slate-50 dark:bg-[#252529] rounded-lg border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">Vendor ID: {p.vendor_id.slice(0, 8)}</span>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px]">Invited: {new Date(p.invited_at).toLocaleDateString()}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                      {p.invitation_status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1C1F] border border-slate-200 dark:border-white/15 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Invite Qualified Vendors</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Select verified suppliers to invite to this tender event.</p>

            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-white/15 rounded-lg p-3 bg-slate-50 dark:bg-[#252529]">
              {vendors.map((v: any) => (
                <label key={v.id} className="flex items-center gap-2.5 text-xs p-1.5 hover:bg-slate-200/50 dark:hover:bg-white/[0.05] rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedVendors.includes(v.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedVendors((prev) => [...prev, v.id]);
                      else setSelectedVendors((prev) => prev.filter((id) => id !== v.id));
                    }}
                    className="rounded text-blue-600"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{v.company_name}</span>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">{v.vendor_code}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedVendors.length === 0 || addParticipantsMutation.isPending}
                onClick={handleAddParticipants}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {addParticipantsMutation.isPending ? "Inviting..." : `Invite (${selectedVendors.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
