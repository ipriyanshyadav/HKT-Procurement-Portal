"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCreateApprovalRule,
  useActivateApprovalRule,
  useSimulateRuleMatching,
  useApprovalSimulate,
} from "@procurement/hooks";
import {
  PageHeader,
  Card,
  Button,
  WorkflowChainPreview,
} from "@procurement/ui";
import {
  ArrowLeft,
  Sliders,
  Plus,
  Trash2,
  Play,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

const ENTITY_OPTIONS = ["PR", "RFQ", "PO", "VENDOR", "CONTRACT"];

const TEMPLATE_OPTIONS: Record<string, string[]> = {
  PR: ["PR_APPROVAL", "PR_SIMPLE_APPROVAL"],
  RFQ: ["RFQ_APPROVAL", "RFQ_EXPEDITED_APPROVAL"],
  PO: ["PO_APPROVAL"],
  VENDOR: ["VENDOR_QUAL", "VENDOR_BLACKLIST"],
  CONTRACT: ["CONTRACT_APPROVAL"],
};

const FIELD_OPTIONS = [
  { value: "amount", label: "Total Amount / Value (Numeric)", type: "number" },
  { value: "is_capex", label: "Capital Expenditure (Boolean)", type: "boolean" },
  { value: "is_emergency", label: "Emergency Flag (Boolean)", type: "boolean" },
  { value: "is_strategic", label: "Strategic Sourcing (Boolean)", type: "boolean" },
  { value: "bu_id", label: "Business Unit ID (UUID/String)", type: "string" },
  { value: "category_id", label: "Category ID (UUID/String)", type: "string" },
  { value: "bidder_count", label: "Bidder Count (Numeric)", type: "number" },
];

interface ConditionRow {
  field: string;
  operator: string;
  value: string;
}

export default function CreateApprovalRulePage() {
  const router = useRouter();
  const createMutation = useCreateApprovalRule();
  const activateMutation = useActivateApprovalRule();
  const simulateRuleMutation = useSimulateRuleMatching();
  const simulateWorkflowMutation = useApprovalSimulate();

  // Form State
  const [entityType, setEntityType] = useState<string>("PR");
  const [ruleCode, setRuleCode] = useState<string>("PR_HIGH_VALUE_CAPEX");
  const [ruleName, setRuleName] = useState<string>("High-Value CAPEX PR Approval Matrix");
  const [priority, setPriority] = useState<number>(100);
  const [workflowTemplate, setWorkflowTemplate] = useState<string>("PR_APPROVAL");
  const [isCatchAll, setIsCatchAll] = useState<boolean>(false);

  // Conditions
  const [conditionRows, setConditionRows] = useState<ConditionRow[]>([
    { field: "amount", operator: ">", value: "500000" },
    { field: "is_capex", operator: "==", value: "True" },
  ]);
  const [expressionOverride, setExpressionOverride] = useState<string>("");

  // Simulation Sandbox
  const [simContextJson, setSimContextJson] = useState<string>(
    JSON.stringify({ amount: 650000, is_capex: true }, null, 2)
  );
  const [simResult, setSimResult] = useState<any>(null);
  const [simChain, setSimChain] = useState<any>(null);
  const [simError, setSimError] = useState<string | null>(null);

  // Auto-generate expression from visual rows
  const compiledExpression = isCatchAll
    ? ""
    : expressionOverride.trim()
    ? expressionOverride
    : conditionRows
        .filter((r) => r.field && r.operator && r.value)
        .map((r) => `${r.field} ${r.operator} ${r.value}`)
        .join(" and ");

  const handleAddCondition = () => {
    setConditionRows([...conditionRows, { field: "amount", operator: ">", value: "100000" }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditionRows(conditionRows.filter((_, i) => i !== index));
  };

  const handleConditionChange = (index: number, key: keyof ConditionRow, val: string) => {
    const updated = [...conditionRows];
    updated[index][key] = val;
    setConditionRows(updated);
  };

  const handleEntityChange = (eType: string) => {
    setEntityType(eType);
    const templates = TEMPLATE_OPTIONS[eType] || ["PR_APPROVAL"];
    setWorkflowTemplate(templates[0]);
    setRuleCode(`${eType}_`);
  };

  const handleRunSimulation = async () => {
    setSimError(null);
    try {
      const parsedContext = JSON.parse(simContextJson);

      // 1. Simulate workflow chain preview
      const chainRes = await simulateWorkflowMutation.mutateAsync({
        template_code: workflowTemplate,
        entity_context: parsedContext,
      });
      setSimChain(chainRes.chain);

      // 2. Test rule matching
      const matchRes = await simulateRuleMutation.mutateAsync({
        entity_type: entityType,
        entity_context: parsedContext,
      });
      setSimResult(matchRes);
    } catch (err: any) {
      setSimError(err.message || "Failed to run simulation");
    }
  };

  const handleSubmit = async (activateNow: boolean) => {
    try {
      const payload = {
        entity_type: entityType,
        rule_code: ruleCode.trim().toUpperCase(),
        rule_name: ruleName.trim(),
        priority: Number(priority),
        workflow_template_code: workflowTemplate,
        is_catch_all: isCatchAll,
        condition_expression: isCatchAll ? undefined : (compiledExpression || undefined),
        conditions: isCatchAll ? {} : { expression: compiledExpression },
      };

      const created = await createMutation.mutateAsync(payload);

      if (activateNow && created?.id) {
        await activateMutation.mutateAsync(created.id);
      }

      router.push("/approval-rules");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to create approval rule");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/approval-rules" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Rules
        </Link>
      </div>

      <PageHeader
        title="Author Approval Rule"
        subtitle="Configure deterministic conditional expressions and bind them to automated approval chains."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Rule Identity & Scope" subtitle="Core metadata identifying this policy">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Entity Type *
                </label>
                <select
                  value={entityType}
                  onChange={(e) => handleEntityChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {ENTITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt} (e.g. {opt === "PR" ? "Requisition" : opt === "RFQ" ? "Sourcing Tender" : opt})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Rule Code *
                </label>
                <input
                  type="text"
                  value={ruleCode}
                  onChange={(e) => setRuleCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="PR_HIGH_VALUE"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="High Value Procurement Approval Chain"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Priority (1 = Highest) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Lower numbers take precedence during evaluation.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Linked Workflow Template *
                </label>
                <select
                  value={workflowTemplate}
                  onChange={(e) => setWorkflowTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {(TEMPLATE_OPTIONS[entityType] || ["PR_APPROVAL"]).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
              <input
                type="checkbox"
                id="catchAll"
                checked={isCatchAll}
                onChange={(e) => setIsCatchAll(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="catchAll" className="text-xs font-bold text-neutral-900 dark:text-white cursor-pointer">
                Set as Catch-All Default Rule for {entityType}
              </label>
              <span className="text-xs text-neutral-400">(Fires when no higher priority rules match)</span>
            </div>
          </Card>

          {/* Visual Condition Builder */}
          {!isCatchAll && (
            <Card
              title="Condition Builder"
              subtitle="Build logical expressions evaluated by the safe sandbox engine"
              action={
                <Button variant="secondary" size="sm" onClick={handleAddCondition} icon={<Plus className="w-3.5 h-3.5 mr-1" />}>
                  Add Condition
                </Button>
              }
            >
              <div className="space-y-3">
                {conditionRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-xs font-bold text-neutral-400 w-6">#{idx + 1}</span>
                    <select
                      value={row.field}
                      onChange={(e) => handleConditionChange(idx, "field", e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
                    >
                      {FIELD_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={row.operator}
                      onChange={(e) => handleConditionChange(idx, "operator", e.target.value)}
                      className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
                    >
                      <option value=">"> &gt; (Greater)</option>
                      <option value=">="> &gt;= (At least)</option>
                      <option value="<"> &lt; (Less)</option>
                      <option value="<="> &lt;= (At most)</option>
                      <option value="=="> == (Equals)</option>
                      <option value="!="> != (Not equal)</option>
                    </select>

                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => handleConditionChange(idx, "value", e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(idx)}
                      disabled={conditionRows.length <= 1}
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Compiled Condition Expression
                  </label>
                  <div className="p-2.5 rounded-xl font-mono text-xs bg-neutral-900 text-emerald-400 dark:bg-black border border-neutral-800">
                    {compiledExpression || "<no condition>"}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/approval-rules">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => handleSubmit(false)}
              disabled={createMutation.isPending}
              icon={<Save className="w-4 h-4 mr-1.5" />}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              onClick={() => handleSubmit(true)}
              disabled={createMutation.isPending || activateMutation.isPending}
              icon={<CheckCircle2 className="w-4 h-4 mr-1.5" />}
            >
              Save & Activate
            </Button>
          </div>
        </div>

        {/* Right 1 Col: Rule Simulator Sandbox */}
        <div className="space-y-6">
          <Card
            title="Policy Simulator"
            subtitle="Test this rule against mock entity contexts in real time with zero DB writes."
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Simulated Entity Context (JSON)
                </label>
                <textarea
                  rows={5}
                  value={simContextJson}
                  onChange={(e) => setSimContextJson(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Button
                variant="secondary"
                className="w-full"
                onClick={handleRunSimulation}
                disabled={simulateWorkflowMutation.isPending}
                icon={<Play className="w-3.5 h-3.5 mr-1.5 text-blue-500" />}
              >
                Run Simulation Test
              </Button>

              {simError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{simError}</span>
                </div>
              )}

              {simChain && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="text-xs font-bold text-neutral-900 dark:text-white">
                    Resulting Approval Chain
                  </div>
                  <WorkflowChainPreview chain={simChain} />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
