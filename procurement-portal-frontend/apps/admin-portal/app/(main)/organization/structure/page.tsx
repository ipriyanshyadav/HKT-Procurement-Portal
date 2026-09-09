"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useBusinessUnits,
  useCreateBusinessUnit,
  useUpdateBusinessUnit,
  useDeleteBusinessUnit,
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useCostCenters,
  useCreateCostCenter,
  useUpdateCostCenter,
  useDeleteCostCenter,
  useLegalEntities,
  type BusinessUnitResponse,
  type DepartmentResponse,
  type CostCenterResponse,
} from "@procurement/hooks";
import { Badge, Button, Tabs, type TabOption } from "@procurement/ui";
import {
  Layers,
  Network,
  Wallet,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Building2,
  User,
  IndianRupee,
  TrendingUp,
} from "lucide-react";

function OperatingStructureContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams?.get("tab") || "business-units";
  const [activeTab, setActiveTab] = useState<string>(
    ["business-units", "departments", "cost-centers"].includes(initialTab)
      ? initialTab
      : "business-units"
  );

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    router.replace(`/organization/structure?tab=${newTab}`);
  };

  // Queries
  const { data: businessUnits = [], isLoading: buLoading } = useBusinessUnits({ active_only: false });
  const { data: departments = [], isLoading: deptLoading } = useDepartments({ active_only: false });
  const { data: costCenters = [], isLoading: ccLoading } = useCostCenters({ active_only: false });
  const { data: legalEntities = [] } = useLegalEntities();

  // Default legal entity id for automated creation
  const defaultLegalEntityId = useMemo(() => {
    return legalEntities.length > 0 ? legalEntities[0].id : "099d6a8f-88e4-4091-a5ed-7b61fb819c8b";
  }, [legalEntities]);

  // Lookup map for Business Unit Name
  const buMap = useMemo(() => {
    const map = new Map<string, string>();
    businessUnits.forEach((bu) => map.set(bu.id, bu.name));
    return map;
  }, [businessUnits]);

  // ==========================================================================
  // Tab 1: Business Units State & Actions
  // ==========================================================================
  const createBuMutation = useCreateBusinessUnit();
  const updateBuMutation = useUpdateBusinessUnit();
  const deleteBuMutation = useDeleteBusinessUnit();

  const [buSearch, setBuSearch] = useState("");
  const [showBuModal, setShowBuModal] = useState(false);
  const [editingBu, setEditingBu] = useState<BusinessUnitResponse | null>(null);
  const [buCode, setBuCode] = useState("");
  const [buName, setBuName] = useState("");
  const [buErpCode, setBuErpCode] = useState("");
  const [buCurrency, setBuCurrency] = useState("INR");
  const [buIsActive, setBuIsActive] = useState(true);
  const [buFormError, setBuFormError] = useState<string | null>(null);

  const filteredBUs = useMemo(() => {
    return businessUnits.filter(
      (b) =>
        (b.name || "").toLowerCase().includes(buSearch.toLowerCase()) ||
        (b.code || "").toLowerCase().includes(buSearch.toLowerCase()) ||
        (b.erp_company_code || "").toLowerCase().includes(buSearch.toLowerCase())
    );
  }, [businessUnits, buSearch]);

  const openCreateBuModal = () => {
    setEditingBu(null);
    setBuCode("");
    setBuName("");
    setBuErpCode("");
    setBuCurrency("INR");
    setBuIsActive(true);
    setBuFormError(null);
    setShowBuModal(true);
  };

  const openEditBuModal = (item: BusinessUnitResponse) => {
    setEditingBu(item);
    setBuCode(item.code);
    setBuName(item.name);
    setBuErpCode(item.erp_company_code || "");
    setBuCurrency(item.default_currency || "INR");
    setBuIsActive(item.is_active);
    setBuFormError(null);
    setShowBuModal(true);
  };

  const handleSaveBu = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuFormError(null);
    if (!editingBu && !buCode.trim()) {
      setBuFormError("Business unit code is required.");
      return;
    }
    if (!buName.trim()) {
      setBuFormError("Business unit name is required.");
      return;
    }

    try {
      if (editingBu) {
        await updateBuMutation.mutateAsync({
          id: editingBu.id,
          payload: {
            name: buName.trim(),
            erp_company_code: buErpCode.trim() || null,
            default_currency: buCurrency.trim().toUpperCase(),
            is_active: buIsActive,
          },
        });
      } else {
        await createBuMutation.mutateAsync({
          code: buCode.trim().toUpperCase(),
          name: buName.trim(),
          legal_entity_id: defaultLegalEntityId,
          erp_company_code: buErpCode.trim() || null,
          default_currency: buCurrency.trim().toUpperCase(),
          is_active: buIsActive,
        });
      }
      setShowBuModal(false);
    } catch (err: any) {
      setBuFormError(err?.response?.data?.message || err?.message || "Failed to save business unit");
    }
  };

  const handleDeleteBu = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to deactivate or delete business unit "${name}"?`)) return;
    try {
      await deleteBuMutation.mutateAsync(id);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to delete business unit");
    }
  };

  // ==========================================================================
  // Tab 2: Departments State & Actions
  // ==========================================================================
  const createDeptMutation = useCreateDepartment();
  const updateDeptMutation = useUpdateDepartment();
  const deleteDeptMutation = useDeleteDepartment();

  const [deptSearch, setDeptSearch] = useState("");
  const [deptBuFilter, setDeptBuFilter] = useState("ALL");
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentResponse | null>(null);
  const [deptCode, setDeptCode] = useState("");
  const [deptName, setDeptName] = useState("");
  const [deptBuId, setDeptBuId] = useState("");
  const [deptHeadId, setDeptHeadId] = useState("");
  const [deptIsActive, setDeptIsActive] = useState(true);
  const [deptFormError, setDeptFormError] = useState<string | null>(null);

  const filteredDepts = useMemo(() => {
    return departments.filter((d) => {
      const matchesSearch =
        (d.name || "").toLowerCase().includes(deptSearch.toLowerCase()) ||
        (d.code || "").toLowerCase().includes(deptSearch.toLowerCase()) ||
        (d.head_user_id || "").toLowerCase().includes(deptSearch.toLowerCase()) ||
        (buMap.get(d.business_unit_id) || "").toLowerCase().includes(deptSearch.toLowerCase());

      const matchesBu = deptBuFilter === "ALL" || d.business_unit_id === deptBuFilter;
      return matchesSearch && matchesBu;
    });
  }, [departments, deptSearch, deptBuFilter, buMap]);

  const openCreateDeptModal = () => {
    setEditingDept(null);
    setDeptCode("");
    setDeptName("");
    setDeptBuId(businessUnits.length > 0 ? businessUnits[0].id : "");
    setDeptHeadId("");
    setDeptIsActive(true);
    setDeptFormError(null);
    setShowDeptModal(true);
  };

  const openEditDeptModal = (item: DepartmentResponse) => {
    setEditingDept(item);
    setDeptCode(item.code);
    setDeptName(item.name);
    setDeptBuId(item.business_unit_id);
    setDeptHeadId(item.head_user_id || "");
    setDeptIsActive(item.is_active);
    setDeptFormError(null);
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptFormError(null);
    if (!editingDept && !deptCode.trim()) {
      setDeptFormError("Department code is required.");
      return;
    }
    if (!deptName.trim()) {
      setDeptFormError("Department name is required.");
      return;
    }
    if (!deptBuId) {
      setDeptFormError("Please select an operating business unit.");
      return;
    }

    try {
      if (editingDept) {
        await updateDeptMutation.mutateAsync({
          id: editingDept.id,
          payload: {
            name: deptName.trim(),
            business_unit_id: deptBuId,
            head_user_id: deptHeadId.trim() || null,
            is_active: deptIsActive,
          },
        });
      } else {
        await createDeptMutation.mutateAsync({
          code: deptCode.trim().toUpperCase(),
          name: deptName.trim(),
          business_unit_id: deptBuId,
          head_user_id: deptHeadId.trim() || null,
          is_active: deptIsActive,
        });
      }
      setShowDeptModal(false);
    } catch (err: any) {
      setDeptFormError(err?.response?.data?.message || err?.message || "Failed to save department");
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete department "${name}"?`)) return;
    try {
      await deleteDeptMutation.mutateAsync(id);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to delete department");
    }
  };

  // ==========================================================================
  // Tab 3: Cost Centers State & Actions
  // ==========================================================================
  const createCcMutation = useCreateCostCenter();
  const updateCcMutation = useUpdateCostCenter();
  const deleteCcMutation = useDeleteCostCenter();

  const [ccSearch, setCcSearch] = useState("");
  const [ccBuFilter, setCcBuFilter] = useState("ALL");
  const [showCcModal, setShowCcModal] = useState(false);
  const [editingCc, setEditingCc] = useState<CostCenterResponse | null>(null);
  const [ccCode, setCcCode] = useState("");
  const [ccName, setCcName] = useState("");
  const [ccBuId, setCcBuId] = useState("");
  const [ccGlAccount, setCcGlAccount] = useState("");
  const [ccErpCode, setCcErpCode] = useState("");
  const [ccAnnualBudget, setCcAnnualBudget] = useState("1000000");
  const [ccAvailBudget, setCcAvailBudget] = useState("1000000");
  const [ccIsActive, setCcIsActive] = useState(true);
  const [ccFormError, setCcFormError] = useState<string | null>(null);

  const ccMetrics = useMemo(() => {
    const totalAnnual = costCenters.reduce((sum, c) => sum + (Number(c.annual_budget) || 0), 0);
    const totalAvail = costCenters.reduce((sum, c) => sum + (Number(c.available_budget) || 0), 0);
    const spent = Math.max(0, totalAnnual - totalAvail);
    const utilizationPct = totalAnnual > 0 ? Math.round((spent / totalAnnual) * 100) : 0;
    return { totalAnnual, totalAvail, spent, utilizationPct };
  }, [costCenters]);

  const filteredCCs = useMemo(() => {
    return costCenters.filter((c) => {
      const matchesSearch =
        (c.name || "").toLowerCase().includes(ccSearch.toLowerCase()) ||
        (c.code || "").toLowerCase().includes(ccSearch.toLowerCase()) ||
        (c.gl_account || "").toLowerCase().includes(ccSearch.toLowerCase()) ||
        (c.erp_cost_center_code || "").toLowerCase().includes(ccSearch.toLowerCase()) ||
        (buMap.get(c.business_unit_id) || "").toLowerCase().includes(ccSearch.toLowerCase());

      const matchesBu = ccBuFilter === "ALL" || c.business_unit_id === ccBuFilter;
      return matchesSearch && matchesBu;
    });
  }, [costCenters, ccSearch, ccBuFilter, buMap]);

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const openCreateCcModal = () => {
    setEditingCc(null);
    setCcCode("");
    setCcName("");
    setCcBuId(businessUnits.length > 0 ? businessUnits[0].id : "");
    setCcGlAccount("");
    setCcErpCode("");
    setCcAnnualBudget("1000000");
    setCcAvailBudget("1000000");
    setCcIsActive(true);
    setCcFormError(null);
    setShowCcModal(true);
  };

  const openEditCcModal = (item: CostCenterResponse) => {
    setEditingCc(item);
    setCcCode(item.code);
    setCcName(item.name);
    setCcBuId(item.business_unit_id);
    setCcGlAccount(item.gl_account || "");
    setCcErpCode(item.erp_cost_center_code || "");
    setCcAnnualBudget(String(item.annual_budget || "0"));
    setCcAvailBudget(String(item.available_budget || "0"));
    setCcIsActive(item.is_active);
    setCcFormError(null);
    setShowCcModal(true);
  };

  const handleSaveCc = async (e: React.FormEvent) => {
    e.preventDefault();
    setCcFormError(null);
    if (!editingCc && !ccCode.trim()) {
      setCcFormError("Cost center code is required.");
      return;
    }
    if (!ccName.trim()) {
      setCcFormError("Cost center name is required.");
      return;
    }
    if (!ccBuId) {
      setCcFormError("Please select an operating business unit.");
      return;
    }

    try {
      if (editingCc) {
        await updateCcMutation.mutateAsync({
          id: editingCc.id,
          payload: {
            name: ccName.trim(),
            business_unit_id: ccBuId,
            gl_account: ccGlAccount.trim() || null,
            erp_cost_center_code: ccErpCode.trim() || null,
            annual_budget: Number(ccAnnualBudget) || 0,
            available_budget: Number(ccAvailBudget) || 0,
            is_active: ccIsActive,
          },
        });
      } else {
        await createCcMutation.mutateAsync({
          code: ccCode.trim().toUpperCase(),
          name: ccName.trim(),
          business_unit_id: ccBuId,
          gl_account: ccGlAccount.trim() || null,
          erp_cost_center_code: ccErpCode.trim() || null,
          annual_budget: Number(ccAnnualBudget) || 0,
          available_budget: Number(ccAvailBudget) || 0,
          is_active: ccIsActive,
        });
      }
      setShowCcModal(false);
    } catch (err: any) {
      setCcFormError(err?.response?.data?.message || err?.message || "Failed to save cost center");
    }
  };

  const handleDeleteCc = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete cost center "${name}"?`)) return;
    try {
      await deleteCcMutation.mutateAsync(id);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to delete cost center");
    }
  };

  const tabs: TabOption[] = [
    {
      id: "business-units",
      label: "Business Units",
      count: businessUnits.length,
      icon: <Layers className="w-4 h-4 text-blue-500" />,
    },
    {
      id: "departments",
      label: "Departments & Teams",
      count: departments.length,
      icon: <Network className="w-4 h-4 text-purple-500" />,
    },
    {
      id: "cost-centers",
      label: "Cost Centers & Budgets",
      count: costCenters.length,
      icon: <Wallet className="w-4 h-4 text-amber-500" />,
    },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-neutral-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Operating Structure & Budgets
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-2xl">
            Unified management for operating divisions, functional departments, and financial cost centers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "business-units" && (
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreateBuModal}>
              Add Business Unit
            </Button>
          )}
          {activeTab === "departments" && (
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreateDeptModal}>
              Add Department
            </Button>
          )}
          {activeTab === "cost-centers" && (
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreateCcModal}>
              Add Cost Center
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation Strip */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} wide />

      {/* ================================================================== */}
      {/* TAB 1: BUSINESS UNITS CONTENT                                      */}
      {/* ================================================================== */}
      {activeTab === "business-units" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <span className="text-xs text-gray-400">Total Business Units</span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{businessUnits.length}</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <span className="text-xs text-gray-400">Active Units</span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {businessUnits.filter((b) => b.is_active).length}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <span className="text-xs text-gray-400">Associated Departments</span>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{departments.length}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search business units by name, code, or ERP code..."
              value={buSearch}
              onChange={(e) => setBuSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            {buLoading ? (
              <div className="p-12 text-center text-sm text-gray-500">Loading business units...</div>
            ) : filteredBUs.length === 0 ? (
              <div className="p-12 text-center">
                <Layers className="w-10 h-10 mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No business units found</h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                  Create your organization&apos;s first operating division.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  className="mt-4"
                  onClick={openCreateBuModal}
                >
                  Create Business Unit
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-800/30 text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Code</th>
                      <th className="py-3.5 px-4">Unit Name</th>
                      <th className="py-3.5 px-4">ERP Code</th>
                      <th className="py-3.5 px-4">Currency</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {filteredBUs.map((bu) => (
                      <tr key={bu.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-blue-600 dark:text-blue-400 text-xs">
                          {bu.code}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900 dark:text-white">{bu.name}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-gray-500 dark:text-neutral-400">
                          {bu.erp_company_code ? (
                            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800">
                              {bu.erp_company_code}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="info">{bu.default_currency}</Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          {bu.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-neutral-500">
                              <XCircle className="w-3.5 h-3.5" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditBuModal(bu)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Edit Business Unit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBu(bu.id, bu.name)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                              title="Delete Business Unit"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 2: DEPARTMENTS CONTENT                                         */}
      {/* ================================================================== */}
      {activeTab === "departments" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <span className="text-xs text-gray-400">Total Departments</span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{departments.length}</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <span className="text-xs text-gray-400">Active Units</span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {departments.filter((d) => d.is_active).length}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <span className="text-xs text-gray-400">Operating Divisions</span>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {new Set(departments.map((d) => d.business_unit_id)).size}
              </p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search departments by name, code, or head..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="w-full sm:w-64">
              <select
                value={deptBuFilter}
                onChange={(e) => setDeptBuFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Business Units</option>
                {businessUnits.map((bu) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            {deptLoading ? (
              <div className="p-12 text-center text-sm text-gray-500">Loading departments...</div>
            ) : filteredDepts.length === 0 ? (
              <div className="p-12 text-center">
                <Network className="w-10 h-10 mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No departments found</h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                  Add functional departments to organize your teams.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  className="mt-4"
                  onClick={openCreateDeptModal}
                >
                  Add Department
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-800/30 text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Code</th>
                      <th className="py-3.5 px-4">Department Name</th>
                      <th className="py-3.5 px-4">Business Unit</th>
                      <th className="py-3.5 px-4">Department Head</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {filteredDepts.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-purple-600 dark:text-purple-400 text-xs">
                          {d.code}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">{d.name}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                            <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>{buMap.get(d.business_unit_id) || "—"}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-500 dark:text-neutral-400">
                          {d.head_user_id ? (
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="font-mono text-[11px] truncate max-w-[140px]">{d.head_user_id}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {d.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-neutral-500">
                              <XCircle className="w-3.5 h-3.5" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditDeptModal(d)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDept(d.id, d.name)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 3: COST CENTERS CONTENT                                        */}
      {/* ================================================================== */}
      {activeTab === "cost-centers" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <span className="text-xs text-gray-400">Total Allocation Codes</span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{costCenters.length}</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <span className="text-xs text-gray-400">Total Annual Budget</span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(ccMetrics.totalAnnual)}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Available Funds</span>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {ccMetrics.utilizationPct}% Committed
                </span>
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(ccMetrics.totalAvail)}
              </p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search cost centers by name, code, or GL account..."
                value={ccSearch}
                onChange={(e) => setCcSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="w-full sm:w-64">
              <select
                value={ccBuFilter}
                onChange={(e) => setCcBuFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Business Units</option>
                {businessUnits.map((bu) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            {ccLoading ? (
              <div className="p-12 text-center text-sm text-gray-500">Loading cost centers...</div>
            ) : filteredCCs.length === 0 ? (
              <div className="p-12 text-center">
                <Wallet className="w-10 h-10 mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No cost centers found</h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                  Configure accounting codes and budgets for departments.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  className="mt-4"
                  onClick={openCreateCcModal}
                >
                  Add Cost Center
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-800/30 text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Code</th>
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-4">Business Unit</th>
                      <th className="py-3.5 px-4">GL Account</th>
                      <th className="py-3.5 px-4">Annual Budget</th>
                      <th className="py-3.5 px-4">Available Budget</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {filteredCCs.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-amber-600 dark:text-amber-400 text-xs">
                          {c.code}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">{c.name}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                            <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>{buMap.get(c.business_unit_id) || "—"}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-gray-600 dark:text-gray-400">
                          {c.gl_account ? (
                            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800">{c.gl_account}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-white text-xs">
                          {formatCurrency(c.annual_budget)}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-emerald-600 dark:text-emerald-400 text-xs">
                          {formatCurrency(c.available_budget)}
                        </td>
                        <td className="py-3.5 px-4">
                          {c.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-neutral-500">
                              <XCircle className="w-3.5 h-3.5" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditCcModal(c)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCc(c.id, c.name)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BU MODAL */}
      {showBuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {editingBu ? "Edit Business Unit" : "Add Business Unit"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
              Configure operating division code, name, and default currency.
            </p>
            {buFormError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                {buFormError}
              </div>
            )}
            <form onSubmit={handleSaveBu} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingBu}
                    placeholder="e.g. BU-CORP"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 uppercase disabled:opacity-50"
                    value={buCode}
                    onChange={(e) => setBuCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Default Currency
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="INR"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 uppercase"
                    value={buCurrency}
                    onChange={(e) => setBuCurrency(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Corporate Operations"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  value={buName}
                  onChange={(e) => setBuName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ERP Company Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs"
                    value={buErpCode}
                    onChange={(e) => setBuErpCode(e.target.value)}
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={buIsActive}
                      onChange={(e) => setBuIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Active Status</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowBuModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={createBuMutation.isPending || updateBuMutation.isPending}>
                  {createBuMutation.isPending || updateBuMutation.isPending ? "Saving..." : "Save Business Unit"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEPT MODAL */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {editingDept ? "Edit Department" : "Add Department"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
              Configure functional team name, parent business unit, and department head.
            </p>
            {deptFormError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                {deptFormError}
              </div>
            )}
            <form onSubmit={handleSaveDept} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Department Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!!editingDept}
                  placeholder="e.g. DEPT-ENG"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 uppercase disabled:opacity-50"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Department Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Engineering & Maintenance"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Business Unit <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  value={deptBuId}
                  onChange={(e) => setDeptBuId(e.target.value)}
                >
                  <option value="">Select Business Unit...</option>
                  {businessUnits.map((bu) => (
                    <option key={bu.id} value={bu.id}>
                      {bu.name} ({bu.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Department Head (User ID)
                </label>
                <input
                  type="text"
                  placeholder="Optional User UUID or Email"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs"
                  value={deptHeadId}
                  onChange={(e) => setDeptHeadId(e.target.value)}
                />
              </div>
              <div className="flex items-center pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deptIsActive}
                    onChange={(e) => setDeptIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Active Status</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowDeptModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={createDeptMutation.isPending || updateDeptMutation.isPending}>
                  {createDeptMutation.isPending || updateDeptMutation.isPending ? "Saving..." : "Save Department"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CC MODAL */}
      {showCcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {editingCc ? "Edit Cost Center" : "Add Cost Center"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
              Configure accounting code, GL linkage, and annual budget limit.
            </p>
            {ccFormError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                {ccFormError}
              </div>
            )}
            <form onSubmit={handleSaveCc} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cost Center Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingCc}
                    placeholder="e.g. CC-ENG-001"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 uppercase disabled:opacity-50"
                    value={ccCode}
                    onChange={(e) => setCcCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Business Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    value={ccBuId}
                    onChange={(e) => setCcBuId(e.target.value)}
                  >
                    <option value="">Select Business Unit...</option>
                    {businessUnits.map((bu) => (
                      <option key={bu.id} value={bu.id}>
                        {bu.name} ({bu.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cost Center Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Engineering Operations"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  value={ccName}
                  onChange={(e) => setCcName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    GL Account Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 600100"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs"
                    value={ccGlAccount}
                    onChange={(e) => setCcGlAccount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ERP Cost Center Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CC100"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs"
                    value={ccErpCode}
                    onChange={(e) => setCcErpCode(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Annual Budget (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    value={ccAnnualBudget}
                    onChange={(e) => setCcAnnualBudget(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Available Budget (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    value={ccAvailBudget}
                    onChange={(e) => setCcAvailBudget(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ccIsActive}
                    onChange={(e) => setCcIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Active Status</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowCcModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={createCcMutation.isPending || updateCcMutation.isPending}>
                  {createCcMutation.isPending || updateCcMutation.isPending ? "Saving..." : "Save Cost Center"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OperatingStructurePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gray-500">Loading structure...</div>}>
      <OperatingStructureContent />
    </Suspense>
  );
}
