"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useUsers,
  useRoles,
  useAssignRole,
  useRemoveRole,
  useToggleUserStatus,
  useRevokeAllUserSessions,
  useOrgDelegationMatrix,
  useAppToast,
  UserItem,
} from "@procurement/hooks";
import { getErrorMessage } from "@procurement/utils";
import {
  Button,
  TableSkeleton,
} from "@procurement/ui";
import {
  Users,
  ArrowLeft,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sliders,
  Shield,
  KeyRound,
  UserCheck,
  UserX,
  AlertTriangle,
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  Activity,
} from "lucide-react";

export default function BuyerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const buyerId = params.id as string;
  const { toast } = useAppToast();

  const { data: users = [], isLoading, refetch } = useUsers();
  const { data: allRoles = [] } = useRoles();
  const { data: delegationMatrix = [] } = useOrgDelegationMatrix();

  const assignRoleMut = useAssignRole();
  const removeRoleMut = useRemoveRole();
  const toggleStatusMut = useToggleUserStatus();
  const revokeAllSessionsMut = useRevokeAllUserSessions();

  const buyer = useMemo(() => {
    return users.find((u) => u.id === buyerId);
  }, [users, buyerId]);

  // Find delegations where this buyer is delegator or delegate
  const buyerDelegations = useMemo(() => {
    return delegationMatrix.filter(
      (d) => String(d.delegator_id) === buyerId || String(d.delegate_id) === buyerId
    );
  }, [delegationMatrix, buyerId]);

  const handleRoleToggle = async (roleCode: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        await removeRoleMut.mutateAsync({ userId: buyerId, roleCode });
        toast.success(`Role ${roleCode} removed`);
      } else {
        await assignRoleMut.mutateAsync({ userId: buyerId, roleCode });
        toast.success(`Role ${roleCode} assigned`);
      }
      refetch();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update role assignment"));
    }
  };

  const handleToggleStatus = async () => {
    if (!buyer) return;
    const action = buyer.status === "ACTIVE" ? "deactivate" : "activate";
    try {
      await toggleStatusMut.mutateAsync({ userId: buyer.id, action });
      toast.success(`User set to ${action}d`);
      refetch();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, `Failed to ${action} user`));
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await revokeAllSessionsMut.mutateAsync({
        userId: buyerId,
        reason: "Administrative security revocation from Buyer Registry",
      });
      toast.success("All active sessions revoked for this buyer.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to revoke sessions"));
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="h-32 bg-neutral-100 dark:bg-[#1C1C1F] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-neutral-100 dark:bg-[#1C1C1F] rounded-2xl animate-pulse" />
          <div className="h-64 bg-neutral-100 dark:bg-[#1C1C1F] rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!buyer) {
    return (
      <div className="p-12 max-w-lg mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Buyer Record Not Found</h2>
        <p className="text-xs text-neutral-500">The requested buyer ID does not exist in this tenant.</p>
        <Link href="/buyers">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Return to Directory
          </Button>
        </Link>
      </div>
    );
  }

  const initials = `${buyer.first_name?.[0] || ""}${buyer.last_name?.[0] || ""}`.toUpperCase() || "B";
  const upperRoles = buyer.roles.map((r) => r.toUpperCase());

  const spendTier = upperRoles.includes("SUPERADMIN") || upperRoles.includes("PROCUREMENT_HEAD") || upperRoles.includes("FINANCE_CONTROLLER")
    ? { tier: "Tier 4", label: "Executive Unlimited", ceiling: "Unlimited Ceiling", color: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20" }
    : upperRoles.includes("PROCUREMENT_MANAGER") || upperRoles.includes("FINANCE_MANAGER")
    ? { tier: "Tier 3", label: "Up to ₹1,00,00,000", ceiling: "₹ 1,00,00,000 / Requisition", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20" }
    : upperRoles.includes("APPROVER") || upperRoles.includes("PROCUREMENT_OFFICER")
    ? { tier: "Tier 2", label: "Up to ₹25,00,000", ceiling: "₹ 25,00,000 / Purchase Order", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" }
    : upperRoles.includes("BUYER")
    ? { tier: "Tier 1", label: "Up to ₹5,00,000", ceiling: "₹ 5,00,000 / RFQ Award", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20" }
    : { tier: "Standard", label: "Standard Requisitioner", ceiling: "Catalogue Requisitions Only", color: "text-slate-600 dark:text-neutral-400 bg-slate-500/10 border-slate-500/20" };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumbs & Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/buyers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Buyer Registry
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRevokeAllSessions}
            leftIcon={<KeyRound className="w-3.5 h-3.5 text-neutral-500" />}
          >
            Revoke Sessions
          </Button>
          <Button
            size="sm"
            variant={buyer.status === "ACTIVE" ? "danger" : "primary"}
            onClick={handleToggleStatus}
            leftIcon={buyer.status === "ACTIVE" ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
          >
            {buyer.status === "ACTIVE" ? "Deactivate User" : "Activate User"}
          </Button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xl flex items-center justify-center border border-blue-500/20 shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
                {buyer.first_name} {buyer.last_name}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  buyer.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800"
                }`}
              >
                {buyer.status === "ACTIVE" ? <CheckCircle2 className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                {buyer.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                {buyer.email}
              </span>
              <span className="font-mono text-neutral-400 dark:text-neutral-500">
                ID: {buyer.id.slice(0, 13)}...
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-neutral-100 dark:border-neutral-800 pt-4 md:pt-0 md:pl-6 shrink-0">
          <div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Approval Limit Tier</span>
            <div className="mt-1">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${spendTier.color}`}>
                {spendTier.tier}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Spending Ceiling</span>
            <div className="text-sm font-bold text-neutral-900 dark:text-white font-mono mt-1">
              {spendTier.label}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Roles & Privileges */}
        <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Assigned Roles & Capabilities
              </h2>
            </div>
            <span className="text-xs text-neutral-500 font-mono">
              {buyer.roles.length} active roles
            </span>
          </div>

          <div className="space-y-2.5">
            {[
              { code: "BUYER", name: "Buyer", desc: "Purchase Order generation, Sourcing RFQ management, and vendor bidding" },
              { code: "PROCUREMENT_OFFICER", name: "Procurement Officer", desc: "Commercial evaluation, comparative statements, and award sign-offs" },
              { code: "APPROVER", name: "Approver (L1)", desc: "Line manager sign-off on PRs and approval workflow execution" },
              { code: "REQUESTOR", name: "Requestor", desc: "Browse catalog and submit purchase requests for business units" },
              { code: "PROCUREMENT_HEAD", name: "Procurement Head", desc: "Strategic sourcing oversight, executive bypass, and high-value approvals" },
              { code: "FINANCE_CONTROLLER", name: "Finance Controller", desc: "Financial ledger sign-off, invoice holds, and payment scheduling" },
              { code: "PROCUREMENT_MANAGER", name: "Procurement Manager", desc: "Departmental assignment, vendor SLA management, and approval rules" },
            ].map((role) => {
              const isAssigned = buyer.roles.includes(role.code);
              return (
                <div
                  key={role.code}
                  className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  <div className="space-y-0.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {role.name}
                      </span>
                      {isAssigned && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {role.desc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRoleToggle(role.code, isAssigned)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border shrink-0 transition-colors ${
                      isAssigned
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20"
                        : "bg-blue-600 text-white border-blue-600 hover:bg-blue-500"
                    }`}
                  >
                    {isAssigned ? "Revoke" : "Assign"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Delegations & Governance */}
        <div className="space-y-6">
          {/* Active Delegations Card */}
          <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Out-of-Office & Delegations
                </h2>
              </div>
              <span className="text-xs text-neutral-500 font-mono">
                {buyerDelegations.length} records
              </span>
            </div>

            {buyerDelegations.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-60" />
                No active delegation rules configured for this user. Approvals are routed directly to them.
              </div>
            ) : (
              <div className="space-y-3">
                {buyerDelegations.map((d) => {
                  const isDelegator = String(d.delegator_id) === buyerId;
                  return (
                    <div
                      key={d.id}
                      className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-900 dark:text-white">
                          {isDelegator ? "Delegating Approvals to:" : "Acting as Delegate for:"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            d.is_active
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                          }`}
                        >
                          {d.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-700 dark:text-neutral-300">
                        {d.delegate_name || d.delegate_email || String(d.delegate_id)}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono pt-1">
                        <span>
                          {new Date(d.valid_from).toLocaleDateString()} → {new Date(d.valid_until).toLocaleDateString()}
                        </span>
                        {d.max_amount_threshold && (
                          <span>Max: ₹{Number(d.max_amount_threshold).toLocaleString("en-IN")}</span>
                        )}
                      </div>
                      {d.reason && (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 italic">
                          &ldquo;{d.reason}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Spend Authority Card */}
          <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Spend Authorization Specifications
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400">Single Requisition Cap</span>
                <div className="font-bold text-neutral-900 dark:text-white font-mono mt-1">
                  {spendTier.ceiling}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400">Governance Tier</span>
                <div className="font-bold text-neutral-900 dark:text-white mt-1">
                  {spendTier.tier} ({spendTier.label})
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
