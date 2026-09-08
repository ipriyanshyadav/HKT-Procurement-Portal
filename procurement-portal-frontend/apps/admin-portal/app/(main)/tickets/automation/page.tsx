"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Zap,
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  Clock,
  Shuffle,
  Users,
  AlertCircle,
  Loader2,
  X,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from "lucide-react";
import {
  useAutomationRules,
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
  useRunAutomationRule,
} from "@procurement/hooks";
import type {
  AutomationRuleItem,
  AutomationRuleCreatePayload,
  AutomationTrigger,
  AutomationActionType,
} from "@procurement/types";

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  TICKET_CREATED: "Ticket Created",
  STATUS_CHANGED: "Status Changed",
  FIELD_CHANGED: "Field Value Changed",
  SLA_BREACHED: "SLA Breached",
  SCHEDULE: "Scheduled Timer",
};

const ACTION_LABELS: Record<AutomationActionType, string> = {
  ASSIGN_ROUND_ROBIN: "Assign via Round-Robin",
  ASSIGN_BALANCED: "Assign via Balanced Workload",
  ASSIGN_USER: "Assign to User",
  TRANSITION_STATUS: "Transition Status",
  CHANGE_PRIORITY: "Change Priority",
  SET_DUE_DATE: "Set Due Date",
  ADD_TAG: "Add Tag",
  ADD_COMMENT: "Add System Comment",
};

export default function AdminTicketAutomationPage() {
  const { data: rules = [], isLoading, refetch } = useAutomationRules();
  const createRule = useCreateAutomationRule();
  const updateRule = useUpdateAutomationRule();
  const deleteRule = useDeleteAutomationRule();
  const runRule = useRunAutomationRule();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [testModalRule, setTestModalRule] = useState<AutomationRuleItem | null>(null);
  const [testTicketId, setTestTicketId] = useState("");
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTrigger, setFormTrigger] = useState<AutomationTrigger>("TICKET_CREATED");
  const [formConditionField, setFormConditionField] = useState("priority");
  const [formConditionOperator, setFormConditionOperator] = useState("eq");
  const [formConditionValue, setFormConditionValue] = useState("CRITICAL");
  const [formActionType, setFormActionType] = useState<AutomationActionType>("ASSIGN_ROUND_ROBIN");
  const [formActionCandidateIds, setFormActionCandidateIds] = useState("");
  const [formActionTargetStatus, setFormActionTargetStatus] = useState("IN_PROGRESS");
  const [formActionTargetPriority, setFormActionTargetPriority] = useState("HIGH");
  const [formActionDueDateDays, setFormActionDueDateDays] = useState(3);
  const [formActionComment, setFormActionComment] = useState("");
  const [formActionTag, setFormActionTag] = useState("");

  const handleToggleActive = async (rule: AutomationRuleItem) => {
    await updateRule.mutateAsync({
      ruleId: rule.id,
      data: { is_enabled: !rule.is_enabled },
    });
    refetch();
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this automation rule?")) return;
    await deleteRule.mutateAsync(ruleId);
    refetch();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const conditions = formConditionField
      ? [
          {
            field: formConditionField,
            operator: formConditionOperator,
            value: formConditionValue,
          },
        ]
      : [];

    let actionConfig: Record<string, any> = {};
    if (formActionType === "ASSIGN_ROUND_ROBIN" || formActionType === "ASSIGN_BALANCED") {
      const ids = formActionCandidateIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      actionConfig = { candidate_user_ids: ids };
    } else if (formActionType === "ASSIGN_USER") {
      actionConfig = { user_id: formActionCandidateIds.trim() };
    } else if (formActionType === "TRANSITION_STATUS") {
      actionConfig = { status: formActionTargetStatus };
    } else if (formActionType === "CHANGE_PRIORITY") {
      actionConfig = { priority: formActionTargetPriority };
    } else if (formActionType === "SET_DUE_DATE") {
      actionConfig = { days_offset: Number(formActionDueDateDays) };
    } else if (formActionType === "ADD_COMMENT") {
      actionConfig = { comment: formActionComment };
    } else if (formActionType === "ADD_TAG") {
      actionConfig = { tag: formActionTag };
    }

    const payload: AutomationRuleCreatePayload = {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      trigger_type: formTrigger,
      trigger_config: {},
      conditions,
      actions: [
        {
          action_type: formActionType,
          config: actionConfig,
        },
      ],
      is_enabled: true,
    };

    await createRule.mutateAsync(payload);
    setShowCreateModal(false);
    resetForm();
    refetch();
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormTrigger("TICKET_CREATED");
    setFormConditionField("priority");
    setFormConditionOperator("eq");
    setFormConditionValue("CRITICAL");
    setFormActionType("ASSIGN_ROUND_ROBIN");
    setFormActionCandidateIds("");
    setFormActionTargetStatus("IN_PROGRESS");
    setFormActionDueDateDays(3);
    setFormActionComment("");
    setFormActionTag("");
  };

  const handleTestRunSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testModalRule || !testTicketId.trim()) return;

    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await runRule.mutateAsync({
        ruleId: testModalRule.id,
        ticketId: testTicketId.trim(),
      });
      setTestResult(res);
      refetch();
    } catch (err: any) {
      setTestResult({ error: err.message || "Failed to execute automation rule" });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tickets</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500 fill-amber-500" />
            <span>Jira Automation Rules Engine</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Build event-driven rules to auto-assign tickets via Round-Robin, balance workloads, set due dates, and update statuses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Automation Rule</span>
          </button>
        </div>
      </div>

      {/* Rules List Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Configured Rules</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
              {rules.length}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Loading automation rules...
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
              <Zap className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No automation rules configured yet</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Automate your procurement team workflows by setting up auto-assignment, balanced workload queues, or automated status transitions.
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Rule</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">{rule.name}</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        rule.is_enabled
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {rule.is_enabled ? "Active" : "Disabled"}
                    </span>
                    <span className="text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                      ⚡ When: {TRIGGER_LABELS[rule.trigger_type as AutomationTrigger] || rule.trigger_type}
                    </span>
                  </div>

                  {rule.description && (
                    <p className="text-xs text-slate-500">{rule.description}</p>
                  )}

                  {/* Conditions & Actions Summary */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {rule.conditions?.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        <span className="font-semibold text-slate-500">If:</span>
                        {rule.conditions
                          .map((c) => `${c.field} ${c.operator} ${c.value ?? ""}`)
                          .join(" AND ")}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No conditions (Always runs)</span>
                    )}

                    <span className="text-slate-300">→</span>

                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[11px]">
                      {rule.actions[0]?.action_type === "ASSIGN_ROUND_ROBIN" && (
                        <Shuffle className="w-3 h-3 text-indigo-500" />
                      )}
                      {rule.actions[0]?.action_type === "ASSIGN_BALANCED" && (
                        <Users className="w-3 h-3 text-indigo-500" />
                      )}
                      <span>
                        Then: {ACTION_LABELS[rule.actions[0]?.action_type as AutomationActionType] || rule.actions[0]?.action_type}
                      </span>
                    </span>
                  </div>

                  {/* Execution Stats */}
                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Ran {rule.execution_count} times
                    </span>
                    {rule.last_executed_at && (
                      <span>Last executed: {new Date(rule.last_executed_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-3 self-end md:self-center">
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    title={rule.is_enabled ? "Disable Rule" : "Enable Rule"}
                  >
                    {rule.is_enabled ? (
                      <ToggleRight className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setTestModalRule(rule);
                      setTestTicketId("");
                      setTestResult(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    <Play className="w-3 h-3 text-slate-600 fill-slate-600" />
                    <span>Test Run</span>
                  </button>

                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Automation Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-white rounded-xl max-w-xl w-full p-6 space-y-5 border border-slate-200 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h3 className="text-base font-bold text-slate-900">Create Automation Rule</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Rule Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Auto-Assign Critical Procurement Tickets"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional brief description of what this rule executes"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Trigger */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Trigger Event <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value as AutomationTrigger)}
                  className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="TICKET_CREATED">When Ticket is Created</option>
                  <option value="STATUS_CHANGED">When Status is Changed</option>
                  <option value="FIELD_CHANGED">When Field Value Changes</option>
                  <option value="SLA_BREACHED">When SLA is Breached</option>
                </select>
              </div>

              {/* Condition (Single) */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 block">Condition (Optional Filter)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Field</label>
                    <select
                      value={formConditionField}
                      onChange={(e) => setFormConditionField(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                    >
                      <option value="priority">priority</option>
                      <option value="status">status</option>
                      <option value="ticket_type">ticket_type</option>
                      <option value="category">category</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Operator</label>
                    <select
                      value={formConditionOperator}
                      onChange={(e) => setFormConditionOperator(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                    >
                      <option value="eq">Equals (==)</option>
                      <option value="ne">Not Equals (!=)</option>
                      <option value="in">In List</option>
                      <option value="contains">Contains</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Value</label>
                    <input
                      type="text"
                      value={formConditionValue}
                      onChange={(e) => setFormConditionValue(e.target.value)}
                      placeholder="e.g. CRITICAL"
                      className="w-full text-xs p-1.5 border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 space-y-2">
                <span className="font-bold text-blue-900 block">Action to Execute</span>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Action Type</label>
                  <select
                    value={formActionType}
                    onChange={(e) => setFormActionType(e.target.value as AutomationActionType)}
                    className="w-full text-sm p-2 border border-blue-300 rounded-lg bg-white font-medium text-slate-800"
                  >
                    <option value="ASSIGN_ROUND_ROBIN">Assign via Round-Robin Rotation</option>
                    <option value="ASSIGN_BALANCED">Assign to Lowest Open Ticket Workload</option>
                    <option value="ASSIGN_USER">Assign to Specific User</option>
                    <option value="TRANSITION_STATUS">Transition Status</option>
                    <option value="CHANGE_PRIORITY">Change Priority</option>
                    <option value="SET_DUE_DATE">Set Due Date (Days Offset)</option>
                    <option value="ADD_COMMENT">Post Automated Comment</option>
                  </select>
                </div>

                {(formActionType === "ASSIGN_ROUND_ROBIN" || formActionType === "ASSIGN_BALANCED") && (
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">
                      Candidate User IDs (comma-separated UUIDs)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 00000000-0000-0000-0000-000000000002, 00000000-0000-0000-0000-000000000003"
                      value={formActionCandidateIds}
                      onChange={(e) => setFormActionCandidateIds(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      {formActionType === "ASSIGN_ROUND_ROBIN"
                        ? "Rotates sequentially through these users using atomic Redis counters."
                        : "Queries the active open workload in the database and assigns to whoever has the least open tickets."}
                    </p>
                  </div>
                )}

                {formActionType === "ASSIGN_USER" && (
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Target User ID (UUID)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 00000000-0000-0000-0000-000000000002"
                      value={formActionCandidateIds}
                      onChange={(e) => setFormActionCandidateIds(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded font-mono"
                    />
                  </div>
                )}

                {formActionType === "TRANSITION_STATUS" && (
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Target Status</label>
                    <select
                      value={formActionTargetStatus}
                      onChange={(e) => setFormActionTargetStatus(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="PENDING_RESPONSE">PENDING_RESPONSE</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>
                )}

                {formActionType === "SET_DUE_DATE" && (
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">
                      Days from trigger to set Due Date
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={formActionDueDateDays}
                      onChange={(e) => setFormActionDueDateDays(Number(e.target.value))}
                      className="w-full text-xs p-2 border border-slate-300 rounded"
                    />
                  </div>
                )}

                {formActionType === "ADD_COMMENT" && (
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Comment Content</label>
                    <textarea
                      rows={2}
                      value={formActionComment}
                      onChange={(e) => setFormActionComment(e.target.value)}
                      placeholder="Automated notification message..."
                      className="w-full text-xs p-2 border border-slate-300 rounded"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createRule.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                {createRule.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Automation Rule</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Test Run Modal */}
      {testModalRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form
            onSubmit={handleTestRunSubmit}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Play className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                <span>Test Run: {testModalRule.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setTestModalRule(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Ticket ID (UUID) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter a Ticket UUID to simulate rule execution against"
                value={testTicketId}
                onChange={(e) => setTestTicketId(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs font-mono whitespace-pre-wrap ${
                  testResult.error
                    ? "bg-rose-50 text-rose-800 border border-rose-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
              >
                {JSON.stringify(testResult, null, 2)}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTestModalRule(null)}
                className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={testLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                {testLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Execute Rule</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
