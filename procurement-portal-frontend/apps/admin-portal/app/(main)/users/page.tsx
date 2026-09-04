"use client";

import React, { useState } from "react";
import {
  useUsers,
  useRoles,
  useCreateUser,
  useAssignRole,
  useRemoveRole,
  useToggleUserStatus,
  UserItem,
} from "@procurement/hooks";
import { PageHeader, HeroKPIStrip, Card, Badge, Button } from "@procurement/ui";
import { Users, UserPlus, Shield, ShieldCheck, Check, X, Search, Lock, Mail, UserCheck, Power } from "lucide-react";

export default function UsersManagementPage() {
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

  // New User Form State
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("TempPass123!@#");
  const [newUserEmployeeId, setNewUserEmployeeId] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<string[]>(["REQUESTOR"]);
  const [createError, setCreateError] = useState<string | null>(null);

  const userList = users || [];
  const roleList = roles || [];

  const filteredUsers = userList.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase());
    const matchesRole =
      selectedRoleFilter === "ALL" || (u.roles && u.roles.includes(selectedRoleFilter));
    return matchesSearch && matchesRole;
  });

  const activeCount = userList.filter((u) => u.status === "ACTIVE").length;
  const pendingCount = userList.filter((u) => u.status === "PENDING_ACTIVATION").length;

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

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Users & Role Assignments"
        subtitle="Manage enterprise users, access credentials, and granular RBAC role authorizations."
        actions={
          <Button
            variant="primary"
            className="flex items-center gap-2"
            onClick={() => setShowCreateModal(true)}
          >
            <UserPlus className="w-4 h-4" /> Add New User
          </Button>
        }
      />

      <HeroKPIStrip
        items={[
          { value: userList.length, label: "Total Accounts", sublabel: "Organization scope" },
          { value: activeCount, label: "Active Users", sublabel: "Verified & operational" },
          { value: pendingCount, label: "Pending Activation", sublabel: "Awaiting first login" },
          { value: roleList.length, label: "Defined Roles", sublabel: "RBAC privilege sets" },
        ]}
      />

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <span className="text-xs text-neutral-400 font-medium whitespace-nowrap">Filter Role:</span>
          <button
            onClick={() => setSelectedRoleFilter("ALL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedRoleFilter === "ALL"
                ? "bg-blue-600 text-white"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
            }`}
          >
            All Roles
          </button>
          {roleList.map((r) => (
            <button
              key={r.code}
              onClick={() => setSelectedRoleFilter(r.code)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
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
      <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Assigned Roles</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {isUsersLoading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-neutral-400 text-sm">
                    Loading users directory...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-neutral-400 text-sm">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const initials = `${user.first_name[0] || ""}${user.last_name[0] || ""}`.toUpperCase() || "U";
                  return (
                    <tr key={user.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-xs text-neutral-500 flex items-center gap-1">
                              <Mail className="w-3 h-3 text-neutral-400" /> {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {user.roles && user.roles.length > 0 ? (
                            user.roles.map((r) => (
                              <span
                                key={r}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
                              >
                                <Shield className="w-3 h-3 text-blue-500" />
                                {r}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-neutral-400 italic">No roles assigned</span>
                          )}
                          <button
                            onClick={() => setRoleModalUser(user)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-1 font-medium"
                          >
                            + Manage
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <Badge
                          variant={
                            user.status === "ACTIVE"
                              ? "approved"
                              : user.status === "PENDING_ACTIVATION"
                              ? "pending"
                              : "rejected"
                          }
                        >
                          {user.status}
                        </Badge>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(user)}
                            disabled={toggleStatusMutation.isPending}
                            icon={<Power className="w-3.5 h-3.5" />}
                          >
                            {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRoleModalUser(user)}
                            icon={<Shield className="w-3.5 h-3.5" />}
                          >
                            Roles
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

      {/* Manage Roles Modal */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-lg">
                  Manage User Roles
                </h3>
                <p className="text-xs text-neutral-500">
                  {roleModalUser.first_name} {roleModalUser.last_name} ({roleModalUser.email})
                </p>
              </div>
              <button
                onClick={() => setRoleModalUser(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pt-2">
              {roleList.map((r) => {
                const isAssigned = roleModalUser.roles && roleModalUser.roles.includes(r.code);
                return (
                  <div
                    key={r.code}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-blue-500" />
                        {r.code}
                      </div>
                      <div className="text-xs text-neutral-500">{r.name}</div>
                    </div>

                    {isAssigned ? (
                      <button
                        onClick={async () => {
                          await removeRoleMutation.mutateAsync({
                            userId: roleModalUser.id,
                            roleCode: r.code,
                          });
                          setRoleModalUser((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  roles: prev.roles.filter((c) => c !== r.code),
                                }
                              : null
                          );
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 transition-colors"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          await assignRoleMutation.mutateAsync({
                            userId: roleModalUser.id,
                            roleCode: r.code,
                          });
                          setRoleModalUser((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  roles: [...prev.roles, r.code],
                                }
                              : null
                          );
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 transition-colors"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setRoleModalUser(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUser}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" /> Create New Enterprise User
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-600 dark:text-red-400">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={newUserFirstName}
                  onChange={(e) => setNewUserFirstName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jane"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={newUserLastName}
                  onChange={(e) => setNewUserLastName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                Corporate Email Address *
              </label>
              <input
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="jane.doe@enterprise.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Temporary Password *
                </label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Employee ID (Optional)
                </label>
                <input
                  type="text"
                  value={newUserEmployeeId}
                  onChange={(e) => setNewUserEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="EMP-9021"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5">
                Assign Initial Roles
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
                {roleList.map((r) => {
                  const isChecked = newUserRoles.includes(r.code);
                  return (
                    <label
                      key={r.code}
                      className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUserRoles((prev) => [...prev, r.code]);
                          } else {
                            setNewUserRoles((prev) => prev.filter((c) => c !== r.code));
                          }
                        }}
                        className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{r.code}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-800">
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
    </div>
  );
}
