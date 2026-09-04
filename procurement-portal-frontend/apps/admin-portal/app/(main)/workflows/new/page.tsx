"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCreateWorkflowTemplate,
  WorkflowStepConfig,
} from "@procurement/hooks";
import { PageHeader, Card, Button } from "@procurement/ui";
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

export default function NewWorkflowTemplatePage() {
  const router = useRouter();
  const createMutation = useCreateWorkflowTemplate();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("PR");
  const [isActive, setIsActive] = useState(true);

  const [steps, setSteps] = useState<WorkflowStepConfig[]>([
    {
      step_number: 1,
      name: "Line Manager Approval",
      approver_role: "REQUESTOR_MANAGER",
      timeout_hours: 24,
      require_all: false,
      condition: "amount > 0",
    },
    {
      step_number: 2,
      name: "Finance Controller Review",
      approver_role: "FINANCE_APPROVER",
      timeout_hours: 48,
      require_all: false,
      condition: "amount >= 50000",
    },
  ]);

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
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    const renumbered = reordered.map((s, idx) => ({ ...s, step_number: idx + 1 }));
    setSteps(renumbered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      alert("Please fill in template code and name.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        entity_type: entityType,
        steps,
        is_active: isActive,
      });
      router.push("/workflows");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to create workflow template");
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/workflows" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Templates
        </Link>
      </div>

      <PageHeader
        title="Visual Workflow Template Designer"
        subtitle="Graphically compose multi-tiered approval chains with automated timeouts and conditional branch gates."
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Template Metadata */}
        <Card className="p-6 border border-neutral-200 dark:border-neutral-800 space-y-4">
          <h2 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm flex items-center gap-2">
            <GitFork className="w-4 h-4 text-blue-600" /> Template Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                Template Code *
              </label>
              <input
                type="text"
                required
                placeholder="EXEC_PR_CHAIN"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm font-mono uppercase border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                placeholder="Executive CapEx Approval Chain"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                Target Entity
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PR">PR (Purchase Requisition)</option>
                <option value="RFQ">RFQ (Request for Quotation)</option>
                <option value="PO">PO (Purchase Order)</option>
                <option value="VENDOR">Vendor Qualification</option>
                <option value="CONTRACT">Contract Approval</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Visual Step Canvas & DAG Designer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Step Authoring Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm flex items-center gap-2">
                Approval Chain Sequence ({steps.length} Steps)
              </h2>
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddStep}
                className="flex items-center gap-1.5 text-xs py-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Append Step
              </Button>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <Card
                  key={index}
                  className="p-5 border border-neutral-200 dark:border-neutral-800 relative space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                        {step.step_number}
                      </span>
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Step {step.step_number}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveStep(index, "up")}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === steps.length - 1}
                        onClick={() => handleMoveStep(index, "down")}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStep(index)}
                        className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                        Step Label *
                      </label>
                      <input
                        type="text"
                        required
                        value={step.name}
                        onChange={(e) => handleUpdateStep(index, { name: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900"
                        placeholder="e.g. Budget Approval"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                        Approver Role *
                      </label>
                      <select
                        value={step.approver_role}
                        onChange={(e) => handleUpdateStep(index, { approver_role: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900 font-mono"
                      >
                        {STANDARD_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" /> Timeout SLA (Hours)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={336}
                        value={step.timeout_hours}
                        onChange={(e) =>
                          handleUpdateStep(index, { timeout_hours: Number(e.target.value) })
                        }
                        className="w-full px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-neutral-400" /> Condition (Optional Python Expr)
                      </label>
                      <input
                        type="text"
                        value={step.condition || ""}
                        onChange={(e) =>
                          handleUpdateStep(index, { condition: e.target.value || null })
                        }
                        placeholder="e.g. amount > 10000"
                        className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Live DAG Preview Column */}
          <div className="space-y-4">
            <h2 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-500" /> Live Workflow Topology
            </h2>

            <Card className="p-6 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-4">
              <div className="flex flex-col items-center space-y-3">
                <div className="px-3 py-1 text-xs font-semibold rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  START ({entityType} Submitted)
                </div>

                <ArrowDown className="w-4 h-4 text-neutral-400" />

                {steps.map((step, idx) => (
                  <React.Fragment key={idx}>
                    <div className="w-full p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-neutral-800 shadow-sm space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        <span>{idx + 1}. {step.name || `Step ${idx + 1}`}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600">
                          {step.timeout_hours}h SLA
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 flex items-center gap-1 font-mono">
                        <Shield className="w-3 h-3 text-blue-500" />
                        {step.approver_role}
                      </div>
                      {step.condition && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                          if {step.condition}
                        </div>
                      )}
                    </div>
                    {idx < steps.length - 1 && (
                      <ArrowDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </React.Fragment>
                ))}

                <ArrowDown className="w-4 h-4 text-neutral-400" />

                <div className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> END (Approved & Released)
                </div>
              </div>
            </Card>

            <div className="pt-4 flex justify-end gap-3">
              <Link href="/workflows">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Deploy Workflow Template"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
