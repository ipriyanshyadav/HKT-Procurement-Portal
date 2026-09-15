"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useUsers,
  useRoles,
  useCreateUser,
  useAssignRole,
  useRemoveRole,
  useToggleUserStatus,
  useOrgDelegationMatrix,
  useAppToast,
  UserItem,
} from "@procurement/hooks";
import { getErrorMessage } from "@procurement/utils";
import {
  PageHeader,
  Button,
  TableSkeleton,
  EmptyState,
} from "@procurement/ui";
import {
  Users,
  Search,
  Plus,
  ArrowRight,
  AlertTriangle,
  Mail,
  Briefcase,
  CheckCircle2,
  Clock,
  Sliders,
  X,
  UserCheck,
  UserX,
} from "lucide-react";

export default function BuyerRegistryPage() {
  const { toast } = useAppToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [delegationFilter, setDelegationFilter] = useState("");

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isDelegationsModalOpen, setIsDelegationsModalOpen] = useState(false);
  const [selectedBuyerForRoles, setSelectedBuyerForRoles] = useState<UserItem | null>(null);

  // Form state for new buyer registration
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("Buyer123456!@#");
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newSelectedRoles, setNewSelectedRoles] = useState<string[]>(["BUYER", "PROCUREMENT_OFFICER"]);

  // Queries
  const { data: users = [], isLoading, isError, refetch } = useUsers();
  const { data: allRoles = [] } = useRoles();
  const { data: delegationMatrix = [] } = useOrgDelegationMatrix();

  // Mutations
  const createUserMut = useCreateUser();
  const assignRoleMut = useAssignRole();
  const removeRoleMut = useRemoveRole();
  const toggleStatusMut = useToggleUserStatus();

  // Map active delegations by delegator ID
  const activeDelegationsByDelegator = useMemo(() => {
    const map = new Map<string, { delegateName: string; validUntil: string; reason: string }>();
    const now = new Date();
    for (const rule of delegationMatrix) {
      if (rule.is_active && new Date(rule.valid_until) > now) {
        map.set(String(rule.delegator_id), {
          delegateName: rule.delegate_name || "Assigned Delegate",
          validUntil: new Date(rule.valid_until).toLocaleDateString(),
          reason: rule.reason,
        });
      }
    }
    return map;
  }, [delegationMatrix]);

  // Filter users to internal procurement staff (buyers, approvers, procurement officers, requestors, admins)
  const buyersList = useMemo(() => {
    return users.filter((u) => {
      const hasProcurementRole =
        u.roles.some((r) =>
          [
            "BUYER",
            "PROCUREMENT_OFFICER",
            "PROCUREMENT_HEAD",
            "PROCUREMENT_MANAGER",
            "PROCUREMENT_ADMIN",
            "APPROVER",
            "REQUESTOR",
            "FINANCE_CONTROLLER",
            "FINANCE_MANAGER",
            "ORG_ADMIN",
            "SUPERADMIN",
          ].includes(r.toUpperCase())
        ) || u.roles.length === 0;

      if (!hasProcurementRole) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
        const email = u.email.toLowerCase();
        const rolesStr = u.roles.join(" ").toLowerCase();
        if (!fullName.includes(q) && !email.includes(q) && !rolesStr.includes(q)) {
          return false;
        }
      }

      // Role filter
      if (roleFilter && !u.roles.map((r) => r.toUpperCase()).includes(roleFilter.toUpperCase())) {
        return false;
      }

      // Status filter
      if (statusFilter && u.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }

      // Delegation filter
      const isDelegated = activeDelegationsByDelegator.has(u.id);
      if (delegationFilter === "DELEGATED" && !isDelegated) return false;
      if (delegationFilter === "ACTIVE_SELF" && isDelegated) return false;

      return true;
    });
  }, [users, search, roleFilter, statusFilter, delegationFilter, activeDelegationsByDelegator]);

  // KPIs
  const kpis = useMemo(() => {
    const total = buyersList.length;
    const active = buyersList.filter((b) => b.status === "ACTIVE").length;
    const sourcingLeads = buyersList.filter((b) =>
      b.roles.some((r) => ["BUYER", "PROCUREMENT_OFFICER", "PROCUREMENT_HEAD"].includes(r.toUpperCase()))
    ).length;
    const delegatedCount = buyersList.filter((b) => activeDelegationsByDelegator.has(b.id)).length;
    return { total, active, sourcingLeads, delegatedCount };
  }, [buyersList, activeDelegationsByDelegator]);

  // Determine Approval / Spend Authority Limit based on role hierarchy
  const getSpendTier = (roles: string[]) => {
    const upperRoles = roles.map((r) => r.toUpperCase());
    if (upperRoles.includes("SUPERADMIN") || upperRoles.includes("PROCUREMENT_HEAD") || upperRoles.includes("FINANCE_CONTROLLER")) {
      return { tier: "Tier 4", label: "Executive Unlimited", color: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20" };
    }
    if (upperRoles.includes("PROCUREMENT_MANAGER") || upperRoles.includes("FINANCE_MANAGER")) {
      return { tier: "Tier 3", label: "Up to ₹1,00,00,000", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20" };
    }
    if (upperRoles.includes("APPROVER") || upperRoles.includes("PROCUREMENT_OFFICER")) {
      return { tier: "Tier 2", label: "Up to ₹25,00,000", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
    }
    if (upperRoles.includes("BUYER")) {
      return { tier: "Tier 1", label: "Up to ₹5,00,000", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20" };
    }
    return { tier: "Standard", label: "Standard Requisitioner", color: "text-slate-600 dark:text-neutral-400 bg-slate-500/10 border-slate-500/20" };
  };

  const handleRegisterBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim()) {
      toast.error("Please fill in all required name and corporate email fields.");
      return;
    }

    try {
      const created = await createUserMut.mutateAsync({
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        employee_id: newEmployeeId.trim() || undefined,
        roles: newSelectedRoles,
      });

      for (const roleCode of newSelectedRoles) {
        try {
          await assignRoleMut.mutateAsync({ userId: created.id, roleCode });
        } catch {
          // Continue if assigned during user creation
        }
      }

      toast.success(`Buyer ${newFirstName} ${newLastName} registered successfully.`);
      setIsRegisterModalOpen(false);
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
      setNewEmployeeId("");
      refetch();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to register buyer"));
    }
  };

  const handleRoleToggle = async (userId: string, roleCode: string, currentlyAssigned: boolean) => {
    try {
      if (currentlyAssigned) {
        await removeRoleMut.mutateAsync({ userId, roleCode });
        toast.success(`Role ${roleCode} removed`);
      } else {
        await assignRoleMut.mutateAsync({ userId, roleCode });
        toast.success(`Role ${roleCode} assigned`);
      }
      refetch();
      if (selectedBuyerForRoles) {
        setSelectedBuyerForRoles((prev) => {
          if (!prev) return null;
          const updatedRoles = currentlyAssigned
            ? prev.roles.filter((r) => r !== roleCode)
            : [...prev.roles, roleCode];
          return { ...prev, roles: updatedRoles };
        });
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update role assignment"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Buyer Registry & Procurement Directory"
        subtitle="Authorized corporate buyers, category managers, sourcing leads, approval limit tiers, and active delegation rules."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDelegationsModalOpen(true)}
              leftIcon={<Clock className="w-4 h-4 text-amber-500" />}
            >
              Delegation Matrix ({delegationMatrix.length})
            </Button>
            <Button
              size="sm"
              onClick={() => setIsRegisterModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Register Buyer
            </Button>
          </div>
        }
      />

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Total Authorized Buyers
            </span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2 font-mono">
            {kpis.total}
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Directory procurement staff</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Active & Certified
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {kpis.active}
          </div>
          <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Active spend authority</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Sourcing Specialists
            </span>
            <Briefcase className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2 font-mono">
            {kpis.sourcingLeads}
          </div>
          <span className="text-xs text-purple-600/80 dark:text-purple-400/80">RFQ & Sourcing leads</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Active Delegations
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {kpis.delegatedCount}
          </div>
          <span className="text-xs text-amber-600/80 dark:text-amber-400/80">Temporary out-of-office</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by buyer name, email, employee ID, role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl pl-9 pr-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
        >
          <option value="">All Procurement Roles</option>
          <option value="BUYER">Buyer</option>
          <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
          <option value="PROCUREMENT_HEAD">Procurement Head</option>
          <option value="APPROVER">Approver</option>
          <option value="FINANCE_CONTROLLER">Finance Controller</option>
          <option value="REQUESTOR">Requestor</option>
          <option value="ORG_ADMIN">Org Admin</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="LOCKED">Locked</option>
        </select>

        <select
          value={delegationFilter}
          onChange={(e) => setDelegationFilter(e.target.value)}
          className="text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
        >
          <option value="">All Delegation Modes</option>
          <option value="ACTIVE_SELF">Self-Acting (No Delegation)</option>
          <option value="DELEGATED">Currently Delegated</option>
        </select>
      </div>

      {/* Buyer Directory Table */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : isError ? (
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
            title="Failed to load buyer directory"
            description="Please check your network connection and try again."
          />
        ) : buyersList.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8 text-neutral-400" />}
            title="No buyers matching filter"
            description="Try adjusting your search criteria or register a new buyer."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-xs uppercase font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-6 py-3.5">Buyer Profile</th>
                  <th className="px-6 py-3.5">Assigned Roles</th>
                  <th className="px-6 py-3.5">Spend Authority Limit</th>
                  <th className="px-6 py-3.5">Delegation Status</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {buyersList.map((buyer) => {
                  const delegation = activeDelegationsByDelegator.get(buyer.id);
                  const spendTier = getSpendTier(buyer.roles);
                  const initials = `${buyer.first_name?.[0] || ""}${buyer.last_name?.[0] || ""}`.toUpperCase() || "B";

                  return (
                    <tr
                      key={buyer.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/20 shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/buyers/${buyer.id}`}
                              className="font-semibold text-neutral-900 dark:text-neutral-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline block truncate"
                            >
                              {buyer.first_name} {buyer.last_name}
                            </Link>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                              <Mail className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="truncate">{buyer.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {buyer.roles.length === 0 ? (
                            <span className="text-xs text-neutral-400 italic">No roles assigned</span>
                          ) : (
                            buyer.roles.map((role) => (
                              <span
                                key={role}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  role === "BUYER"
                                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                                    : role === "PROCUREMENT_OFFICER"
                                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800"
                                    : role === "APPROVER"
                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                                    : role === "PROCUREMENT_HEAD"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                                    : "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700"
                                }`}
                              >
                                {role}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${spendTier.color}`}>
                            {spendTier.tier}
                          </span>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                            {spendTier.label}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {delegation ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3" /> Delegated
                            </span>
                            <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                              To: <span className="font-semibold text-neutral-900 dark:text-neutral-200">{delegation.delegateName}</span>
                            </p>
                            <p className="text-[10px] text-neutral-400">Until {delegation.validUntil}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Self-Active
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            buyer.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800"
                          }`}
                        >
                          {buyer.status === "ACTIVE" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <UserX className="w-3 h-3" />
                          )}
                          {buyer.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedBuyerForRoles(buyer)}
                            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            title="Manage Roles"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <Link href={`/buyers/${buyer.id}`}>
                            <Button
                              variant="secondary"
                              size="sm"
                              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                            >
                              Profile
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Register New Buyer */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Register Procurement Buyer
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Onboard an authorized internal procurement specialist or approver.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterBuyer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. Vikram"
                    className="w-full text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="e.g. Seth"
                    className="w-full text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Corporate Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="v.seth@procurement.com"
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={newEmployeeId}
                    onChange={(e) => setNewEmployeeId(e.target.value)}
                    placeholder="EMP-2026-089"
                    className="w-full text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Initial Password
                  </label>
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Assign Procurement Roles
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { code: "BUYER", label: "Buyer (Sourcing & POs)" },
                    { code: "PROCUREMENT_OFFICER", label: "Procurement Officer" },
                    { code: "APPROVER", label: "Approver (L1/L2 Sign-off)" },
                    { code: "REQUESTOR", label: "Requestor (PR Creation)" },
                    { code: "PROCUREMENT_HEAD", label: "Procurement Head" },
                    { code: "FINANCE_CONTROLLER", label: "Finance Controller" },
                  ].map((role) => {
                    const isSelected = newSelectedRoles.includes(role.code);
                    return (
                      <button
                        key={role.code}
                        type="button"
                        onClick={() => {
                          setNewSelectedRoles((prev) =>
                            isSelected ? prev.filter((r) => r !== role.code) : [...prev, role.code]
                          );
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium border text-left transition-colors ${
                          isSelected
                            ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400"
                            : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-neutral-400 bg-white dark:bg-neutral-900"
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <span className="truncate">{role.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsRegisterModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={createUserMut.isPending}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Register Buyer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Manage Roles */}
      {selectedBuyerForRoles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Manage Roles: {selectedBuyerForRoles.first_name} {selectedBuyerForRoles.last_name}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {selectedBuyerForRoles.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBuyerForRoles(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {[
                { code: "BUYER", label: "Buyer", desc: "Access to POs, Sourcing, and Bidding workbench" },
                { code: "PROCUREMENT_OFFICER", label: "Procurement Officer", desc: "Commercial evaluation & PO awards" },
                { code: "APPROVER", label: "Approver", desc: "Sign-off authority on approval workflows" },
                { code: "REQUESTOR", label: "Requestor", desc: "Catalog browsing & PR draft submissions" },
                { code: "PROCUREMENT_HEAD", label: "Procurement Head", desc: "Executive sourcing approvals & thresholds" },
                { code: "FINANCE_CONTROLLER", label: "Finance Controller", desc: "Invoice approvals & payment sign-off" },
                { code: "PROCUREMENT_MANAGER", label: "Procurement Manager", desc: "Departmental oversight & vendor SLA" },
              ].map((r) => {
                const isAssigned = selectedBuyerForRoles.roles.includes(r.code);
                return (
                  <div
                    key={r.code}
                    className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {r.label}
                      </span>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{r.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRoleToggle(selectedBuyerForRoles.id, r.code, isAssigned)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                        isAssigned
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20"
                          : "bg-blue-600 text-white border-blue-600 hover:bg-blue-500"
                      }`}
                    >
                      {isAssigned ? "Remove" : "Assign"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedBuyerForRoles(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delegation Matrix */}
      {isDelegationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Organization Approval Delegation Matrix
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Active temporary sign-off delegations, validity windows, and SoD constraints.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDelegationsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {delegationMatrix.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  No active delegations registered across the corporate tenant.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="px-4 py-2.5">Delegator (Owner)</th>
                      <th className="px-4 py-2.5">Acting Delegate</th>
                      <th className="px-4 py-2.5">Validity Window</th>
                      <th className="px-4 py-2.5">Reason</th>
                      <th className="px-4 py-2.5">Max Threshold</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {delegationMatrix.map((rule) => (
                      <tr key={rule.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40">
                        <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                          {String(rule.delegator_id).slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                          {rule.delegate_name || rule.delegate_email || String(rule.delegate_id).slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-400">
                          {new Date(rule.valid_from).toLocaleDateString()} → {new Date(rule.valid_until).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                          {rule.reason}
                        </td>
                        <td className="px-4 py-3 font-mono text-neutral-700 dark:text-neutral-200">
                          {rule.max_amount_threshold
                            ? `₹ ${Number(rule.max_amount_threshold).toLocaleString("en-IN")}`
                            : "No Limit"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              rule.is_active
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                            }`}
                          >
                            {rule.is_active ? "ACTIVE" : "EXPIRED"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsDelegationsModalOpen(false)}
              >
                Close Matrix
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
