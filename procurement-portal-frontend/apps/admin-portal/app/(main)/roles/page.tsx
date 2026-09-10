"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  usePermissions,
  useRolePermissionsMatrix,
  useToggleRolePermission,
  RoleItem,
} from "@procurement/hooks";
import { PageHeader, HeroKPIStrip, Card, Badge, Button, Tabs } from "@procurement/ui";
import {
  Shield,
  ShieldCheck,
  Plus,
  Search,
  Grid,
  Key,
  X,
  Edit2,
  Lock,
  RefreshCw,
  Check,
} from "lucide-react";

export default function RolesManagementPage() {
  const [activeTab, setActiveTab] = useState<"roles" | "matrix">("roles");

  // Read ?tab=matrix from URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "matrix") {
        setActiveTab("matrix");
      }
    }
  }, []);

  const handleTabChange = (tab: "roles" | "matrix") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  };

  // --- ROLES DIRECTORY STATE & HOOKS ---
  const { data: roles, isLoading: isRolesLoading } = useRoles();
  const { data: permissionsCatalog } = usePermissions();

  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "SYSTEM" | "SUPPLIER" | "CUSTOM">("ALL");

  const [inspectRole, setInspectRole] = useState<RoleItem | null>(null);
  const [editRole, setEditRole] = useState<RoleItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsSupplier, setNewIsSupplier] = useState(false);
  const [newSelectedPerms, setNewSelectedPerms] = useState<string[]>([]);
  const [permSearch, setPermSearch] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const roleList = useMemo(() => {
    const list = roles || [];
    const map = new Map<string, RoleItem>();
    for (const r of list) {
      if (!map.has(r.code)) {
        map.set(r.code, r);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [roles]);
  const allPermissions = useMemo(() => permissionsCatalog || [], [permissionsCatalog]);

  const filteredRoles = useMemo(() => {
    return roleList.filter((r) => {
      const matchesSearch =
        r.code.toLowerCase().includes(search.toLowerCase()) ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(search.toLowerCase()));

      const matchesType =
        filterType === "ALL" ||
        (filterType === "SYSTEM" && r.is_system_role) ||
        (filterType === "SUPPLIER" && r.is_supplier_role) ||
        (filterType === "CUSTOM" && !r.is_system_role && !r.is_supplier_role);

      return matchesSearch && matchesType;
    });
  }, [roleList, search, filterType]);

  const systemCount = roleList.filter((r) => r.is_system_role).length;
  const supplierCount = roleList.filter((r) => r.is_supplier_role).length;
  const customCount = roleList.filter((r) => !r.is_system_role && !r.is_supplier_role).length;

  const handleOpenEdit = (role: RoleItem) => {
    setEditRole(role);
    setEditName(role.name);
    setEditDescription(role.description || "");
    setEditActive(role.is_active !== false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRole) return;
    try {
      await updateRoleMutation.mutateAsync({
        roleId: editRole.id,
        payload: {
          name: editName.trim(),
          description: editDescription.trim(),
          is_active: editActive,
        },
      });
      setEditRole(null);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to update role");
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      await createRoleMutation.mutateAsync({
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        description: newDescription.trim(),
        is_supplier_role: newIsSupplier,
        permission_codes: newSelectedPerms,
      });
      setShowCreateModal(false);
      setNewCode("");
      setNewName("");
      setNewDescription("");
      setNewIsSupplier(false);
      setNewSelectedPerms([]);
    } catch (err: any) {
      setCreateError(err?.response?.data?.error?.message || "Failed to create role");
    }
  };

  // --- PERMISSION MATRIX STATE & HOOKS ---
  const {
    data: matrixData,
    isLoading: isMatrixLoading,
    refetch: refetchMatrix,
    isRefetching: isRefetchingMatrix,
  } = useRolePermissionsMatrix();
  const toggleMutation = useToggleRolePermission();

  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixSelectedModule, setMatrixSelectedModule] = useState("ALL");
  const [matrixRoleScopeFilter, setMatrixRoleScopeFilter] = useState<"ALL" | "SYSTEM" | "SUPPLIER" | "CUSTOM">("ALL");

  const matrixRoles = useMemo(() => {
    const list = matrixData?.roles || [];
    const map = new Map<string, typeof list[0]>();
    for (const r of list) {
      if (!map.has(r.code)) {
        map.set(r.code, r);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [matrixData?.roles]);

  const matrixPermissions = useMemo(() => {
    const list = matrixData?.permissions || [];
    const map = new Map<string, typeof list[0]>();
    for (const p of list) {
      if (!map.has(p.code)) {
        map.set(p.code, p);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [matrixData?.permissions]);

  const matrix = useMemo(() => {
    const raw = matrixData?.matrix || {};
    const deduped: Record<string, string[]> = {};
    for (const [rCode, perms] of Object.entries(raw)) {
      deduped[rCode] = Array.from(new Set(perms));
    }
    return deduped;
  }, [matrixData?.matrix]);

  const matrixModules = useMemo(() => {
    return Array.from(new Set(matrixPermissions.map((p) => p.module.toUpperCase()))).sort();
  }, [matrixPermissions]);

  const filteredMatrixRoles = useMemo(() => {
    return matrixRoles.filter((r) => {
      if (matrixRoleScopeFilter === "SYSTEM") return r.is_system_role;
      if (matrixRoleScopeFilter === "SUPPLIER") return r.is_supplier_role;
      if (matrixRoleScopeFilter === "CUSTOM") return !r.is_system_role && !r.is_supplier_role;
      return true;
    });
  }, [matrixRoles, matrixRoleScopeFilter]);

  const filteredMatrixPermissions = useMemo(() => {
    return matrixPermissions.filter((p) => {
      const matchesSearch =
        p.code.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        p.name.toLowerCase().includes(matrixSearch.toLowerCase());
      const matchesModule =
        matrixSelectedModule === "ALL" || p.module.toUpperCase() === matrixSelectedModule;
      return matchesSearch && matchesModule;
    });
  }, [matrixPermissions, matrixSearch, matrixSelectedModule]);

  const totalAssignmentsCount = useMemo(() => {
    let count = 0;
    Object.values(matrix).forEach((perms) => {
      count += perms.length;
    });
    return count;
  }, [matrix]);

  const handleToggle = async (roleCode: string, permissionCode: string, currentlyGranted: boolean) => {
    try {
      await toggleMutation.mutateAsync({
        role_code: roleCode,
        permission_code: permissionCode,
        granted: !currentlyGranted,
      });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to update permission");
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Roles & RBAC Privileges"
        subtitle="Manage enterprise roles, define custom privilege profiles, and inspect or toggle authorizations in the real-time permission matrix."
        actions={
          activeTab === "roles" ? (
            <Button
              variant="primary"
              className="flex items-center gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" /> Create Custom Role
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => refetchMatrix()}
              disabled={isRefetchingMatrix}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetchingMatrix ? "animate-spin" : ""}`} /> Refresh Matrix
            </Button>
          )
        }
      />

      {/* Tabs Navigation Strip */}
      <Tabs
        tabs={[
          { id: "roles", label: "Roles Directory", icon: <Shield className="w-4 h-4" />, count: roleList.length },
          { id: "matrix", label: "Permission Matrix", icon: <Grid className="w-4 h-4" />, count: totalAssignmentsCount },
        ]}
        activeTab={activeTab}
        onChange={(id) => handleTabChange(id as "roles" | "matrix")}
        wide={true}
      />

      {activeTab === "roles" && (
        <div className="space-y-6">
          <HeroKPIStrip
            items={[
              { value: roleList.length, label: "Total Roles", sublabel: "RBAC privilege sets" },
              { value: systemCount, label: "System Roles", sublabel: "Core platform built-ins" },
              { value: supplierCount, label: "Supplier Roles", sublabel: "Vendor portal scopes" },
              { value: customCount, label: "Custom Roles", sublabel: "Organization defined" },
            ]}
          />

          <Card className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search roles by code, name, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex w-full md:w-auto min-w-[380px] items-center gap-1.5 overflow-x-auto">
              {(["ALL", "SYSTEM", "SUPPLIER", "CUSTOM"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`flex-1 min-w-[90px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap text-center justify-center flex items-center ${
                    filterType === type
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
                  }`}
                >
                  {type === "ALL" ? `All (${roleList.length})` : type === "SYSTEM" ? `System (${systemCount})` : type === "SUPPLIER" ? `Supplier (${supplierCount})` : `Custom (${customCount})`}
                </button>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Role Code</th>
                    <th className="py-3.5 px-4">Role Name</th>
                    <th className="py-3.5 px-4">Type & Scope</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Bound Permissions</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {isRolesLoading ? (
                    <tr><td colSpan={6} className="py-12 text-center text-neutral-400 text-sm">Loading system roles...</td></tr>
                  ) : filteredRoles.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-neutral-400 text-sm">No roles match the current search or filters.</td></tr>
                  ) : (
                    filteredRoles.map((role) => {
                      const permsCount = role.permissions_count ?? role.permissions?.length ?? 0;
                      return (
                        <tr key={role.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                          <td className="py-3.5 px-4"><div className="flex items-center gap-2"><Shield className="w-4 h-4 text-blue-500" /><span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100">{role.code}</span></div></td>
                          <td className="py-3.5 px-4 font-semibold text-neutral-900 dark:text-neutral-100 text-xs">{role.name}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {role.is_system_role && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200">SYSTEM</span>}
                              {role.is_supplier_role && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200">SUPPLIER</span>}
                              {!role.is_system_role && !role.is_supplier_role && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200">CUSTOM</span>}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 max-w-sm"><p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">{role.description || "System authority role."}</p></td>
                          <td className="py-3.5 px-4"><button onClick={() => setInspectRole(role)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Key className="w-3 h-3 text-blue-500" /><span>{permsCount} Granted</span></button></td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="secondary" size="sm" onClick={() => setInspectRole(role)} className="text-xs h-7 px-2">View</Button>
                              {!role.is_system_role && <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(role)} className="text-xs h-7 px-2"><Edit2 className="w-3.5 h-3.5 text-neutral-500" /></Button>}
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

      {activeTab === "matrix" && (
        <div className="space-y-6">
          <HeroKPIStrip
            items={[
              { value: filteredMatrixRoles.length, label: "Roles in View", sublabel: "RBAC authority groups" },
              { value: matrixPermissions.length, label: "Defined Permissions", sublabel: "Atomic access policies" },
              { value: totalAssignmentsCount, label: "Role-Permission Grants", sublabel: "Active mapping cells" },
              { value: matrixModules.length, label: "Functional Modules", sublabel: "Platform boundaries" },
            ]}
          />

          <Card className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search permissions in matrix..."
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto min-w-[320px]">
                <span className="text-xs text-neutral-400 font-medium shrink-0">Scope:</span>
                {(["ALL", "SYSTEM", "SUPPLIER", "CUSTOM"] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setMatrixRoleScopeFilter(scope)}
                    className={`flex-1 min-w-[70px] px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap text-center justify-center flex items-center ${matrixRoleScopeFilter === scope ? "bg-blue-600 text-white shadow-sm" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"}`}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
              <span className="text-xs text-neutral-400 font-medium">Module:</span>
              <button
                onClick={() => setMatrixSelectedModule("ALL")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${matrixSelectedModule === "ALL" ? "bg-blue-600 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"}`}
              >
                All Modules
              </button>
              {matrixModules.map((m) => (
                <button
                  key={m}
                  onClick={() => setMatrixSelectedModule(m)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${matrixSelectedModule === m ? "bg-blue-600 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-100 dark:bg-neutral-900 sticky top-0 z-20">
                  <tr>
                    <th className="py-3 px-4 font-bold text-neutral-700 dark:text-neutral-300 sticky left-0 z-30 bg-neutral-100 dark:bg-neutral-900 border-r border-b border-neutral-200 dark:border-neutral-800 min-w-[240px]">Permission / Policy</th>
                    {filteredMatrixRoles.map((role) => (
                      <th key={role.id} className="py-3 px-3 font-mono font-bold text-center border-b border-neutral-200 dark:border-neutral-800 min-w-[110px]">
                        <div className="flex flex-col items-center"><span className="text-neutral-900 dark:text-neutral-100">{role.code}</span></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {isMatrixLoading ? (
                    <tr><td colSpan={filteredMatrixRoles.length + 1} className="py-16 text-center text-neutral-400">Loading RBAC Matrix...</td></tr>
                  ) : filteredMatrixPermissions.length === 0 ? (
                    <tr><td colSpan={filteredMatrixRoles.length + 1} className="py-16 text-center text-neutral-400">No permissions found.</td></tr>
                  ) : (
                    filteredMatrixPermissions.map((perm) => (
                      <tr key={perm.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/70 transition-colors group">
                        <td className="py-2.5 px-4 sticky left-0 z-10 bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800">
                          <div className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{perm.code}</div>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5"><span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold">{perm.module}</span><span>{perm.name}</span></div>
                        </td>
                        {filteredMatrixRoles.map((role) => {
                          const isGranted = (matrix[role.code] || []).includes(perm.code);
                          return (
                            <td key={role.id} className="py-2.5 px-3 text-center align-middle hover:bg-blue-50/50 transition-colors">
                              <button type="button" onClick={() => handleToggle(role.code, perm.code, isGranted)} disabled={toggleMutation.isPending} className={`w-5 h-5 rounded flex items-center justify-center mx-auto ${isGranted ? "bg-blue-600 text-white" : "border border-neutral-300 dark:border-neutral-700"}`}>
                                {isGranted && <Check className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* === MODAL: INSPECT ROLE PERMISSIONS === */}
      {inspectRole && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-6 space-y-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  Role Details: {inspectRole.code}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {inspectRole.name} • {inspectRole.permissions?.length || inspectRole.permissions_count || 0} Bound Permissions
                </p>
              </div>
              <button
                onClick={() => setInspectRole(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl text-xs text-neutral-600 dark:text-neutral-300">
              {inspectRole.description || "No description provided for this role."}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Granted System Permissions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {inspectRole.permissions && inspectRole.permissions.length > 0 ? (
                  inspectRole.permissions.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1 font-mono text-xs px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50"
                    >
                      <Key className="w-3 h-3 text-blue-500" />
                      {p}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-neutral-400 italic">
                    Dynamic or superadmin permissions assigned.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <Button
                variant="secondary"
                onClick={() => {
                  setInspectRole(null);
                  handleTabChange("matrix");
                }}
              >
                Open in Permission Matrix
              </Button>
              <Button variant="secondary" onClick={() => setInspectRole(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* === MODAL: EDIT ROLE === */}
      {editRole && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="max-w-md w-full p-6 space-y-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                Edit Role: {editRole.code}
              </h3>
              <button
                type="button"
                onClick={() => setEditRole(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Role Name *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editActive"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="editActive" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Active Role
              </label>
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditRole(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={updateRoleMutation.isPending}>
                {updateRoleMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* === MODAL: CREATE CUSTOM ROLE === */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRole}
            className="max-w-xl w-full p-6 space-y-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Create Custom Role
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
              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Role Code * (e.g. INVENTORY_CLERK)
                </label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="CUSTOM_ROLE_CODE"
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Role Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Warehouse Inventory Supervisor"
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe the operational responsibilities of this custom role..."
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="newIsSupplier"
                  checked={newIsSupplier}
                  onChange={(e) => setNewIsSupplier(e.target.checked)}
                  className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="newIsSupplier" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Assign to Supplier Portal scope (External Vendor)
                </label>
              </div>

              {/* Permission Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Grant Initial Permissions ({newSelectedPerms.length} selected)
                  </label>
                  <input
                    type="text"
                    placeholder="Filter permissions..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    className="px-2 py-1 text-[11px] border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900"
                  />
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                  {allPermissions
                    .filter((p) => {
                      const q = permSearch.toLowerCase();
                      return (
                        p.code.toLowerCase().includes(q) ||
                        p.name.toLowerCase().includes(q) ||
                        p.module.toLowerCase().includes(q)
                      );
                    })
                    .map((p) => {
                      const isChecked = newSelectedPerms.includes(p.code);
                      return (
                        <label
                          key={p.id}
                          className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewSelectedPerms([...newSelectedPerms, p.code]);
                              } else {
                                setNewSelectedPerms(newSelectedPerms.filter((code) => code !== p.code));
                              }
                            }}
                            className="mt-0.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-mono font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                              <span>{p.code}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 font-sans text-neutral-500">
                                {p.module}
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-500">{p.name}</div>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={createRoleMutation.isPending}>
                {createRoleMutation.isPending ? "Creating..." : "Create Role"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
