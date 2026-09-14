"use client";

import React, { useState } from "react";
import {
  useConsigneeGRNs,
  useConsigneeConfirmGRN,
  useConsigneeRejectGRN,
  useAppToast,
  type ConsigneeGRN,
} from "@procurement/hooks";
import { Button } from "@procurement/ui";
import { CheckCircle2, XCircle, Package, Loader2, Truck } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Awaiting Confirmation", color: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Confirmed", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700" },
};

export default function IndentDeliveriesPage() {
  const { toast } = useAppToast();
  const { data: grns = [], isLoading, refetch } = useConsigneeGRNs();
  const confirmGRN = useConsigneeConfirmGRN();
  const rejectGRN = useConsigneeRejectGRN();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleConfirm = async (grnId: string) => {
    setConfirmingId(grnId);
    try {
      await confirmGRN.mutateAsync({ grnId, note: "" });
      toast.success("Receipt confirmed!");
      refetch();
    } catch {
      toast.error("Confirmation failed");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleReject = async (grnId: string) => {
    if (!rejectReason.trim() || rejectReason.length < 10) {
      toast.error("Please provide a detailed rejection reason (min 10 characters)");
      return;
    }
    try {
      await rejectGRN.mutateAsync({ grnId, reason: rejectReason });
      toast.success("Rejection recorded");
      setRejectingId(null);
      setRejectReason("");
      refetch();
    } catch {
      toast.error("Rejection failed");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Deliveries</h1>
        <p className="text-gray-500 mt-1">Confirm or report issues with goods delivered to you</p>
      </div>

      <div className="space-y-4">
        {grns.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No deliveries assigned to you yet.</p>
          </div>
        )}
        {grns.map((grn: ConsigneeGRN) => (
          <div key={grn.id} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Package className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold text-gray-900">{grn.grn_number}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      STATUS_LABELS[grn.consignee_status]?.color ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {STATUS_LABELS[grn.consignee_status]?.label ?? grn.consignee_status}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Vendor: {grn.vendor_name ?? "—"} &bull; Receipt Date: {grn.receipt_date ?? "—"}
                </p>
              </div>

              {grn.consignee_status === "PENDING" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleConfirm(grn.id)}
                    disabled={confirmingId === grn.id}
                  >
                    {confirmingId === grn.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    Confirm Receipt
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setRejectingId(grn.id)}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Report Issue
                  </Button>
                </div>
              )}
            </div>

            {/* Rejection form */}
            {rejectingId === grn.id && (
              <div className="mt-4 border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Describe the issue in detail (min 10 characters)..."
                  value={rejectReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectReason(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="destructive" onClick={() => handleReject(grn.id)}>
                    Submit Rejection
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
