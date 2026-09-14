"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useIndentTracking, useAppToast } from "@procurement/hooks";
import {
  PageHeader,
  Button,
  Badge,
  Card,
  TableSkeleton,
  EmptyState,
} from "@procurement/ui";
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

export default function IndentDeliveryTrackingPage() {
  const { toast } = useAppToast();
  const { data, isLoading } = useIndentTracking({ page: 1, page_size: 50 });

  const indents = data?.items ?? [];

  // Filter into In-Transit / Pending Delivery and Delivered / Done
  const activeDeliveries = indents.filter(
    (i) => ["APPROVED", "IN_SOURCING", "CONVERTED"].includes(i.status)
  );

  const [confirmingPrId, setConfirmingPrId] = useState<string | null>(null);

  const handleConfirmReceipt = (prNumber: string) => {
    toast.success(
      "Goods Receipt Acknowledged",
      `Delivery for ${prNumber} confirmed by consignee.`
    );
    setConfirmingPrId(null);
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Delivery & Consignee Tracking"
        subtitle="Monitor delivery of items requested via your indents and confirm physical receipt as designated consignee"
      />

      {/* Role Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200">
          <span className="font-semibold block mb-0.5">Consignee Acceptance Responsibility:</span>
          When goods are physically delivered to your plant/office, you act as the primary consignee to verify package integrity and quantity before final invoice 3-way match.
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : activeDeliveries.length === 0 ? (
        <EmptyState
          icon={<Truck className="w-8 h-8 text-neutral-400" />}
          title="No Active Deliveries"
          description="There are currently no active deliveries or purchase orders linked to your indents."
          action={
            <Link href="/indents/new">
              <Button variant="primary" size="sm">
                Raise New Indent
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            Active Indent Orders & Consignments ({activeDeliveries.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeDeliveries.map((indent) => (
              <Card key={indent.pr_id} className="p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold text-neutral-500">
                      {indent.pr_number}
                    </span>
                    <Badge variant={indent.status === "CONVERTED" ? "approved" : "pending"}>
                      {indent.status === "CONVERTED" ? "PO ISSUED" : indent.status}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-neutral-900 dark:text-white text-base line-clamp-1">
                    {indent.title}
                  </h3>

                  <div className="mt-3 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                    <div className="flex justify-between">
                      <span>Assigned Buyer:</span>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {indent.assigned_buyer_name || "Procurement Operations"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Associated PO:</span>
                      <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                        {indent.po_number || "Awaiting Sourcing Completion"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>GRN Status:</span>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {indent.grn_status || "Pending Delivery"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                  <Link href={`/indents/${indent.pr_id}`}>
                    <Button variant="ghost" size="sm" className="text-xs flex items-center gap-1">
                      View Indent <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>

                  {indent.status === "CONVERTED" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleConfirmReceipt(indent.pr_number)}
                      className="text-xs flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Receipt (GRN)
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
