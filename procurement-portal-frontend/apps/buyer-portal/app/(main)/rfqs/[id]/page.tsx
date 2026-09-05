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
import { BidSealedIndicator, ClarificationThread, PermissionGuard } from "@procurement/ui";

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
    return <div className="p-12 text-center text-sm text-gray-500">Loading RFQ details...</div>;
  }
  if (isError || !rfq) {
    return <div className="p-12 text-center text-sm text-red-500">Failed to load RFQ.</div>;
  }

  const vendors = (vendorData as any)?.vendors ?? (vendorData as any) ?? [];
  const bidCount = bidCountData?.bid_count ?? 0;
  const isOpened = Boolean(rfq.bids_opened_at);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/rfqs" className="hover:underline">RFQs</Link>
            <span>/</span>
            <span className="font-mono">{rfq.rfq_number}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{rfq.title}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              {rfq.status}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(rfq.status === "DRAFT" || rfq.status === "APPROVED") && (
            <PermissionGuard permission="rfq.publish">
              <button
                type="button"
                disabled={publishMutation.isPending}
                onClick={handlePublish}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                {publishMutation.isPending ? "Publishing..." : "Publish RFQ"}
              </button>
            </PermissionGuard>
          )}

          <Link
            href={`/rfqs/${id}/auction`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <span>⚡ Live Auction Room</span>
          </Link>

          {rfq.status === "BID_OPEN" && (
            <Link
              href={`/rfqs/${id}/open-bids`}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              Dual-Auth Bid Opening
            </Link>
          )}

          {Boolean(rfq.bids_opened_at) && (
            <Link
              href={`/rfqs/${id}/evaluation`}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              📊 Evaluation & CS
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
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Event Overview</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{rfq.description || "No scope description provided."}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t text-xs">
              <div>
                <span className="text-gray-500 block">Tender Type</span>
                <span className="font-semibold text-gray-800">{rfq.rfq_type}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Sourcing Type</span>
                <span className="font-semibold text-gray-800">{rfq.sourcing_type}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Evaluation Mode</span>
                <span className="font-semibold text-gray-800">{rfq.evaluation_type}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Estimated Value</span>
                <span className="font-semibold text-gray-800">₹{Number(rfq.estimated_value).toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Submission Deadline</span>
                <span className="font-semibold text-gray-800">
                  {rfq.bid_close_at ? new Date(rfq.bid_close_at).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Bid Validity</span>
                <span className="font-semibold text-gray-800">{rfq.bid_validity_days} Days</span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Line Items ({rfq.lines.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 font-semibold text-gray-500 border-b">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Est. Unit Price</th>
                    <th className="py-2.5 px-3">Est. Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {rfq.lines.map((line) => (
                    <tr key={line.id || line.line_number}>
                      <td className="py-3 px-3 font-mono font-medium">{line.line_number}</td>
                      <td className="py-3 px-3 font-medium text-gray-900">
                        {line.item_description}
                        {line.specifications && (
                          <div className="text-[11px] text-gray-500 mt-0.5">{line.specifications}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">{Number(line.quantity)}</td>
                      <td className="py-3 px-3">₹{Number(line.estimated_unit_price).toLocaleString("en-IN")}</td>
                      <td className="py-3 px-3 font-semibold text-gray-900">
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
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Invited Suppliers</h3>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                + Invite
              </button>
            </div>

            <div className="space-y-3">
              {rfq.participants.length === 0 ? (
                <p className="text-xs text-gray-500 py-3 text-center">No suppliers invited yet.</p>
              ) : (
                rfq.participants.map((p) => (
                  <div key={p.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-gray-800 block">Vendor ID: {p.vendor_id.slice(0, 8)}</span>
                      <span className="text-gray-400 text-[10px]">Invited: {new Date(p.invited_at).toLocaleDateString()}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700">
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">Invite Qualified Vendors</h3>
            <p className="text-xs text-gray-500">Select verified suppliers to invite to this tender event.</p>

            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-3">
              {vendors.map((v: any) => (
                <label key={v.id} className="flex items-center gap-2.5 text-xs p-1.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded cursor-pointer">
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
                    <span className="font-semibold text-gray-800">{v.company_name}</span>
                    <span className="text-gray-400 block text-[10px]">{v.vendor_code}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
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
