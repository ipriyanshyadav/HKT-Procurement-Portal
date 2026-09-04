"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useApprovalRule,
  useApprovalRuleVersions,
  useUpdateApprovalRule,
  useActivateApprovalRule,
  useDeactivateApprovalRule,
  useSimulateRuleMatching,
  useApprovalSimulate,
} from "@procurement/hooks";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  WorkflowChainPreview,
} from "@procurement/ui";
import {
  ArrowLeft,
  Sliders,
  History,
  Play,
  Save,
  CheckCircle2,
  AlertCircle,
  Power,
  Shield,
} from "lucide-react";

export default function ApprovalRuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ruleId = params.id as string;

  const { data: rule, isLoading, refetch } = useApprovalRule(ruleId);
  const { data: versions } = useApprovalRuleVersions(ruleId);

  const updateMutation = useUpdateApprovalRule();
  const activateMutation = useActivateApprovalRule();
  const deactivateMutation = useDeactivateApprovalRule();
  const simulateRuleMutation = useSimulateRuleMatching();
  const simulateWorkflowMutation = useApprovalSimulate();

  // Form State
  const [ruleName, setRuleName] = useState("");
  const [priority, setPriority] = useState(100);
  const [workflowTemplate, setWorkflowTemplate] = useState("");
  const [conditionExpression, setConditionExpression] = useState("");

  // Simulator
  const [simContextJson, setSimContextJson] = useState(
    JSON.stringify({ amount: 500000, is_capex: true }, null, 2)
  );
  const [simChain, setSimChain] = useState<any>(null);
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    if (rule) {
      setRuleName(rule.rule_name || "");
      setPriority(rule.priority || 100);
      setWorkflowTemplate(rule.workflow_template_code || "");
      setConditionExpression(rule.condition_expression || "");
    }
  }, [rule]);

  const handleToggleActive = async () => {
    if (!rule) return;
    try {
      if (rule.is_active) {
        await deactivateMutation.mutateAsync(rule.id);
      } else {
        await activateMutation.mutateAsync(rule.id);
      }
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to update rule status");
    }
  };

  const handleSaveUpdate = async () => {
    if (!rule) return;
    try {
      await updateMutation.mutateAsync({
        id: rule.id,
        payload: {
          rule_name: ruleName.trim(),
          priority: Number(priority),
          workflow_template_code: workflowTemplate,
          condition_expression: conditionExpression || undefined,
        },
      });
      refetch();
      alert("Rule updated successfully");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to update rule");
    }
  };

  const handleRunSimulation = async () => {
    setSimError(null);
    if (!rule) return;
    try {
      const parsed = JSON.parse(simContextJson);
      const chainRes = await simulateWorkflowMutation.mutateAsync({
        template_code: workflowTemplate || rule.workflow_template_code,
        entity_context: parsed,
      });
      setSimChain(chainRes.chain);
    } catch (err: any) {
      setSimError(err.message || "Simulation failed");
    }
  };

  if (isLoading || !rule) {
    return (
      <div className="py-16 text-center text-neutral-400 text-sm">
        Loading approval rule details...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/approval-rules" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Rules
        </Link>
      </div>

      <PageHeader
        title={rule.rule_name}
        subtitle={`Rule Code: ${rule.rule_code} · Priority P${rule.priority} · Entity: ${rule.entity_type}`}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant={rule.is_active ? "secondary" : "primary"}
              onClick={handleToggleActive}
              disabled={activateMutation.isPending || deactivateMutation.isPending}
              icon={<Power className="w-4 h-4 mr-1.5" />}
            >
              {rule.is_active ? "Deactivate Rule" : "Activate in Production"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details & Version History */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Rule Configuration" subtitle="Manage rule execution criteria and priority rating">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Rule Code (Immutable)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={rule.rule_code}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-200 dark:border-neutral-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Entity Type (Immutable)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={rule.entity_type}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-200 dark:border-neutral-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={ruleName}
                    disabled={rule.is_active}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white disabled:opacity-60 focus:ring-2 focus:ring-blue-500"
                  />
                  {rule.is_active && (
                    <span className="text-[10px] text-amber-500 mt-1 block">
                      Deactivate rule to modify name, priority, or condition expression.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Priority Rank (1..1000)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={priority}
                    disabled={rule.is_active}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white disabled:opacity-60 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Workflow Template Code
                  </label>
                  <input
                    type="text"
                    value={workflowTemplate}
                    disabled={rule.is_active}
                    onChange={(e) => setWorkflowTemplate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white disabled:opacity-60 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Condition Expression
                </label>
                <textarea
                  rows={3}
                  value={conditionExpression}
                  disabled={rule.is_active || rule.is_catch_all}
                  onChange={(e) => setConditionExpression(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white disabled:opacity-60 focus:ring-2 focus:ring-blue-500"
                  placeholder="amount > 500000 and is_capex == True"
                />
              </div>

              {!rule.is_active && (
                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    onClick={handleSaveUpdate}
                    disabled={updateMutation.isPending}
                    icon={<Save className="w-4 h-4 mr-1.5" />}
                  >
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Version History Log */}
          <Card
            title="Version History"
            subtitle="Immutable snapshots captured on each rule activation (audit compliance)"
          >
            <div className="apple-table-container">
              <table className="apple-table">
                <thead>
                  <tr>
                    <th>Version Snapshot</th>
                    <th>Activated At</th>
                    <th>Priority</th>
                    <th>Template</th>
                    <th>Expression</th>
                  </tr>
                </thead>
                <tbody>
                  {!versions || versions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-neutral-400 text-xs">
                        No historical activation snapshots recorded yet.
                      </td>
                    </tr>
                  ) : (
                    versions.map((ver) => (
                      <tr key={ver.id}>
                        <td>
                          <span className="font-mono text-xs text-neutral-500">
                            {ver.id.slice(0, 8)}...
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-neutral-700 dark:text-neutral-300">
                            {new Date(ver.activated_at).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-xs font-bold text-blue-600">
                            P{ver.snapshot?.priority ?? "-"}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-xs text-neutral-600 dark:text-neutral-300">
                            {ver.snapshot?.workflow_template_code ?? "-"}
                          </span>
                        </td>
                        <td className="max-w-xs truncate">
                          <span className="font-mono text-xs text-neutral-500">
                            {ver.snapshot?.condition_expression || "(None)"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right 1 Col: Rule Simulator Sandbox */}
        <div className="space-y-6">
          <Card
            title="Policy Simulator"
            subtitle="Dry-run rule against context with zero DB writes."
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
                Test Match & Chain
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
