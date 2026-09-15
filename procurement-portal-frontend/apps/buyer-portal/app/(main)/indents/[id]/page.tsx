"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useRequisition,
  useWithdrawRequisition,
  useAppToast,
} from "@procurement/hooks";
import {
  PageHeader,
  Button,
  Badge,
  Card,
  PermissionGuard,
} from "@procurement/ui";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  UserCheck,
  ShoppingBag,
  Truck,
  XCircle,
  FileText,
  AlertCircle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "blue",
  PENDING_APPROVAL: "yellow",
  APPROVED: "green",
  IN_SOURCING: "purple",
  CONVERTED: "green",
  WITHDRAWN: "gray",
  REJECTED: "red",
};

export default function IndentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { toast } = useAppToast();

  const { data: pr, isLoading, isError, refetch } = useRequisition(id);
  const withdrawMutation = useWithdrawRequisition();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center text-neutral-500">
        Loading indent details...
      </div>
    );
  }

  if (isError || !pr) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center space-y-4">
        <p className="text-red-600 font-semibold">Indent not found or access denied.</p>
        <Link href="/indents">
          <Button variant="ghost" size="sm">
            ← Back to My Indents
          </Button>
        </Link>
      </div>
    );
  }

  const handleWithdraw = async () => {
    if (!window.confirm("Are you sure you want to withdraw this demand indent?")) {
      return;
    }
    try {
      setIsWithdrawing(true);
      await withdrawMutation.mutateAsync(pr.id);
      toast.success(
        "Indent Withdrawn",
        "Your demand indent has been withdrawn from processing."
      );
      refetch();
    } catch (err: any) {
      toast.error(
        "Failed to withdraw",
        err?.message || "Please try again."
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  const steps = [
    { label: "Indent Raised", done: true, current: false },
    {
      label: "Transferred to Buyer",
      done: ["SUBMITTED", "PENDING_APPROVAL", "APPROVED", "IN_SOURCING", "CONVERTED"].includes(pr.status),
      current: pr.status === "SUBMITTED",
    },
    {
      label: "Approved",
      done: ["APPROVED", "IN_SOURCING", "CONVERTED"].includes(pr.status),
      current: pr.status === "PENDING_APPROVAL",
    },
    {
      label: "In Sourcing / Tender",
      done: ["IN_SOURCING", "CONVERTED"].includes(pr.status),
      current: pr.status === "IN_SOURCING",
    },
    {
      label: "PO Placed",
      done: pr.status === "CONVERTED" || Boolean(pr.po_number),
      current: pr.status === "APPROVED",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link href="/indents">
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to My Indents
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              {pr.pr_number}
            </span>
            <Badge variant={pr.status.toLowerCase()}>{pr.status.replace(/_/g, " ")}</Badge>
            <Badge variant="review">Demand Indent</Badge>
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{pr.title}</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Raised on {new Date(pr.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-neutral-400">Total Est. Value</div>
            <div className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
              ₹{Number(pr.estimated_value).toLocaleString("en-IN")}
            </div>
          </div>
          {pr.status === "SUBMITTED" && (
            <PermissionGuard permission="indent.withdraw">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleWithdraw}
                loading={isWithdrawing}
                className="flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> Withdraw
              </Button>
            </PermissionGuard>
          )}
        </div>
      </div>

      {/* Lifecycle Progress Bar */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          Lifecycle & Hand-off Tracking
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border text-center flex flex-col items-center gap-1.5 ${
                s.done
                  ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                  : s.current
                  ? "bg-amber-50/50 border-amber-300 dark:bg-amber-950/20 dark:border-amber-700"
                  : "bg-neutral-50 border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 opacity-60"
              }`}
            >
              {s.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : s.current ? (
                <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-600 text-[10px] flex items-center justify-center font-bold">
                  {idx + 1}
                </div>
              )}
              <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">{s.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Assigned Buyer & Logistics (1 col) */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-500" /> Hand-off & Buyer
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-neutral-400 block">Assigned Buyer:</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {pr.assigned_buyer_id ? "Assigned Procurement Officer" : "Procurement Queue (Auto-Routing)"}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Indent Notes:</span>
                <p className="text-neutral-700 dark:text-neutral-300 italic mt-0.5">
                  {pr.indent_notes || "No additional notes provided by indentor."}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-blue-500" /> Downstream Orders
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-neutral-400 block">Purchase Order:</span>
                {pr.po_number ? (
                  <Link href={`/purchase-orders/${pr.po_id || ""}`} className="text-blue-600 font-mono font-bold hover:underline">
                    {pr.po_number}
                  </Link>
                ) : (
                  <span className="text-neutral-400 italic">Not generated yet</span>
                )}
              </div>
              <div>
                <span className="text-neutral-400 block">Required By Date:</span>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {pr.required_by_date ? new Date(pr.required_by_date).toLocaleDateString("en-IN") : "Standard SLA"}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Type:</span>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">{pr.procurement_type}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Line items (2 cols) */}
        <div className="md:col-span-2">
          <Card className="p-5">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-amber-500" /> Requested Line Items ({pr.lines?.length ?? 0})
            </h3>
            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800 text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Item</th>
                    <th className="px-4 py-2.5 text-right font-medium text-neutral-500">Qty</th>
                    <th className="px-4 py-2.5 text-right font-medium text-neutral-500">Est. Price</th>
                    <th className="px-4 py-2.5 text-right font-medium text-neutral-500">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {pr.lines?.map((line, idx) => (
                    <tr key={line.id || idx}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-800 dark:text-neutral-200">
                          {line.item_description}
                        </div>
                        {line.item_code && (
                          <span className="text-xs font-mono text-neutral-400">{line.item_code}</span>
                        )}
                        {line.specifications && (
                          <div className="text-xs text-neutral-500 mt-0.5">{line.specifications}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{line.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono">₹{line.estimated_unit_price}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-neutral-900 dark:text-white">
                        ₹{(Number(line.quantity) * Number(line.estimated_unit_price)).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
