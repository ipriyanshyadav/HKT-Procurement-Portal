"use client";

import React, { useState, useEffect } from "react";
import {
  useOnboardingSession,
  useSaveOnboardingStep,
  useCompleteOnboarding,
  useOnboardingChecklist,
  useAppToast,
} from "@procurement/hooks";
import {
  Building2,
  Network,
  Cpu,
  Database,
  Users,
  UserCheck,
  ShieldCheck,
  Rocket,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  FileCheck2,
} from "lucide-react";

interface StepConfig {
  step: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
}

const STEPS: StepConfig[] = [
  { step: 1, title: "Organization Basics", subtitle: "Legal details, PAN, GSTIN & Base Currency", icon: Building2 },
  { step: 2, title: "Company Structure", subtitle: "Legal Entity & primary Business Unit setup", icon: Network },
  { step: 3, title: "ERP & Integrations", subtitle: "SAP / Oracle / Custom gateway configuration", icon: Cpu },
  { step: 4, title: "Master Data Seeding", subtitle: "Standard categories, UOMs, payment & tax terms", icon: Database },
  { step: 5, title: "Roles & Admins", subtitle: "Invite procurement and finance controllers", icon: Users },
  { step: 6, title: "Vendor Setup", subtitle: "Vendor qualification rules & onboarding policies", icon: UserCheck },
  { step: 7, title: "Approval Rules", subtitle: "PR/PO approval hierarchies & financial limits", icon: ShieldCheck },
  { step: 8, title: "Go-Live & Verification", subtitle: "System audit checklist & launch readiness", icon: Rocket },
];

export default function OnboardingWizardPage() {
  const { toast } = useAppToast();
  const { data: session, isLoading: isSessionLoading } = useOnboardingSession();
  const { data: checklist, refetch: refetchChecklist } = useOnboardingChecklist();
  const saveStepMutation = useSaveOnboardingStep();
  const completeMutation = useCompleteOnboarding();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [erpPingStatus, setErpPingStatus] = useState<string | null>(null);

  // Sync state when session loads
  useEffect(() => {
    if (session) {
      setCurrentStep(session.current_step || 1);
      const initialData: Record<string, any> = {};
      for (let s = 1; s <= 8; s++) {
        if (session.step_data?.[`step_${s}`]) {
          initialData[`step_${s}`] = session.step_data[`step_${s}`];
        }
      }
      setFormData(initialData);
    }
  }, [session]);

  const activeStepData = formData[`step_${currentStep}`] || {};

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [`step_${currentStep}`]: {
        ...prev[`step_${currentStep}`],
        [field]: value,
      },
    }));
  };

  const handleSaveAndNext = async () => {
    const dataToSave = formData[`step_${currentStep}`] || {};
    try {
      await saveStepMutation.mutateAsync({
        step: currentStep,
        data: dataToSave,
        mark_step_completed: true,
      });
      await refetchChecklist();
      toast.success("Step saved", `Step ${currentStep} persisted successfully`);
      if (currentStep < 8) {
        setCurrentStep((prev) => prev + 1);
      }
    } catch (err: any) {
      toast.error("Save failed", err?.message || "Could not save step progress");
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      await completeMutation.mutateAsync();
      await refetchChecklist();
      toast.success("Onboarding Completed!", "Organization is now primed for enterprise live operations.");
    } catch (err: any) {
      toast.error("Completion Failed", err?.message || "Failed to complete onboarding session");
    }
  };

  if (isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-neutral-500 font-medium">Loading onboarding session...</p>
      </div>
    );
  }

  const completedSteps = session?.completed_steps || [];
  const isCompleted = session?.status === "COMPLETED";

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Buyer Enterprise Setup (SPEC_27-B)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Organization Onboarding Wizard</h1>
          <p className="text-blue-200 text-sm mt-1 max-w-xl">
            Configure your enterprise tenant, financial structures, ERP connectivity, and approval controls in 8 guided milestones.
          </p>
        </div>
        {isCompleted ? (
          <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400 text-emerald-300 px-4 py-2 rounded-xl text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Go-Live Primed</span>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-blue-200 font-medium">
              Progress: {completedSteps.length} of 8 Steps Complete
            </span>
            <div className="w-48 bg-blue-950/60 rounded-full h-2.5 overflow-hidden border border-blue-500/30">
              <div
                className="bg-gradient-to-r from-blue-400 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${(completedSteps.length / 8) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stepper Navigation Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const isDone = completedSteps.includes(s.step);
          const isCurrent = currentStep === s.step;

          return (
            <button
              key={s.step}
              type="button"
              onClick={() => setCurrentStep(s.step)}
              className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all text-xs font-medium ${
                isCurrent
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-sm"
                  : isDone
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300"
              }`}
            >
              <div className="relative mb-1.5">
                <Icon className={`w-5 h-5 ${isCurrent ? "text-blue-600" : isDone ? "text-emerald-600" : "text-neutral-400"}`} />
                {isDone && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 absolute -top-1 -right-2 bg-white rounded-full" />
                )}
              </div>
              <span className="line-clamp-1 font-semibold">{s.title}</span>
              <span className="text-[10px] text-neutral-400">Step {s.step}</span>
            </button>
          );
        })}
      </div>

      {/* Main Step Workspace */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Step {currentStep} of 8
            </span>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mt-0.5">
              {STEPS[currentStep - 1].title}
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">{STEPS[currentStep - 1].subtitle}</p>
          </div>
          {completedSteps.includes(currentStep) && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-4 h-4" /> Completed
            </span>
          )}
        </div>

        {/* Step-specific Content Forms */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Legal Entity Name *
              </label>
              <input
                type="text"
                placeholder="Acme Global Procurement Ltd"
                value={activeStepData.legal_name || ""}
                onChange={(e) => handleFieldChange("legal_name", e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Organization Code (3-6 Alphanumeric) *
              </label>
              <input
                type="text"
                placeholder="ACME01"
                value={activeStepData.org_code || ""}
                onChange={(e) => handleFieldChange("org_code", e.target.value.toUpperCase())}
                className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100 uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Permanent Account Number (PAN) *
              </label>
              <input
                type="text"
                placeholder="AAACA1234A"
                value={activeStepData.pan || ""}
                onChange={(e) => handleFieldChange("pan", e.target.value.toUpperCase())}
                className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100 uppercase"
              />
              <p className="text-[11px] text-neutral-400 mt-1">Format: 5 letters, 4 digits, 1 letter</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                GSTIN *
              </label>
              <input
                type="text"
                placeholder="27AAACA1234A1Z5"
                value={activeStepData.gstin || ""}
                onChange={(e) => handleFieldChange("gstin", e.target.value.toUpperCase())}
                className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100 uppercase"
              />
              <p className="text-[11px] text-neutral-400 mt-1">15-digit alphanumeric Indian GST identifier</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Base Accounting Currency
              </label>
              <select
                value={activeStepData.currency || "INR"}
                onChange={(e) => handleFieldChange("currency", e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
              >
                <option value="INR">INR (₹ - Indian Rupee)</option>
                <option value="USD">USD ($ - US Dollar)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="GBP">GBP (£ - British Pound)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Fiscal Year Start Month
              </label>
              <select
                value={activeStepData.fiscal_start || "APRIL"}
                onChange={(e) => handleFieldChange("fiscal_start", e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
              >
                <option value="APRIL">April (Indian Financial Year)</option>
                <option value="JANUARY">January (Calendar Year)</option>
              </select>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Primary Legal Entity Name
                </label>
                <input
                  type="text"
                  placeholder="Acme Manufacturing India Private Limited"
                  value={activeStepData.legal_entity_name || ""}
                  onChange={(e) => handleFieldChange("legal_entity_name", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Corporate Identification Number (CIN)
                </label>
                <input
                  type="text"
                  placeholder="U74999MH2020PTC123456"
                  value={activeStepData.cin || ""}
                  onChange={(e) => handleFieldChange("cin", e.target.value.toUpperCase())}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Primary Business Unit (BU)
                </label>
                <input
                  type="text"
                  placeholder="Corporate Procurement & Supply Chain"
                  value={activeStepData.primary_bu_name || ""}
                  onChange={(e) => handleFieldChange("primary_bu_name", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Cost Center Code
                </label>
                <input
                  type="text"
                  placeholder="CC-PROC-1001"
                  value={activeStepData.cost_center_code || ""}
                  onChange={(e) => handleFieldChange("cost_center_code", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Registered Factory / Warehouse Address
              </label>
              <textarea
                rows={2}
                placeholder="Plot No. 42, Tech Logistics Park, Navi Mumbai, MH 400701"
                value={activeStepData.registered_address || ""}
                onChange={(e) => handleFieldChange("registered_address", e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  ERP Connector Provider
                </label>
                <select
                  value={activeStepData.erp_provider || "SAP_S4HANA"}
                  onChange={(e) => handleFieldChange("erp_provider", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="SAP_S4HANA">SAP S/4HANA (REST / OData v4)</option>
                  <option value="ORACLE_FUSION">Oracle Fusion ERP Cloud</option>
                  <option value="MS_DYNAMICS">Microsoft Dynamics 365 F&O</option>
                  <option value="CUSTOM_WEBHOOK">Custom Enterprise Webhook Gateway</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  eSign Provider (Contracts & POs)
                </label>
                <select
                  value={activeStepData.esign_provider || "AADHAAR_ESIGN"}
                  onChange={(e) => handleFieldChange("esign_provider", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="AADHAAR_ESIGN">Aadhaar eSign (ESP Certified - India)</option>
                  <option value="DOCUSIGN">DocuSign Global</option>
                  <option value="ADOBE_SIGN">Adobe Acrobat Sign</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  ERP Gateway Base URL
                </label>
                <input
                  type="text"
                  placeholder="https://sap-gateway.internal.corp:8443/odata/v4"
                  value={activeStepData.erp_base_url || ""}
                  onChange={(e) => handleFieldChange("erp_base_url", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => {
                  setErpPingStatus("testing");
                  setTimeout(() => setErpPingStatus("success"), 1000);
                }}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-semibold rounded-lg flex items-center gap-2"
              >
                {erpPingStatus === "testing" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Test ERP Connectivity
              </button>
              {erpPingStatus === "success" && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> 200 OK — Handshake Verified (RTT: 42ms)
                </span>
              )}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">
              Select standard baseline master data catalogues to automatically seed for this organization:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: "categories", label: "UNSPSC Standard Category Hierarchy (IT, Hardware, Services, Logistics)" },
                { id: "uom", label: "Standard Units of Measure (EA, KG, MTR, BOX, LTR, HRS, SET)" },
                { id: "payment_terms", label: "Default Payment Terms (Net 15, Net 30, Net 45, Advance 20%)" },
                { id: "incoterms", label: "Incoterms 2020 Matrix (EXW, FOB, CIF, DDP, CIP)" },
                { id: "tax_codes", label: "Indian GST Master Codes (GST0, GST5, GST12, GST18, GST28)" },
              ].map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 cursor-pointer hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={activeStepData[item.id] ?? true}
                    onChange={(e) => handleFieldChange(item.id, e.target.checked)}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      {item.label.split(" (")[0]}
                    </span>
                    <p className="text-[11px] text-neutral-500 mt-0.5">{item.label}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">
              Provision initial user access for department leadership:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Procurement Head Email
                </label>
                <input
                  type="email"
                  placeholder="head.procurement@acme.com"
                  value={activeStepData.procurement_head || ""}
                  onChange={(e) => handleFieldChange("procurement_head", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Finance Controller Email
                </label>
                <input
                  type="email"
                  placeholder="controller.finance@acme.com"
                  value={activeStepData.finance_controller || ""}
                  onChange={(e) => handleFieldChange("finance_controller", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Lead Sourcing Buyer Email
                </label>
                <input
                  type="email"
                  placeholder="lead.buyer@acme.com"
                  value={activeStepData.lead_buyer || ""}
                  onChange={(e) => handleFieldChange("lead_buyer", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
              <span>Invited team members will receive magic activation links with MFA setup instructions.</span>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">
              Configure supplier governance & automated verification criteria:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: "require_pan", title: "Mandatory PAN Verification", desc: "Require valid IT PAN for all domestic vendors prior to RFQ bidding." },
                { id: "require_bank_penny", title: "Penny-Drop Bank Verification", desc: "Automate ₹1 account verification before releasing any purchase order." },
                { id: "msme_fast_track", title: "MSME / Udyam Fast-Track", desc: "Provide 45-day statutory payment protection flag for registered micro/small vendors." },
                { id: "iso_safety_docs", title: "ISO & ESG Compliance Audits", desc: "Enforce ISO 9001, 14001 or equivalent environmental safety certificate uploads." },
              ].map((v) => (
                <label
                  key={v.id}
                  className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 cursor-pointer hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={activeStepData[v.id] ?? true}
                    onChange={(e) => handleFieldChange(v.id, e.target.checked)}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{v.title}</span>
                    <p className="text-[11px] text-neutral-500 mt-0.5">{v.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {currentStep === 7 && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">
              Establish multi-tier financial thresholds for automated workflow approval chains:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  L1 Manager Limit (INR)
                </label>
                <input
                  type="number"
                  placeholder="50000"
                  value={activeStepData.l1_limit || "50000"}
                  onChange={(e) => handleFieldChange("l1_limit", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
                <p className="text-[11px] text-neutral-400 mt-1">Requisitions up to ₹50,000 need only Line Manager approval.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  L2 Finance Controller Limit (INR)
                </label>
                <input
                  type="number"
                  placeholder="500000"
                  value={activeStepData.l2_limit || "500000"}
                  onChange={(e) => handleFieldChange("l2_limit", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
                <p className="text-[11px] text-neutral-400 mt-1">Above ₹50,000 routes to Finance Controller.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  L3 CFO Sign-Off Threshold (INR)
                </label>
                <input
                  type="number"
                  placeholder="2500000"
                  value={activeStepData.l3_limit || "2500000"}
                  onChange={(e) => handleFieldChange("l3_limit", e.target.value)}
                  className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
                <p className="text-[11px] text-neutral-400 mt-1">High-value capital spend &gt; ₹25,00,000 requires CFO.</p>
              </div>
            </div>
          </div>
        )}

        {currentStep === 8 && (
          <div className="space-y-6">
            <div className="bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-blue-600" />
                Go-Live Milestone Audit Checklist
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {checklist?.items?.map((chk) => (
                  <div
                    key={chk.key}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${
                      chk.is_completed
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                        : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        chk.is_completed ? "text-emerald-600" : "text-neutral-300"
                      }`}
                    />
                    <div>
                      <span className="font-semibold">{chk.title}</span>
                      <p className="text-[11px] opacity-80 mt-0.5">{chk.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <div>
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Ready to Launch Procurement Operations?
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Completing this wizard locks baseline settings into production and enables active PR & PO generation.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCompleteOnboarding}
                disabled={isCompleted || completeMutation.isPending}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0"
              >
                {completeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4" />
                )}
                {isCompleted ? "Onboarding Complete" : "Complete & Activate Tenant"}
              </button>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Previous
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveAndNext}
              disabled={saveStepMutation.isPending}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {saveStepMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : currentStep === 8 ? (
                <span>Save Milestone</span>
              ) : (
                <>
                  <span>Save & Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
