"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Database,
  ExternalLink,
  Layers,
  Network,
  RefreshCw,
  Send,
  ShieldAlert,
  Sliders,
  Zap,
} from "lucide-react";
import {
  useERPMappings,
  useERPReconciliation,
  useTriggerERPSync,
  useRetryERPMapping,
} from "@procurement/hooks";
import type { ERPEntityMapping } from "@procurement/types";

export interface ERPGatewayReconciliationConsoleProps {
  className?: string;
}

export function ERPGatewayReconciliationConsole({
  className = "",
}: ERPGatewayReconciliationConsoleProps) {
  const [activeTab, setActiveTab] = useState<"mappings" | "reconciliation" | "dispatch">("mappings");
  const [selectedErp, setSelectedErp] = useState<string>("ALL");
  const [selectedEntity, setSelectedEntity] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Dispatch Form State
  const [dispatchErp, setDispatchErp] = useState<string>("SAP_S4HANA");
  const [dispatchEntity, setDispatchEntity] = useState<string>("PURCHASE_ORDER");
  const [dispatchId, setDispatchId] = useState<string>("");
  const [dispatchForce, setDispatchForce] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  const { data: mappingsData, isLoading: isMappingsLoading, refetch: refetchMappings } = useERPMappings({
    erp_system: selectedErp === "ALL" ? undefined : selectedErp,
    entity_type: selectedEntity === "ALL" ? undefined : selectedEntity,
    sync_status: selectedStatus === "ALL" ? undefined : selectedStatus,
  });

  const { data: reconData, isLoading: isReconLoading, refetch: refetchRecon } = useERPReconciliation(
    selectedErp === "ALL" ? undefined : selectedErp
  );

  const triggerMutation = useTriggerERPSync();
  const retryMutation = useRetryERPMapping();

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchId.trim()) return;

    try {
      const res = await triggerMutation.mutateAsync({
        erp_system: dispatchErp,
        entity_type: dispatchEntity,
        internal_id: dispatchId.trim(),
        force_retry: dispatchForce,
      });
      setDispatchResult({ success: true, data: res });
    } catch (err: any) {
      setDispatchResult({ success: false, error: err.message || "Dispatch failed" });
    }
  };

  const handleRetry = async (mappingId: string) => {
    await retryMutation.mutateAsync(mappingId);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#1A1A1E] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Total Synced Entities</span>
            <Database className="h-5 w-5 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {reconData?.total_mapped_entities ?? 0}
            </span>
            <span className="text-xs text-neutral-400">records</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-300">System Parity Rate</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-400">
              {reconData?.parity_percentage?.toFixed(1) ?? "100.0"}%
            </span>
            <span className="text-xs text-emerald-400/80">ERP agreement</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1A1A1E] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Connected Gateways</span>
            <Network className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">2 Active</span>
            <span className="text-xs text-neutral-400">SAP S/4HANA & NetSuite</span>
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-300">Dead Letter Queue (DLQ)</span>
            <ShieldAlert className="h-5 w-5 text-red-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-red-400">
              {reconData?.dead_letter_count ?? 0}
            </span>
            <span className="text-xs text-red-400/80">requires intervention</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab("mappings")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "mappings"
              ? "bg-white text-black shadow-sm"
              : "text-neutral-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Layers className="h-4 w-4" />
          Entity Mappings & Logs
        </button>

        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "reconciliation"
              ? "bg-white text-black shadow-sm"
              : "text-neutral-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Sliders className="h-4 w-4" />
          System Parity & DLQ
          {(reconData?.dead_letter_count ?? 0) > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
              {reconData?.dead_letter_count}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("dispatch")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "dispatch"
              ? "bg-white text-black shadow-sm"
              : "text-neutral-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Send className="h-4 w-4" />
          Manual Sync Dispatcher
        </button>
      </div>

      {/* Tab 1: Entity Mappings */}
      {activeTab === "mappings" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1A1A1E] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedErp}
                onChange={(e) => setSelectedErp(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#252529] px-3 py-2 text-xs text-neutral-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All ERP Systems</option>
                <option value="SAP_S4HANA">SAP S/4HANA (IDoc)</option>
                <option value="NETSUITE">NetSuite (SuiteTalk REST)</option>
                <option value="ORACLE_CLOUD">Oracle Cloud</option>
              </select>

              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#252529] px-3 py-2 text-xs text-neutral-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Entity Types</option>
                <option value="PURCHASE_ORDER">Purchase Orders</option>
                <option value="INVOICE">Invoices</option>
                <option value="VENDOR">Vendors</option>
                <option value="GOODS_RECEIPT">Goods Receipts</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#252529] px-3 py-2 text-xs text-neutral-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Sync Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="DEAD_LETTER">Dead Letter</option>
              </select>
            </div>

            <button
              onClick={() => refetchMappings()}
              disabled={isMappingsLoading}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#252529] px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isMappingsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#1A1A1E]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#252529] uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="px-4 py-3">Internal Entity</th>
                  <th className="px-4 py-3">ERP System</th>
                  <th className="px-4 py-3">External Reference</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Checksum</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Synced</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {(mappingsData?.mappings ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-neutral-500 font-sans">
                      No ERP entity mappings found matching criteria.
                    </td>
                  </tr>
                ) : (
                  (mappingsData?.mappings ?? []).map((m) => (
                    <tr key={m.id} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white font-sans">{m.entity_type}</div>
                        <div className="text-[10px] text-neutral-500">{m.internal_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
                          {m.erp_system}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-blue-400">
                        {m.external_id}
                        {m.idoc_number && (
                          <span className="ml-1 text-[10px] text-neutral-500">({m.idoc_number})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-[11px] font-sans font-medium text-neutral-300">
                          {m.sync_direction === "OUTBOUND" ? (
                            <>
                              <ArrowUpRight className="h-3 w-3 text-blue-400" /> Outbound
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="h-3 w-3 text-purple-400" /> Inbound
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-400">
                        {m.payload_checksum ? `${m.payload_checksum.slice(0, 10)}...` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            m.sync_status === "SUCCESS"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : m.sync_status === "DEAD_LETTER"
                              ? "bg-red-500/20 text-red-300 border border-red-500/30"
                              : m.sync_status === "FAILED"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {m.sync_status}
                          {m.retry_count > 0 && ` (${m.retry_count})`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-400 font-sans">
                        {new Date(m.last_synced_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        {(m.sync_status === "FAILED" || m.sync_status === "DEAD_LETTER") && (
                          <button
                            onClick={() => handleRetry(m.id)}
                            disabled={retryMutation.isPending}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: System Parity & DLQ */}
      {activeTab === "reconciliation" && (
        <div className="space-y-6">
          {/* Dead Letter Queue Section */}
          <div className="rounded-2xl border border-red-500/20 bg-[#1A1A1E] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-400" />
                <h3 className="text-base font-semibold text-white">Dead Letter Queue (DLQ)</h3>
              </div>
              <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-300">
                {reconData?.dead_letter_count ?? 0} Failed Transmissions
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Transactions that failed 3 consecutive retry attempts are placed in the Dead Letter Queue to prevent pipeline blockage.
            </p>

            <div className="mt-4 space-y-3">
              {(reconData?.dead_letter_queue ?? []).length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-[#252529]/40 p-6 text-center text-xs text-neutral-400">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400 mb-1" />
                  Dead Letter Queue is empty. All ERP transactions synchronized normally.
                </div>
              ) : (
                (reconData?.dead_letter_queue ?? []).map((dlqItem) => (
                  <div
                    key={dlqItem.id}
                    className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-950/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{dlqItem.entity_type}</span>
                        <span className="font-mono text-xs text-red-300">{dlqItem.external_id}</span>
                        <span className="rounded bg-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-200">
                          {dlqItem.erp_system}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-red-200/80">
                        {dlqItem.last_error || "Max retries exceeded without acknowledgment."}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRetry(dlqItem.id)}
                      disabled={retryMutation.isPending}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Force Re-queue
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Manual Sync Dispatcher */}
      {activeTab === "dispatch" && (
        <div className="rounded-2xl border border-white/10 bg-[#1A1A1E] p-6 shadow-sm">
          <h3 className="text-base font-semibold text-white">Manual ERP Sync Dispatcher</h3>
          <p className="mt-1 text-xs text-neutral-400">
            Dispatch an individual internal document directly to SAP S/4HANA (IDoc ORDERS05/INVOIC02) or NetSuite (SuiteTalk REST).
          </p>

          <form onSubmit={handleDispatch} className="mt-6 max-w-xl space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300">Target ERP Gateway</label>
              <select
                value={dispatchErp}
                onChange={(e) => setDispatchErp(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#252529] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="SAP_S4HANA">SAP S/4HANA (IDoc ORDERS05 / RFC)</option>
                <option value="NETSUITE">NetSuite (SuiteTalk REST API)</option>
                <option value="ORACLE_CLOUD">Oracle Cloud Procurement REST</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300">Entity Type</label>
              <select
                value={dispatchEntity}
                onChange={(e) => setDispatchEntity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#252529] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="PURCHASE_ORDER">Purchase Order (PO)</option>
                <option value="INVOICE">Vendor Invoice (Bill)</option>
                <option value="VENDOR">Vendor Master</option>
                <option value="PAYMENT">Payment Confirmation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300">Internal Entity UUID</label>
              <input
                type="text"
                required
                placeholder="e.g. 7f58a3d1-4e89-4cb2-93b5-..."
                value={dispatchId}
                onChange={(e) => setDispatchId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#252529] px-3 py-2 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="forceRetry"
                checked={dispatchForce}
                onChange={(e) => setDispatchForce(e.target.checked)}
                className="rounded border-white/10 bg-[#252529] text-blue-600"
              />
              <label htmlFor="forceRetry" className="text-xs text-neutral-300">
                Force sync (bypass idempotency cache)
              </label>
            </div>

            <button
              type="submit"
              disabled={triggerMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" />
              {triggerMutation.isPending ? "Dispatching to ERP..." : "Dispatch Document Sync"}
            </button>
          </form>

          {dispatchResult && (
            <div
              className={`mt-6 rounded-xl border p-4 text-xs ${
                dispatchResult.success
                  ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                  : "border-red-500/30 bg-red-950/20 text-red-300"
              }`}
            >
              <div className="font-semibold">
                {dispatchResult.success ? "Sync Succeeded" : "Sync Error"}
              </div>
              <pre className="mt-2 overflow-x-auto font-mono text-[11px]">
                {JSON.stringify(dispatchResult.data || dispatchResult.error, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
