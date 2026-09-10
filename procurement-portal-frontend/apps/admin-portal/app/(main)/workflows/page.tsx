"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkflowTemplates, WorkflowTemplateItem } from "@procurement/hooks";
import { PageHeader, HeroKPIStrip, Card, Badge, Button } from "@procurement/ui";
import {
  GitFork,
  Plus,
  ArrowRight,
  Clock,
  Shield,
  CheckCircle2,
  FileText,
  X,
  Play,
  CheckCircle,
  ArrowDown,
  Edit3,
} from "lucide-react";

const ENTITY_TABS = ["ALL", "PR", "RFQ", "PO", "VENDOR", "CONTRACT"];

export default function WorkflowsListPage() {
  const router = useRouter();
  const [selectedEntity, setSelectedEntity] = useState("ALL");
  const [selectedTemplateForFlow, setSelectedTemplateForFlow] = useState<WorkflowTemplateItem | null>(null);

  const { data: templates, isLoading } = useWorkflowTemplates(
    selectedEntity === "ALL" ? undefined : selectedEntity
  );

  const templateList = templates || [];
  const activeCount = templateList.filter((t) => t.is_active).length;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Workflow Templates & DAG Designer"
        subtitle="Manage multi-step approval chains, SLA escalation parameters, and dual-authorization governance."
        actions={
          <Link href="/workflows/new">
            <Button variant="primary" className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Design New Workflow
            </Button>
          </Link>
        }
      />

      <HeroKPIStrip
        items={[
          { value: templateList.length, label: "Defined Templates", sublabel: "Approval chains" },
          { value: activeCount, label: "Active Workflows", sublabel: "In execution" },
          { value: 4, label: "Entity Types", sublabel: "PR · RFQ · PO · Vendor" },
          { value: 100, label: "Audit Compliance", suffix: "%", sublabel: "Four-eyes verified" },
        ]}
      />

      {/* Entity Tabs */}
      <div className="w-full flex items-center gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-900/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        {ENTITY_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSelectedEntity(tab)}
            className={`flex-1 flex items-center justify-center py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl text-center transition-all ${
              selectedEntity === tab
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
            }`}
          >
            {tab === "ALL" ? "All Entities" : tab}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-neutral-400 text-sm">
          Loading workflow templates...
        </div>
      ) : templateList.length === 0 ? (
        <Card className="py-16 text-center text-neutral-400 text-sm space-y-3">
          <GitFork className="w-10 h-10 text-neutral-300 mx-auto" />
          <p>No workflow templates found for {selectedEntity}.</p>
          <Link href="/workflows/new">
            <Button variant="secondary" className="text-xs">
              Create First Template
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templateList.map((tpl) => (
            <Card
              key={tpl.id}
              onClick={() => setSelectedTemplateForFlow(tpl)}
              className="p-5 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500/50 transition-all flex flex-col justify-between space-y-4 shadow-sm group cursor-pointer hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    {tpl.code}
                  </span>
                  <Badge variant={tpl.is_active ? "success" : "neutral"}>
                    {tpl.is_active ? "ACTIVE" : "INACTIVE"}
                  </Badge>
                </div>

                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 transition-colors">
                    {tpl.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Target Entity: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{tpl.entity_type}</span>
                  </p>
                </div>

                {/* Steps Visual Ribbon */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5">
                  <div className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
                    <GitFork className="w-3.5 h-3.5 text-blue-500" />
                    <span>{tpl.steps ? tpl.steps.length : 0} Configured Steps:</span>
                  </div>
                  <div className="space-y-1">
                    {(tpl.steps || []).map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-neutral-50 dark:bg-neutral-800/60"
                      >
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {idx + 1}. {step.name || `Step ${idx + 1}`}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {step.approver_role} · {step.timeout_hours}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
                <span>Created {tpl.created_at ? new Date(tpl.created_at).toLocaleDateString() : "System"}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTemplateForFlow(tpl);
                  }}
                  className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1 hover:underline cursor-pointer"
                >
                  View Flow <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Visual Workflow Flow Modal */}
      {selectedTemplateForFlow && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <GitFork className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                      {selectedTemplateForFlow.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        {selectedTemplateForFlow.code}
                      </span>
                      <span className="text-xs text-neutral-500">
                        Target: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{selectedTemplateForFlow.entity_type}</span>
                      </span>
                      <Badge variant={selectedTemplateForFlow.is_active ? "success" : "neutral"}>
                        {selectedTemplateForFlow.is_active ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link href={`/workflows/${selectedTemplateForFlow.id}`}>
                  <Button variant="secondary" className="text-xs flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" /> Edit Template
                  </Button>
                </Link>
                <button
                  onClick={() => setSelectedTemplateForFlow(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Interactive DAG Visualizer */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-neutral-50/50 dark:bg-neutral-900/50">
              {/* DAG Canvas Card */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Directed Acyclic Graph (DAG) Approval Topology
                  </h3>
                  <span className="text-xs font-mono text-neutral-400">
                    Total SLA: {selectedTemplateForFlow.steps.reduce((acc, s) => acc + (s.timeout_hours || 0), 0)}h
                  </span>
                </div>

                {/* Vertical Step Flow */}
                <div className="flex flex-col items-center space-y-2 py-2">
                  {/* Start Node */}
                  <div className="px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-xs">
                    <Play className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                    <span>Trigger: {selectedTemplateForFlow.entity_type} Submitted</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="h-6 w-0.5 bg-neutral-300 dark:bg-neutral-700" />
                    <ArrowDown className="w-4 h-4 text-neutral-400 -mt-1" />
                  </div>

                  {/* Sequential Steps */}
                  {selectedTemplateForFlow.steps.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <div className="w-full max-w-lg p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-xs space-y-3 shadow-xs hover:border-blue-400 transition">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                              {step.step_number}
                            </span>
                            <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                              {step.name || `Step ${step.step_number}`}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-md bg-white dark:bg-neutral-800 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900 font-semibold">
                            <Shield className="w-3 h-3 text-blue-500" />
                            {step.approver_role}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-blue-100 dark:border-blue-900/40 text-[11px] text-neutral-600 dark:text-neutral-400">
                          <span className="flex items-center gap-1 bg-white dark:bg-neutral-800 px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span className="font-medium">{step.timeout_hours} Hours Escalation SLA</span>
                          </span>

                          <span className="bg-white dark:bg-neutral-800 px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 font-mono text-[10px]">
                            {step.condition ? (
                              <span className="text-neutral-700 dark:text-neutral-300 font-semibold">Rule: {step.condition}</span>
                            ) : (
                              <span className="text-neutral-400">Unconditional</span>
                            )}
                          </span>

                          <span className="bg-white dark:bg-neutral-800 px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700">
                            {step.require_all ? (
                              <span className="text-purple-600 dark:text-purple-400 font-semibold">Consensus (All Required)</span>
                            ) : (
                              <span className="text-neutral-500">First Response</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Arrow Connector */}
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-0.5 bg-neutral-300 dark:bg-neutral-700" />
                        <ArrowDown className="w-4 h-4 text-neutral-400 -mt-1" />
                      </div>
                    </React.Fragment>
                  ))}

                  {/* Terminal Node */}
                  <div className="px-4 py-2 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-2 shadow-sm">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                    <span>Terminal State: APPROVED & Dispatched</span>
                  </div>
                </div>
              </div>

              {/* Step Parameters Breakdown Table */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Step Parameter Breakdown
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700 text-neutral-500 font-semibold uppercase">
                        <th className="p-2.5 text-center">#</th>
                        <th className="p-2.5">Step Name</th>
                        <th className="p-2.5">Role</th>
                        <th className="p-2.5 text-center">SLA Timeout</th>
                        <th className="p-2.5">Condition Expression</th>
                        <th className="p-2.5 text-center">Approver Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {selectedTemplateForFlow.steps.map((st) => (
                        <tr key={st.step_number} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                          <td className="p-2.5 text-center font-bold text-neutral-400">{st.step_number}</td>
                          <td className="p-2.5 font-medium text-neutral-900 dark:text-neutral-100">{st.name}</td>
                          <td className="p-2.5 font-mono text-blue-600 dark:text-blue-400">{st.approver_role}</td>
                          <td className="p-2.5 text-center font-mono">{st.timeout_hours}h</td>
                          <td className="p-2.5 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                            {st.condition || "Always evaluates true"}
                          </td>
                          <td className="p-2.5 text-center">
                            {st.require_all ? (
                              <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold text-[10px]">
                                Unanimous
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[10px]">
                                Any Approver
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                Template ID: <span className="font-mono">{selectedTemplateForFlow.id}</span>
              </span>

              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setSelectedTemplateForFlow(null)} className="text-xs">
                  Close
                </Button>
                <Link href={`/workflows/${selectedTemplateForFlow.id}`}>
                  <Button variant="primary" className="text-xs flex items-center gap-1.5">
                    <span>Open in Full DAG Designer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
