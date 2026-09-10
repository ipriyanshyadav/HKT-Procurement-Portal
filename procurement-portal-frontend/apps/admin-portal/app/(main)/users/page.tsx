"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  useUsers,
  useRoles,
  useCreateUser,
  useAssignRole,
  useRemoveRole,
  useToggleUserStatus,
  useUserSessions,
  useRevokeSession,
  useRevokeAllUserSessions,
  UserItem,
  UserSessionItem,
} from "@procurement/hooks";
import { PageHeader, HeroKPIStrip, Card, Badge, Button, Modal, Tabs } from "@procurement/ui";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Check,
  X,
  Search,
  Lock,
  Mail,
  UserCheck,
  Power,
  ChevronDown,
  ChevronUp,
  Key,
  Info,
  Laptop,
  Globe,
  Clock,
  UserX,
  RefreshCw,
  Copy,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";

export default function UsersManagementPage() {
  const [activeTab, setActiveTab] = useState<"users" | "sessions">("users");

  // Read ?tab=sessions from URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "sessions") {
        setActiveTab("sessions");
      }
    }
  }, []);

  const handleTabChange = (tab: "users" | "sessions") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  };

  // --- USERS STATE & HOOKS ---
  const { data: users, isLoading: isUsersLoading } = useUsers();
  const { data: roles, isLoading: isRolesLoading } = useRoles();

  const createUserMutation = useCreateUser();
  const assignRoleMutation = useAssignRole();
  const removeRoleMutation = useRemoveRole();
  const toggleStatusMutation = useToggleUserStatus();

  const [search, setSearch] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<UserItem | null>(null);
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [roleModalSearch, setRoleModalSearch] = useState("");

  // New User Form State
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("TempPass123!@#");
  const [newUserEmployeeId, setNewUserEmployeeId] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<string[]>(["REQUESTOR"]);
  const [createError, setCreateError] = useState<string | null>(null);

  const userList = useMemo(() => users || [], [users]);
  const roleList = useMemo(() => {
    const list = roles || [];
    const map = new Map<string, typeof list[0]>();
    for (const r of list) {
      if (!map.has(r.code)) {
        map.set(r.code, r);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [roles]);

  const filteredUsers = useMemo(() => {
    return userList.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase());
      const matchesRole =
        selectedRoleFilter === "ALL" || (u.roles && u.roles.includes(selectedRoleFilter));
      return matchesSearch && matchesRole;
    });
  }, [userList, search, selectedRoleFilter]);

  const activeUserCount = userList.filter((u) => u.status === "ACTIVE").length;
  const pendingUserCount = userList.filter((u) => u.status === "PENDING_ACTIVATION").length;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      await createUserMutation.mutateAsync({
        email: newUserEmail.trim(),
        first_name: newUserFirstName.trim(),
        last_name: newUserLastName.trim(),
        password: newUserPassword,
        employee_id: newUserEmployeeId.trim() || undefined,
        roles: newUserRoles,
      });
      setShowCreateModal(false);
      setNewUserEmail("");
      setNewUserFirstName("");
      setNewUserLastName("");
      setNewUserRoles(["REQUESTOR"]);
    } catch (err: any) {
      setCreateError(err?.response?.data?.error?.message || "Failed to create user");
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    const action = user.status === "ACTIVE" ? "deactivate" : "activate";
    try {
      await toggleStatusMutation.mutateAsync({ userId: user.id, action });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || `Failed to ${action} user`);
    }
  };

  // --- SESSIONS STATE & HOOKS ---
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionFilterMode, setSessionFilterMode] = useState<"ALL" | "ACTIVE_ONLY" | "REVOKED_ONLY">("ACTIVE_ONLY");
  const [copiedJti, setCopiedJti] = useState<string | null>(null);

  const [sessionToRevoke, setSessionToRevoke] = useState<UserSessionItem | null>(null);
  const [userToRevokeAll, setUserToRevokeAll] = useState<{ id: string; email: string; name: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState("Security administrative action");

  const {
    data: sessionsResponse,
    isLoading: isSessionsLoading,
    refetch: refetchSessions,
    isRefetching: isRefetchingSessions,
  } = useUserSessions({
    active_only: sessionFilterMode === "ACTIVE_ONLY",
    search: sessionSearch.trim() || undefined,
  });

  const revokeSessionMutation = useRevokeSession();
  const revokeAllMutation = useRevokeAllUserSessions();

  const sessions: UserSessionItem[] = useMemo(
    () => sessionsResponse?.data || [],
    [sessionsResponse?.data]
  );
  const sessionMeta = sessionsResponse?.meta;

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (sessionFilterMode === "REVOKED_ONLY") return s.is_revoked || !s.is_active;
      return true;
    });
  }, [sessions, sessionFilterMode]);

  const activeSessionsCount = sessions.filter((s) => s.is_active).length;
  const revokedSessionsCount = sessions.filter((s) => s.is_revoked).length;
  const uniqueUsersCount = new Set(sessions.map((s) => s.user_id)).size;

  const handleCopyJti = (jti: string) => {
    navigator.clipboard.writeText(jti);
    setCopiedJti(jti);
    setTimeout(() => setCopiedJti(null), 2000);
  };

  const handleConfirmRevokeSession = async () => {
    if (!sessionToRevoke) return;
    try {
      await revokeSessionMutation.mutateAsync({
        sessionId: sessionToRevoke.id,
        reason: revokeReason,
      });
      setSessionToRevoke(null);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to revoke session");
    }
  };

  const handleConfirmRevokeAll = async () => {
    if (!userToRevokeAll) return;
    try {
      await revokeAllMutation.mutateAsync({
        userId: userToRevokeAll.id,
        reason: revokeReason,
      });
      setUserToRevokeAll(null);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to revoke user sessions");
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <PageHeader
        title="Users & Sessions"
        subtitle="Manage enterprise user credentials, granular RBAC role assignments, and active authenticated device sessions."
        actions={
          activeTab === "users" ? (
            <Button
              variant="primary"
              className="flex items-center gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <UserPlus className="w-4 h-4" /> Add New User
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => refetchSessions()}
              disabled={isRefetchingSessions}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isRefetchingSessions ? "animate-spin" : ""}`} />}
            >
              Refresh Sessions
            </Button>
          )
        }
      />

      {/* Tabs Navigation Strip */}
      <Tabs
        tabs={[
          { id: "users", label: "User Accounts & Roles", icon: <Users className="w-4 h-4" />, count: userList.length },
          { id: "sessions", label: "Active Sessions & Security", icon: <Laptop className="w-4 h-4" />, count: activeSessionsCount },
        ]}
        activeTab={activeTab}
        onChange={(id) => handleTabChange(id as "users" | "sessions")}
        wide={true}
      />

      {/* === TAB 1: USER DIRECTORY & ROLES === */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <HeroKPIStrip
            items={[
              { value: userList.length, label: "Total Users", sublabel: "Registered portal accounts" },
              { value: activeUserCount, label: "Active Accounts", sublabel: "Full portal access" },
              { value: pendingUserCount, label: "Pending Activation", sublabel: "Awaiting first sign-in" },
              { value: roleList.length, label: "System Roles", sublabel: "RBAC authority groups" },
            ]}
          />

          {/* Filter and Search Bar */}
          <Card className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <span className="text-xs text-neutral-400 font-medium whitespace-nowrap mr-1">Role:</span>
              <button
                onClick={() => setSelectedRoleFilter("ALL")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  selectedRoleFilter === "ALL"
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
                }`}
              >
                All
              </button>
              {roleList.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoleFilter(r.code)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    selectedRoleFilter === r.code
                      ? "bg-blue-600 text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
                  }`}
                >
                  {r.code}
                </button>
              ))}
            </div>
          </Card>

          {/* Users Table */}
          <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">User Details</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Assigned Roles</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {isUsersLoading ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-neutral-400 text-sm">
                        Loading portal users...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-neutral-400 text-sm">
                        No users match the current search or filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const userRoles = user.roles || [];
                      const isSuperadmin = userRoles.includes("SUPERADMIN");

                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors"
                        >
                          {/* User info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                                {user.first_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                                  {user.first_name} {user.last_name}
                                </div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  <span>{user.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                user.status === "ACTIVE"
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                              }`}
                            >
                              {user.status}
                            </span>
                          </td>

                          {/* Roles Badges */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {userRoles.map((role) => (
                                <span
                                  key={role}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50"
                                >
                                  <Shield className="w-3 h-3 text-blue-500" />
                                  <span>{role}</span>
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setRoleModalUser(user);
                                  setExpandedRoleId(null);
                                  setRoleModalSearch("");
                                }}
                                className="flex items-center gap-1.5 text-xs h-7"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                                <span>Manage Roles</span>
                              </Button>

                              {!isSuperadmin && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleToggleStatus(user)}
                                  disabled={toggleStatusMutation.isPending}
                                  className={`text-xs h-7 ${
                                    user.status === "ACTIVE"
                                      ? "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                      : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                  }`}
                                  title={user.status === "ACTIVE" ? "Deactivate user" : "Activate user"}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* === TAB 2: ACTIVE SESSIONS & SECURITY === */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          <HeroKPIStrip
            items={[
              { value: sessionMeta?.total || sessions.length, label: "Total Sessions", sublabel: "Tracked session tokens" },
              { value: activeSessionsCount, label: "Active Sessions", sublabel: "Live authenticated tokens" },
              { value: revokedSessionsCount, label: "Revoked Sessions", sublabel: "Terminated by admin/logout" },
              { value: uniqueUsersCount, label: "Distinct Users", sublabel: "Unique user accounts" },
            ]}
          />

          {/* Search and Filters */}
          <Card className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Filter by user email, name, or IP address..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex w-full md:w-auto min-w-[380px] items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setSessionFilterMode("ALL")}
                className={`flex-1 min-w-[110px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap text-center justify-center flex items-center ${
                  sessionFilterMode === "ALL"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
                }`}
              >
                All Sessions ({sessions.length})
              </button>
              <button
                onClick={() => setSessionFilterMode("ACTIVE_ONLY")}
                className={`flex-1 min-w-[110px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap text-center justify-center flex items-center ${
                  sessionFilterMode === "ACTIVE_ONLY"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
                }`}
              >
                Active Only ({activeSessionsCount})
              </button>
              <button
                onClick={() => setSessionFilterMode("REVOKED_ONLY")}
                className={`flex-1 min-w-[110px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap text-center justify-center flex items-center ${
                  sessionFilterMode === "REVOKED_ONLY"
                    ? "bg-red-600 text-white shadow-sm"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
                }`}
              >
                Revoked / Expired ({revokedSessionsCount})
              </button>
            </div>
          </Card>

          {/* Sessions Table */}
          <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Client / Device IP</th>
                    <th className="py-3.5 px-4">Issued & Last Active</th>
                    <th className="py-3.5 px-4">Expiration</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Token JTI</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {isSessionsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-400 text-sm">
                        Loading active user sessions...
                      </td>
                    </tr>
                  ) : filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-400 text-sm">
                        No sessions match the current search or filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => {
                      const isExpired = session.expires_at ? new Date(session.expires_at) < new Date() : false;
                      const isActive = session.is_active && !session.is_revoked && !isExpired;
                      const isCopied = copiedJti === session.token_jti;

                      return (
                        <tr
                          key={session.id}
                          className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors"
                        >
                          {/* User Details */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
                              {session.user_name || "Unknown User"}
                            </div>
                            <div className="text-[11px] text-neutral-500 flex items-center gap-1 font-mono">
                              <Mail className="w-3 h-3 text-neutral-400" />
                              <span>{session.user_email || session.user_id}</span>
                            </div>
                          </td>

                          {/* Client / IP */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-neutral-800 dark:text-neutral-200">
                              <Globe className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                              <span>{session.ip_address || "127.0.0.1"}</span>
                            </div>
                            <div className="text-[11px] text-neutral-400 truncate max-w-xs flex items-center gap-1 mt-0.5">
                              <Laptop className="w-3.5 h-3.5 flex-shrink-0" />
                              <span title={session.user_agent || "Browser Session"}>
                                {session.user_agent ? session.user_agent.split(") ")[0] + ")" : "Browser Session"}
                              </span>
                            </div>
                          </td>

                          {/* Issued / Last Active */}
                          <td className="py-3.5 px-4 text-xs text-neutral-600 dark:text-neutral-400">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-neutral-400" />
                              <span>Created: {session.created_at ? new Date(session.created_at).toLocaleDateString() : "N/A"}</span>
                            </div>
                            <div className="text-[11px] text-neutral-400">
                              {session.created_at ? new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"}
                            </div>
                          </td>

                          {/* Expiration */}
                          <td className="py-3.5 px-4 text-xs">
                            <div className={isExpired ? "text-neutral-400 italic" : "text-neutral-700 dark:text-neutral-300 font-medium"}>
                              {session.expires_at ? new Date(session.expires_at).toLocaleDateString() : "N/A"}
                            </div>
                            <div className="text-[11px] text-neutral-400">
                              {session.expires_at ? new Date(session.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            ) : session.is_revoked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                                Revoked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                                Expired
                              </span>
                            )}
                          </td>

                          {/* JTI / Token */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 max-w-[100px] truncate">
                                {session.token_jti}
                              </span>
                              <button
                                onClick={() => handleCopyJti(session.token_jti)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                                title="Copy session token JTI"
                              >
                                {isCopied ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isActive && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setSessionToRevoke(session)}
                                  className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                >
                                  Revoke
                                </Button>
                              )}

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setUserToRevokeAll({
                                    id: session.user_id,
                                    email: session.user_email || session.user_id,
                                    name: session.user_name || "User",
                                  })
                                }
                                className="text-xs h-7 text-neutral-500 hover:text-red-600"
                                title="Revoke all sessions for this user"
                              >
                                Revoke All
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* === MODAL: MANAGE USER ROLES === */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-6 space-y-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Manage Roles & Authorizations
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Assigned permissions for <strong className="text-neutral-800 dark:text-neutral-200">{roleModalUser.email}</strong>
                </p>
              </div>
              <button
                onClick={() => setRoleModalUser(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Search Filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search roles by name or code..."
                value={roleModalSearch}
                onChange={(e) => setRoleModalSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Roles List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {roleList
                .filter((r) => {
                  const q = roleModalSearch.toLowerCase();
                  return (
                    r.code.toLowerCase().includes(q) ||
                    r.name.toLowerCase().includes(q) ||
                    (r.description && r.description.toLowerCase().includes(q))
                  );
                })
                .map((r) => {
                  const isAssigned = (roleModalUser.roles || []).includes(r.code);
                  const isExpanded = expandedRoleId === r.id;
                  const perms = r.permissions || [];
                  const permsCount = r.permissions_count ?? perms.length;

                  return (
                    <div
                      key={r.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isAssigned
                          ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/80 shadow-xs"
                          : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100">
                              {r.code}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              — {r.name}
                            </span>

                            {r.is_system_role && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                                System Role
                              </span>
                            )}
                            {r.is_supplier_role && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200">
                                Supplier Portal
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                            {r.description || "System authority role with bound permissions."}
                          </p>

                          <div className="pt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedRoleId(isExpanded ? null : r.id)}
                              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              <Key className="w-3 h-3" />
                              <span>
                                {permsCount} Permissions {isExpanded ? "▲" : "▼"}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Assign / Remove Button */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isAssigned ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={removeRoleMutation.isPending}
                              onClick={async () => {
                                await removeRoleMutation.mutateAsync({
                                  userId: roleModalUser.id,
                                  roleCode: r.code,
                                });
                                setRoleModalUser((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        roles: (prev.roles || []).filter((rc) => rc !== r.code),
                                      }
                                    : null
                                );
                              }}
                              className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              Remove Role
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={assignRoleMutation.isPending}
                              onClick={async () => {
                                await assignRoleMutation.mutateAsync({
                                  userId: roleModalUser.id,
                                  roleCode: r.code,
                                });
                                setRoleModalUser((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        roles: [...(prev.roles || []), r.code],
                                      }
                                    : null
                                );
                              }}
                              className="text-xs h-8"
                            >
                              Assign Role
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Permissions Chips */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-neutral-200/60 dark:border-neutral-800">
                          <span className="text-[11px] font-semibold text-neutral-400 block mb-2">
                            Bound Permissions Granted by {r.code}:
                          </span>
                          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                            {perms.length > 0 ? (
                              perms.map((p) => (
                                <span
                                  key={p}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
                                >
                                  {p}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-neutral-400 italic">
                                Dynamic system-wide permissions inherited.
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
              <Button variant="secondary" onClick={() => setRoleModalUser(null)}>
                Done
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* === MODAL: CREATE NEW USER === */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUser}
            className="max-w-xl w-full p-6 space-y-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Create New Portal User
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600">
                {createError}
              </div>
            )}

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserFirstName}
                    onChange={(e) => setNewUserFirstName(e.target.value)}
                    placeholder="e.g. John"
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserLastName}
                    onChange={(e) => setNewUserLastName(e.target.value)}
                    placeholder="e.g. Doe"
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. john.doe@procurement.com"
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Temporary Password *
                </label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Employee ID (Optional)
                </label>
                <input
                  type="text"
                  value={newUserEmployeeId}
                  onChange={(e) => setNewUserEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-9482"
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-2">
                  Initial Assigned Roles *
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                  {roleList.map((r) => {
                    const isChecked = newUserRoles.includes(r.code);
                    return (
                      <label
                        key={r.id}
                        className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUserRoles([...newUserRoles, r.code]);
                            } else {
                              setNewUserRoles(newUserRoles.filter((rc) => rc !== r.code));
                            }
                          }}
                          className="mt-0.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                            {r.code}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {r.description || r.name}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* === MODAL: REVOKE SINGLE SESSION === */}
      {sessionToRevoke && (
        <Modal
          isOpen={true}
          onClose={() => setSessionToRevoke(null)}
          title="Revoke User Session"
          description="Terminate this authenticated session. The user will be immediately logged out on that device."
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl space-y-1">
              <div className="text-xs font-bold text-red-800 dark:text-red-200 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Target Session
              </div>
              <div className="text-xs text-neutral-700 dark:text-neutral-300">
                User: <strong>{sessionToRevoke.user_email || sessionToRevoke.user_id}</strong>
              </div>
              <div className="text-xs text-neutral-500 font-mono">
                IP: {sessionToRevoke.ip_address || "Unknown"} • JTI: {sessionToRevoke.token_jti ? sessionToRevoke.token_jti.slice(0, 16) : "N/A"}...
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Revocation Audit Reason *
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Device reported lost, security policy enforcement"
                className="w-full px-3 py-2 text-xs border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="secondary" onClick={() => setSessionToRevoke(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={revokeSessionMutation.isPending}
                onClick={handleConfirmRevokeSession}
              >
                {revokeSessionMutation.isPending ? "Revoking..." : "Confirm Revoke"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* === MODAL: REVOKE ALL SESSIONS FOR USER === */}
      {userToRevokeAll && (
        <Modal
          isOpen={true}
          onClose={() => setUserToRevokeAll(null)}
          title="Force-Revoke All Sessions for User"
          description="Terminate every active token issued to this account across all browsers and devices."
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl space-y-1">
              <div className="text-xs font-bold text-red-800 dark:text-red-200 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Target User Account
              </div>
              <div className="text-xs text-neutral-800 dark:text-neutral-200 font-semibold">
                {userToRevokeAll.name} ({userToRevokeAll.email})
              </div>
              <div className="text-[11px] text-neutral-500">
                User ID: <span className="font-mono">{userToRevokeAll.id}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Revocation Audit Reason *
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Account compromise investigation"
                className="w-full px-3 py-2 text-xs border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="secondary" onClick={() => setUserToRevokeAll(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={revokeAllMutation.isPending}
                onClick={handleConfirmRevokeAll}
              >
                {revokeAllMutation.isPending ? "Revoking All..." : "Revoke All Sessions"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
