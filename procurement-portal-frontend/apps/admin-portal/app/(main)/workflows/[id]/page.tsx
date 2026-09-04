"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useWorkflowTemplateDetail,
  useUpdateWorkflowTemplate,
  WorkflowStepConfig,
} from "@procurement/hooks";
import { PageHeader, Card, Button, Badge } from "@procurement/ui";
import {
  GitFork,
  ArrowLeft,
  Plus,
  Trash2,
  ArrowDown,
  Clock,
  Shield,
  CheckCircle,
  HelpCircle,
  Play,
  ArrowUp,
  Save,
  Check,
} from "lucide-react";

const STANDARD_ROLES = [
  "REQUESTOR_MANAGER",
  "HOD",
  "FINANCE_APPROVER",
  "CPO",
  "VP_FINANCE",
  "LEGAL_HEAD",
  "CEO",
  "BUYER",
  "PROCUREMENT_ADMIN",
];

export default function WorkflowTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params?.id as string;

  const { data: template, isLoading, isError } = useWorkflowTemplateDetail(templateId);
  const updateMutation = useUpdateWorkflowTemplate();

  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<WorkflowStepConfig[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setName(template.name || "");
      setIsActive(template.is_active ?? true);
      setSteps(template.steps || []);
    }
  }, [template]);

  const handleAddStep = () => {
    const nextNum = steps.length + 1;
    setSteps((prev) => [
      ...prev,
      {
        step_number: nextNum,
        name: `Approval Level ${nextNum}`,
        approver_role: "HOD",
        timeout_hours: 24,
        require_all: false,
        condition: null,
      },
    ]);
  };

  const handleUpdateStep = (index: number, patch: Partial<WorkflowStepConfig>) => {
    setSteps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const handleDeleteStep = (index: number) => {
    if (steps.length <= 1) {
      alert("A workflow must have at least one step.");
      return;
    }
    const filtered = steps.filter((_, idx) => idx !== index);
    const renumbered = filtered.map((s, idx) => ({ ...s, step_number: idx + 1 }));
    setSteps(renumbered);
  };

  const handleMoveStep = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const reordered = [...steps];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const renumbered = reordered.map((s, idx) => ({ ...s, step_number: idx + 1 }));
    setSteps(renumbered);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMessage("Workflow name is required.");
      return;
    }
    if (steps.length === 0) {
      setErrorMessage("At least one approval step is required.");
      return;
    }

    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      await updateMutation.mutateAsync({
        templateId,
        payload: {
          name: name.trim(),
          is_active: isActive,
          steps,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.error?.message || err.message || "Failed to update workflow template."
      );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
        <div className="h-48 bg-neutral-100 dark:bg-neutral-900 rounded-2xl" />
      </div>
    );
  }

  if (isError || !template) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center space-y-4">
        <p className="text-red-600 font-semibold">Workflow template not found or access denied.</p>
        <Link href="/workflows">
          <Button variant="secondary" className="text-xs">
            ← Back to Workflow Templates
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <Link href="/workflows" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Workflows
            </Link>
            <span>/</span>
            <span className="font-mono">{template.code}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {name || template.name}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              {template.code}
            </span>
            <Badge variant={isActive ? "success" : "neutral"}>
              {isActive ? "ACTIVE" : "INACTIVE"}
            </Badge>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Target Entity: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{template.entity_type}</span> · Configure multi-step approval DAG, SLA timeouts, and conditions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/workflows">
            <Button variant="secondary" className="text-xs">
              Back to Templates
            </Button>
          </Link>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2"
          >
            {updateMutation.isPending ? (
              <span>Saving...</span>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" /> Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Success Banner */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center justify-between">
          <span>✓ Workflow template updated successfully!</span>
          <button onClick={() => setSaveSuccess(false)} className="font-bold opacity-70 hover:opacity-100 ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-300 font-medium flex items-center justify-between">
          <span>⚠ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold opacity-70 hover:opacity-100 ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Grid: Left = Step Builder, Right = Live Visual DAG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Step Cards */}
        <div className="lg:col-span-7 space-y-6">
          {/* Metadata Card */}
          <Card className="p-5 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Template Properties
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Template Code (Read-only)
                </label>
                <input
                  type="text"
                  disabled
                  value={template.code}
                  className="w-full px-3 py-2 text-xs font-mono border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Target Entity (Read-only)
                </label>
                <input
                  type="text"
                  disabled
                  value={template.entity_type}
                  className="w-full px-3 py-2 text-xs font-semibold border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Template Display Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard High-Value PR Approval"
                  className="w-full px-3 py-2 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300 dark:border-neutral-700"
                />
                <label htmlFor="isActive" className="text-xs text-neutral-700 dark:text-neutral-300 font-medium cursor-pointer">
                  Activate this workflow template for production routing
                </label>
              </div>
            </div>
          </Card>

          {/* Sequential Step Builder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Sequential Approval Steps ({steps.length})
                </h2>
                <p className="text-xs text-neutral-500">
                  Steps execute in sequential order. Each level enforces role and SLA conditions.
                </p>
              </div>
              <Button variant="secondary" onClick={handleAddStep} className="text-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Step
              </Button>
            </div>

            {steps.map((step, idx) => (
              <Card
                key={idx}
                className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3 relative group hover:border-neutral-300 dark:hover:border-neutral-700 transition"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                      {step.step_number}
                    </span>
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => handleUpdateStep(idx, { name: e.target.value })}
                      placeholder="Step Name"
                      className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 bg-transparent border-b border-dashed border-neutral-300 dark:border-neutral-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStep(idx, "up")}
                      className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      title="Move Step Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === steps.length - 1}
                      onClick={() => handleMoveStep(idx, "down")}
                      className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      title="Move Step Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStep(idx)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded ml-1"
                      title="Delete Step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-neutral-600 dark:text-neutral-400 font-medium mb-1 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-blue-500" /> Approver Role *
                    </label>
                    <select
                      value={step.approver_role}
                      onChange={(e) => handleUpdateStep(idx, { approver_role: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {STANDARD_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-600 dark:text-neutral-400 font-medium mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" /> SLA Timeout: {step.timeout_hours} Hours
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={168}
                        value={step.timeout_hours}
                        onChange={(e) => handleUpdateStep(idx, { timeout_hours: Number(e.target.value) })}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-neutral-500 w-10 text-right">
                        {step.timeout_hours}h
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-neutral-600 dark:text-neutral-400 font-medium mb-1">
                      Condition Expression (Optional boolean rule)
                    </label>
                    <input
                      type="text"
                      value={step.condition || ""}
                      onChange={(e) => handleUpdateStep(idx, { condition: e.target.value || null })}
                      placeholder="e.g. amount >= 50000 or is_capex == true"
                      className="w-full px-2.5 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg font-mono text-[11px] bg-neutral-50 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id={`require_all_${idx}`}
                      checked={Boolean(step.require_all)}
                      onChange={(e) => handleUpdateStep(idx, { require_all: e.target.checked })}
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`require_all_${idx}`} className="text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer">
                      Require Unanimous Consensus (All users with this role must approve)
                    </label>
                  </div>
                </div>
              </Card>
            ))}

            <Button
              variant="secondary"
              onClick={handleAddStep}
              className="w-full py-2.5 text-xs border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Append Next Approval Step
            </Button>
          </div>
        </div>

        {/* Right Column: Live Visual DAG Topology Canvas */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6 space-y-4">
            <Card className="p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-blue-500" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Live DAG Topology Preview
                  </h3>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">
                  {steps.length} Nodes
                </span>
              </div>

              {/* Start Event */}
              <div className="flex flex-col items-center">
                <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                  <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                  <span>Start: {template.entity_type} Submitted</span>
                </div>
                <div className="h-6 w-0.5 bg-neutral-300 dark:bg-neutral-700 my-1" />
                <ArrowDown className="w-3.5 h-3.5 text-neutral-400 -mt-2 mb-1" />
              </div>

              {/* Sequential Steps in Canvas */}
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <React.Fragment key={idx}>
                    <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 text-xs space-y-2 shadow-xs hover:border-blue-400 transition">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {step.step_number}
                          </span>
                          {step.name || `Level ${step.step_number}`}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-neutral-800 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
                          {step.approver_role}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                        <span className="flex items-center gap-1 bg-white/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3 text-amber-500" /> {step.timeout_hours}h SLA
                        </span>
                        {step.condition && (
                          <span className="font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-[10px] text-neutral-600 dark:text-neutral-400 truncate max-w-[180px]">
                            {step.condition}
                          </span>
                        )}
                        {step.require_all && (
                          <span className="text-purple-600 dark:text-purple-400 font-semibold text-[10px]">
                            Consensus
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Connector Arrow */}
                    <div className="flex flex-col items-center">
                      <div className="h-5 w-0.5 bg-neutral-300 dark:bg-neutral-700 my-0.5" />
                      <ArrowDown className="w-3.5 h-3.5 text-neutral-400 -mt-1 mb-0.5" />
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {/* Terminal Approved Event */}
              <div className="flex flex-col items-center pt-1">
                <div className="px-3.5 py-1.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                  <span>Terminal State: APPROVED</span>
                </div>
              </div>
            </Card>

            {/* Quick Metrics */}
            <Card className="p-4 border border-neutral-200 dark:border-neutral-800 text-xs space-y-2 text-neutral-600 dark:text-neutral-400">
              <div className="flex justify-between">
                <span>Total Workflow SLA:</span>
                <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                  {steps.reduce((acc, s) => acc + (s.timeout_hours || 0), 0)} Hours
                </span>
              </div>
              <div className="flex justify-between">
                <span>Governance Protocol:</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  Dual-authorization enforced
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
