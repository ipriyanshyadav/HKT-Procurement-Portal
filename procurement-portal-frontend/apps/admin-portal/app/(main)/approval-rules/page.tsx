"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useApprovalRules,
  useActivateApprovalRule,
  useDeactivateApprovalRule,
  ApprovalRule,
} from "@procurement/hooks";
import {
  PageHeader,
  HeroKPIStrip,
  Card,
  Badge,
  Button,
} from "@procurement/ui";
import {
  Sliders,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Shield,
  Power,
  RotateCcw,
} from "lucide-react";

const ENTITY_TABS = ["ALL", "PR", "RFQ", "PO", "VENDOR", "CONTRACT"] as const;

export default function ApprovalRulesListPage() {
  const [selectedEntity, setSelectedEntity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const queryParams = selectedEntity !== "ALL" ? { entity_type: selectedEntity } : undefined;
  const { data: rules, isLoading, refetch } = useApprovalRules(queryParams);

  const activateMutation = useActivateApprovalRule();
  const deactivateMutation = useDeactivateApprovalRule();

  const filteredRules = (rules || []).filter((rule: ApprovalRule) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      rule.rule_code.toLowerCase().includes(q) ||
      rule.rule_name.toLowerCase().includes(q) ||
      rule.workflow_template_code.toLowerCase().includes(q)
    );
  });

  const totalRules = rules?.length || 0;
  const activeRules = rules?.filter((r) => r.is_active).length || 0;
  const catchAllRules = rules?.filter((r) => r.is_catch_all).length || 0;

  const kpis = [
    { value: totalRules, label: "Configured Rules", sublabel: "Enterprise Policy Matrix" },
    { value: activeRules, label: "Active in Production", sublabel: "Auto-Matching Enabled" },
    { value: catchAllRules, label: "Catch-All Fallbacks", sublabel: "Guaranteed Resolution" },
    { value: 100, label: "Policy Guard", suffix: "%", sublabel: "Audit Version Pinned" },
  ];

  const handleToggleActive = async (rule: ApprovalRule) => {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Rules Engine"
        subtitle="Define dynamic, priority-ranked conditional criteria routing requisitions and tenders to approval matrices."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/approval-rules/new">
              <Button variant="primary" icon={<Plus className="w-4 h-4 mr-1.5" />}>
                Create Rule
              </Button>
            </Link>
          </div>
        }
      />

      <HeroKPIStrip items={kpis} />

      <Card>
        <div className="space-y-4">
          {/* Controls Bar: Tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            {/* Entity Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {ENTITY_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSelectedEntity(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedEntity === tab
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search rule code, name, or template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Rules Table */}
          <div className="apple-table-container">
            <table className="apple-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Rule Identity</th>
                  <th>Entity</th>
                  <th>Conditions / Expression</th>
                  <th>Workflow Template</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-neutral-400 text-xs">
                      Loading approval rules...
                    </td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Sliders className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        No approval rules found
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Create a rule to automate workflow assignment for {selectedEntity} documents.
                      </p>
                      <div className="pt-3">
                        <Link href="/approval-rules/new">
                          <Button variant="primary" size="sm">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Create First Rule
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          P{rule.priority}
                        </span>
                      </td>
                      <td>
                        <div>
                          <div className="font-bold text-neutral-900 dark:text-white text-sm flex items-center gap-1.5">
                            {rule.rule_name}
                            {rule.is_catch_all && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                CATCH-ALL
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-xs text-neutral-400">{rule.rule_code}</div>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                          {rule.entity_type}
                        </span>
                      </td>
                      <td className="max-w-xs truncate">
                        <span className="font-mono text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800/80 px-2 py-1 rounded">
                          {rule.condition_expression || (rule.is_catch_all ? "(Always Matches)" : "None")}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {rule.workflow_template_code}
                        </span>
                      </td>
                      <td>
                        <Badge variant={rule.is_active ? "approved" : "review"}>
                          {rule.is_active ? "ACTIVE" : "INACTIVE"}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(rule)}
                            disabled={activateMutation.isPending || deactivateMutation.isPending}
                            icon={<Power className="w-3.5 h-3.5" />}
                          >
                            {rule.is_active ? "Deactivate" : "Activate"}
                          </Button>
                          <Link href={`/approval-rules/${rule.id}`}>
                            <Button variant="secondary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
