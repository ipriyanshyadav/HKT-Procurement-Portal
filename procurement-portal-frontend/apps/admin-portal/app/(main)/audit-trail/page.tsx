"use client";

import React, { useState } from "react";
import {
  PageHeader,
  HeroKPIStrip,
  Card,
  Badge,
  Button,
  Input,
  SearchInput,
  Select,
  Modal,
} from "@procurement/ui";
import {
  ShieldCheck,
  Filter,
  RotateCcw,
  Database,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { useAuditLogs, type AuditLogEntry } from "@procurement/hooks";

const ENTITY_OPTIONS = [
  { value: "", label: "All Entity Types" },
  { value: "REQUISITION", label: "Requisition (PR)" },
  { value: "RFQ", label: "Request for Quote (RFQ)" },
  { value: "BID", label: "Bid" },
  { value: "PURCHASE_ORDER", label: "Purchase Order (PO)" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INVOICE", label: "Invoice" },
  { value: "PAYMENT", label: "Payment" },
  { value: "VENDOR", label: "Vendor" },
  { value: "USER", label: "User / Auth" },
  { value: "WORKFLOW", label: "Workflow Task" },
  { value: "MASTER_DATA", label: "Master Data" },
];

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "APPROVE", label: "Approve" },
  { value: "REJECT", label: "Reject" },
  { value: "DELETE", label: "Delete" },
  { value: "LOGIN", label: "Login" },
  { value: "PUBLISH", label: "Publish" },
  { value: "SUBMIT", label: "Submit" },
];

export default function AuditTrailPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [activeLog, setActiveLog] = useState<AuditLogEntry | null>(null);
  const [copiedTraceId, setCopiedTraceId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useAuditLogs({
    search: searchTerm || undefined,
    entity_type: selectedEntity || undefined,
    action: selectedAction || undefined,
    actor_email: actorEmail || undefined,
    date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
    page,
    page_size: pageSize,
  });

  const logs = data?.items || [];
  const totalLogs = data?.total || 0;
  const totalPages = Math.ceil(totalLogs / pageSize) || 1;

  const handleReset = () => {
    setSearchTerm("");
    setSelectedEntity("");
    setSelectedAction("");
    setActorEmail("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const copyTrace = (traceId: string) => {
    navigator.clipboard.writeText(traceId);
    setCopiedTraceId(traceId);
    setTimeout(() => setCopiedTraceId(null), 2000);
  };

  const kpiItems = [
    {
      value: totalLogs,
      label: "Indexed Events",
      sublabel: "Elasticsearch 8.14 cluster",
    },
    {
      value: 100,
      label: "Immutability Guarantee",
      suffix: "%",
      sublabel: "Append-only SQL + ES log",
    },
    {
      value: 30,
      label: "Monthly Rotation",
      suffix: "d",
      sublabel: "audit-logs-YYYY.MM ILM policy",
    },
    {
      value: 365,
      label: "Retention Period",
      suffix: "d",
      sublabel: "Automated delete phase",
    },
  ];

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("APPROV") || act.includes("CREATE") || act.includes("PUBLISH")) {
      return <Badge variant="success">{action}</Badge>;
    }
    if (act.includes("REJECT") || act.includes("FAIL") || act.includes("DELETE")) {
      return <Badge variant="error">{action}</Badge>;
    }
    if (act.includes("WARN") || act.includes("HOLD") || act.includes("LATE")) {
      return <Badge variant="warning">{action}</Badge>;
    }
    return <Badge variant="info">{action}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Audit Trail & Security Telemetry"
        subtitle="Immutable Elasticsearch-backed governance and security event log with millisecond trace resolution."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Audit Trail" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      <HeroKPIStrip items={kpiItems} />

      {/* Filter Toolbar */}
      <Card className="p-4 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
            <Filter className="w-4 h-4 text-blue-500" />
            <span>Search & Query Filters</span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-neutral-500 hover:text-blue-500 transition-colors"
          >
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <SearchInput
              placeholder="Search actions, emails, trace IDs..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <Select
              options={ENTITY_OPTIONS}
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <Select
              options={ACTION_OPTIONS}
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <Input
              type="date"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <Input
              type="date"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="overflow-hidden border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Audit Event Stream
            </h3>
            <Badge variant="neutral">
              {totalLogs} {totalLogs === 1 ? "event" : "events"}
            </Badge>
          </div>
          <span className="text-xs text-neutral-500">
            Page {page} of {totalPages}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/75 dark:bg-neutral-900/75 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Trace ID</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span>Querying Elasticsearch cluster...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldCheck className="w-8 h-8 text-neutral-300 dark:text-neutral-700" />
                      <span>No audit log records match the current filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-neutral-600 dark:text-neutral-400 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {log.entity_type}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400 truncate max-w-[120px]">
                          {log.entity_id}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-neutral-800 dark:text-neutral-200">
                          {log.actor_email || "System Automated"}
                        </span>
                        {log.actor_ip && (
                          <span className="font-mono text-[10px] text-neutral-400">
                            {log.actor_ip}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.trace_id ? (
                        <button
                          onClick={() => copyTrace(log.trace_id!)}
                          className="flex items-center gap-1.5 font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline bg-blue-50/70 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50"
                          title="Click to copy OpenTelemetry Trace ID"
                        >
                          {copiedTraceId === log.trace_id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3 text-blue-400" />
                          )}
                          <span>{log.trace_id.slice(0, 8)}...</span>
                        </button>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveLog(log)}
                        className="text-xs h-7 px-2"
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
            <span>
              Showing {logs.length ? (page - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(page * pageSize, totalLogs)} of {totalLogs} events
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="px-2 font-medium">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Inspection Modal */}
      {activeLog && (
        <Modal
          isOpen={true}
          onClose={() => setActiveLog(null)}
          title={`Audit Record: ${activeLog.action} (${activeLog.entity_type})`}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-neutral-50 dark:bg-neutral-900 p-2.5 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-400 block mb-0.5">Event ID</span>
                <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200 select-all">
                  {activeLog.id}
                </span>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-900 p-2.5 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-400 block mb-0.5">Entity ID</span>
                <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200 select-all">
                  {activeLog.entity_id}
                </span>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-900 p-2.5 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-400 block mb-0.5">Actor</span>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {activeLog.actor_email || activeLog.actor_id || "System"}
                </span>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-900 p-2.5 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-400 block mb-0.5">Trace Context</span>
                <span className="font-mono font-medium text-blue-600 dark:text-blue-400 select-all">
                  {activeLog.trace_id || "None"}
                </span>
              </div>
            </div>

            {/* Changed Values Diff */}
            {(activeLog.old_values || activeLog.new_values) && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  State Mutation Snapshot
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] font-medium text-red-500 block mb-1">
                      Previous State (old_values)
                    </span>
                    <pre className="bg-red-50/50 dark:bg-red-950/20 text-neutral-800 dark:text-neutral-200 p-2.5 rounded border border-red-200/60 dark:border-red-900/40 text-[11px] font-mono overflow-x-auto">
                      {JSON.stringify(activeLog.old_values, null, 2) || "{}"}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-emerald-500 block mb-1">
                      Updated State (new_values)
                    </span>
                    <pre className="bg-emerald-50/50 dark:bg-emerald-950/20 text-neutral-800 dark:text-neutral-200 p-2.5 rounded border border-emerald-200/60 dark:border-emerald-900/40 text-[11px] font-mono overflow-x-auto">
                      {JSON.stringify(activeLog.new_values, null, 2) || "{}"}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Field Changes */}
            {activeLog.field_changes && Object.keys(activeLog.field_changes).length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Delta Attributes (field_changes)
                </h4>
                <pre className="bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 p-2.5 rounded border border-neutral-200 dark:border-neutral-800 text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(activeLog.field_changes, null, 2)}
                </pre>
              </div>
            )}

            {/* Metadata */}
            {activeLog.metadata && Object.keys(activeLog.metadata).length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Telemetry Metadata
                </h4>
                <pre className="bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 p-2.5 rounded border border-neutral-200 dark:border-neutral-800 text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(activeLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
