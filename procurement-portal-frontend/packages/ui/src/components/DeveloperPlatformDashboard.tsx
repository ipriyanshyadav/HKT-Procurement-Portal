"use client";

import React, { useState } from "react";
import {
  Key,
  Webhook,
  Code2,
  Plus,
  Trash2,
  Send,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Activity,
  Layers,
  Terminal,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useWebhooks,
  useCreateWebhook,
  useDeleteWebhook,
  useTestPingWebhook,
  useWebhookDeliveries,
  useDeveloperScopes,
} from "@procurement/hooks";
import type { ApiKeyCreatedResponse, WebhookSubscriptionResponse } from "@procurement/types";

export function DeveloperPlatformDashboard() {
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks" | "quickstart">("keys");

  // API Key state
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read:prs", "read:pos"]);
  const [newKeyRpm, setNewKeyRpm] = useState(120);
  const [newKeyExpiryDays, setNewKeyExpiryDays] = useState(90);
  const [revealedKey, setRevealedKey] = useState<ApiKeyCreatedResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhook state
  const [showCreateWebhookModal, setShowCreateWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDesc, setWebhookDesc] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["po.created", "asn.dispatched"]);
  const [activeWebhookForLogs, setActiveWebhookForLogs] = useState<WebhookSubscriptionResponse | null>(null);
  const [testPingResult, setTestPingResult] = useState<{ id: string; success: boolean; status?: number; time?: number } | null>(null);

  // Queries & Mutations
  const { data: apiKeys = [], isLoading: loadingKeys, refetch: refetchKeys } = useApiKeys();
  const createKeyMutation = useCreateApiKey();
  const revokeKeyMutation = useRevokeApiKey();

  const { data: webhooks = [], isLoading: loadingWebhooks, refetch: refetchWebhooks } = useWebhooks();
  const createWebhookMutation = useCreateWebhook();
  const deleteWebhookMutation = useDeleteWebhook();
  const testPingMutation = useTestPingWebhook();
  const { data: deliveryLogs = [], isLoading: loadingLogs } = useWebhookDeliveries(activeWebhookForLogs?.id || "");

  const { data: scopesData } = useDeveloperScopes();
  const availableScopes = scopesData?.scopes || [
    { scope: "read:prs", description: "Read purchase requisitions" },
    { scope: "write:prs", description: "Create purchase requisitions" },
    { scope: "read:pos", description: "Read purchase orders" },
    { scope: "write:pos", description: "Acknowledge purchase orders" },
    { scope: "read:asns", description: "Read advance shipping notices" },
    { scope: "write:asns", description: "Dispatch advance shipping notices" },
    { scope: "read:invoices", description: "Read invoices and matching results" },
    { scope: "read:analytics", description: "Read spend cube and rollup metrics" },
  ];

  const availableEvents = scopesData?.webhook_events || [
    { event: "pr.submitted", description: "Requisition submitted" },
    { event: "pr.approved", description: "Requisition approved" },
    { event: "po.created", description: "Purchase order created" },
    { event: "po.acknowledged", description: "PO acknowledged by vendor" },
    { event: "asn.dispatched", description: "ASN shipment dispatched" },
    { event: "grn.received", description: "GRN warehouse intake confirmed" },
    { event: "invoice.matched", description: "Invoice 3-way matched" },
  ];

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;
    createKeyMutation.mutate(
      {
        name: newKeyName,
        scopes: newKeyScopes,
        rate_limit_rpm: newKeyRpm,
        expires_in_days: newKeyExpiryDays,
      },
      {
        onSuccess: (data) => {
          setRevealedKey(data);
          setShowCreateKeyModal(false);
          setNewKeyName("");
        },
      }
    );
  };

  const handleCreateWebhook = () => {
    if (!webhookUrl.trim() || webhookEvents.length === 0) return;
    createWebhookMutation.mutate(
      {
        endpoint_url: webhookUrl,
        description: webhookDesc,
        subscribed_events: webhookEvents,
      },
      {
        onSuccess: () => {
          setShowCreateWebhookModal(false);
          setWebhookUrl("");
          setWebhookDesc("");
        },
      }
    );
  };

  const handleTestPing = (subId: string) => {
    testPingMutation.mutate(
      { id: subId, payload: { event_type: "ping.test" } },
      {
        onSuccess: (data) => {
          setTestPingResult({
            id: subId,
            success: data.is_success,
            status: data.response_status_code || 0,
            time: data.execution_time_ms || 0,
          });
          setTimeout(() => setTestPingResult(null), 6000);
        },
      }
    );
  };

  const handleCopyKey = () => {
    if (revealedKey?.key_secret) {
      navigator.clipboard.writeText(revealedKey.key_secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 3000);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2e2e32] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-500 mb-1">
            <Terminal className="w-4 h-4" />
            Developer Platform & Extensibility
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            API Keys & Webhooks Hub
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage programmatic credentials, webhook delivery pipelines, and integrate external ERPs & microservices.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "keys" && (
            <button
              type="button"
              onClick={() => setShowCreateKeyModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Generate API Key
            </button>
          )}
          {activeTab === "webhooks" && (
            <button
              type="button"
              onClick={() => setShowCreateWebhookModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Register Webhook
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2e2e32]">
        <button
          type="button"
          onClick={() => setActiveTab("keys")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "keys"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          API Keys ({apiKeys.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("webhooks")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "webhooks"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Webhook className="w-3.5 h-3.5" />
          Webhooks ({webhooks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("quickstart")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "quickstart"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          Quickstart & SDK Samples
        </button>
      </div>

      {/* TAB 1: API KEYS */}
      {activeTab === "keys" && (
        <div className="space-y-6">
          <div className="bg-[#1C1C1F] border border-[#2e2e32] rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#2e2e32] flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Active & Revoked API Credentials</span>
              <button
                type="button"
                onClick={() => refetchKeys()}
                className="text-neutral-400 hover:text-white text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {loadingKeys ? (
              <div className="p-8 text-center text-xs text-neutral-500">Loading API keys...</div>
            ) : apiKeys.length === 0 ? (
              <div className="p-12 text-center">
                <Key className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-white">No API Keys Generated</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  Create a programmatic API key to authenticate external backend systems, ERP batch scripts, or customs pipelines.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateKeyModal(true)}
                  className="mt-4 px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-black hover:bg-amber-400"
                >
                  Generate First Key
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#2e2e32]">
                {apiKeys.map((key) => {
                  const isRevoked = key.status === "REVOKED";
                  return (
                    <div key={key.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#252529]/40 transition-colors">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-white text-sm">{key.name}</span>
                          <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px] text-amber-400">
                            {key.key_prefix}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            key.status === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-red-500/15 text-red-400 border border-red-500/30"
                          }`}>
                            {key.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {key.scopes.map((scope, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-[#252529] border border-[#2e2e32] text-neutral-300 font-mono">
                              {scope}
                            </span>
                          ))}
                          <span className="text-[11px] text-neutral-500 ml-2">
                            • {key.rate_limit_rpm} req/min
                          </span>
                        </div>

                        <div className="text-[11px] text-neutral-500 flex items-center gap-3 pt-0.5">
                          <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                          {key.last_used_at && (
                            <span>Last Used: {new Date(key.last_used_at).toLocaleString()}</span>
                          )}
                          <span>Total Calls: {key.total_requests.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {!isRevoked && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Revoke API Key "${key.name}"? External integrations using this key will immediately fail.`)) {
                                revokeKeyMutation.mutate({ id: key.id, payload: { reason: "User manual revocation" } });
                              }
                            }}
                            disabled={revokeKeyMutation.isPending}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 transition-colors"
                          >
                            Revoke Key
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WEBHOOKS */}
      {activeTab === "webhooks" && (
        <div className="space-y-6">
          <div className="bg-[#1C1C1F] border border-[#2e2e32] rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#2e2e32] flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Registered Webhook Endpoints</span>
              <button
                type="button"
                onClick={() => refetchWebhooks()}
                className="text-neutral-400 hover:text-white text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {loadingWebhooks ? (
              <div className="p-8 text-center text-xs text-neutral-500">Loading webhooks...</div>
            ) : webhooks.length === 0 ? (
              <div className="p-12 text-center">
                <Webhook className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-white">No Webhooks Registered</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  Register HTTPS endpoints to receive real-time JSON payloads for PO releases, ASN receipts, or invoice approvals.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateWebhookModal(true)}
                  className="mt-4 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500"
                >
                  Register First Webhook
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#2e2e32]">
                {webhooks.map((hook) => (
                  <div key={hook.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#252529]/40 transition-colors">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-400 truncate max-w-md">
                          {hook.endpoint_url}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          hook.is_active
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                        }`}>
                          {hook.is_active ? "ACTIVE" : "DISABLED"}
                        </span>
                      </div>

                      {hook.description && (
                        <p className="text-xs text-neutral-400">{hook.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-neutral-500">Events:</span>
                        {hook.subscribed_events.map((ev, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-[#252529] border border-[#2e2e32] text-neutral-300 font-mono">
                            {ev}
                          </span>
                        ))}
                      </div>

                      <div className="text-[11px] text-neutral-500 flex items-center gap-3 pt-0.5">
                        <span>Signing Token: <code className="font-mono text-[10px] text-neutral-400">whsec_••••••••</code></span>
                        {hook.last_delivery_at && (
                          <span>Last Delivery: {new Date(hook.last_delivery_at).toLocaleTimeString()} ({hook.last_delivery_status})</span>
                        )}
                        {hook.failure_count > 0 && (
                          <span className="text-red-400 font-semibold">{hook.failure_count} consecutive failures</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTestPing(hook.id)}
                        disabled={testPingMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#252529] hover:bg-[#2e2e32] border border-[#2e2e32] text-neutral-200 transition-colors"
                      >
                        <Send className="w-3 h-3 text-blue-400" />
                        Test Ping
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveWebhookForLogs(hook)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#252529] hover:bg-[#2e2e32] border border-[#2e2e32] text-neutral-200 transition-colors"
                      >
                        Logs
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Delete this webhook subscription?")) {
                            deleteWebhookMutation.mutate(hook.id);
                          }
                        }}
                        className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors"
                        title="Delete Webhook"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Test Ping Result Banner */}
          {testPingResult && (
            <div className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in duration-150 ${
              testPingResult.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}>
              <div className="flex items-center gap-2 text-xs">
                {testPingResult.success ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>
                  {testPingResult.success
                    ? `Webhook test ping delivered successfully! HTTP ${testPingResult.status} in ${testPingResult.time}ms.`
                    : `Webhook test ping failed with status ${testPingResult.status || "Connection Error"}. Check endpoint logs.`}
                </span>
              </div>
            </div>
          )}

          {/* Webhook Delivery Logs Drawer/Modal */}
          {activeWebhookForLogs && (
            <div className="bg-[#1C1C1F] border border-[#2e2e32] rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#2e2e32] pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-white">Delivery History</h3>
                  <div className="font-mono text-xs text-neutral-400">{activeWebhookForLogs.endpoint_url}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveWebhookForLogs(null)}
                  className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded bg-[#252529]"
                >
                  Close
                </button>
              </div>

              {loadingLogs ? (
                <div className="py-6 text-center text-xs text-neutral-500">Loading delivery attempts...</div>
              ) : deliveryLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-500">No delivery logs recorded yet.</div>
              ) : (
                <div className="divide-y divide-[#2e2e32] max-h-64 overflow-y-auto">
                  {deliveryLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          log.is_success ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {log.response_status_code || "ERR"}
                        </span>
                        <span className="text-neutral-300">{log.event_type}</span>
                      </div>
                      <div className="text-neutral-500 flex items-center gap-3 text-[11px]">
                        <span>{log.execution_time_ms}ms</span>
                        <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: QUICKSTART & SAMPLES */}
      {activeTab === "quickstart" && (
        <div className="space-y-6">
          <div className="bg-[#1C1C1F] border border-[#2e2e32] rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white">Authentication via API Key</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Pass your API key in the <code className="text-amber-400 font-mono">X-API-Key</code> request header.
              </p>
            </div>

            {/* cURL */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-300">cURL Example</span>
              <pre className="p-4 rounded-lg bg-[#252529] border border-[#2e2e32] text-xs font-mono text-neutral-200 overflow-x-auto">
{`curl -X GET "http://localhost:8000/api/v1/purchase-orders" \\
  -H "X-API-Key: hkt_live_your_api_key_here" \\
  -H "Accept: application/json"`}
              </pre>
            </div>

            {/* Python */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-300">Python (requests)</span>
              <pre className="p-4 rounded-lg bg-[#252529] border border-[#2e2e32] text-xs font-mono text-neutral-200 overflow-x-auto">
{`import requests

url = "http://localhost:8000/api/v1/purchase-orders"
headers = {
    "X-API-Key": "hkt_live_your_api_key_here",
    "Accept": "application/json"
}

response = requests.get(url, headers=headers)
data = response.json()
print("Retrieved POs:", len(data.get("data", [])))`}
              </pre>
            </div>

            {/* Node.js */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-300">Node.js (Fetch)</span>
              <pre className="p-4 rounded-lg bg-[#252529] border border-[#2e2e32] text-xs font-mono text-neutral-200 overflow-x-auto">
{`const response = await fetch("http://localhost:8000/api/v1/purchase-orders", {
  headers: {
    "X-API-Key": "hkt_live_your_api_key_here",
    "Accept": "application/json",
  },
});
const result = await response.json();
console.log(result.data);`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE API KEY */}
      {showCreateKeyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-[#1C1C1F] border border-[#2e2e32] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-white">Generate Programmatic API Key</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Configure permission scopes and rate limits for this external credential.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-300 mb-1">Key Description / Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. SAP ERP PO Connector"
                  className="w-full px-3 py-2 bg-[#252529] border border-[#2e2e32] rounded-lg text-neutral-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 mb-2">Permission Scopes</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {availableScopes.map((s) => {
                    const isChecked = newKeyScopes.includes(s.scope);
                    return (
                      <label
                        key={s.scope}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-amber-500/10 border-amber-500/40 text-neutral-200"
                            : "bg-[#252529] border-[#2e2e32] text-neutral-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyScopes([...newKeyScopes, s.scope]);
                            } else {
                              setNewKeyScopes(newKeyScopes.filter((sc) => sc !== s.scope));
                            }
                          }}
                          className="mt-0.5 rounded border-neutral-700 bg-neutral-800 text-amber-500"
                        />
                        <div>
                          <div className="font-mono text-xs font-semibold text-white">{s.scope}</div>
                          <div className="text-[11px] text-neutral-400">{s.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-neutral-300 mb-1">Rate Limit (RPM)</label>
                  <input
                    type="number"
                    value={newKeyRpm}
                    onChange={(e) => setNewKeyRpm(Number(e.target.value))}
                    min={10}
                    max={1000}
                    className="w-full px-3 py-1.5 bg-[#252529] border border-[#2e2e32] rounded-lg text-neutral-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-300 mb-1">Expiration</label>
                  <select
                    value={newKeyExpiryDays}
                    onChange={(e) => setNewKeyExpiryDays(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#252529] border border-[#2e2e32] rounded-lg text-neutral-200"
                  >
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={180}>180 Days</option>
                    <option value={365}>1 Year</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2e2e32]">
              <button
                type="button"
                onClick={() => setShowCreateKeyModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || createKeyMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {createKeyMutation.isPending ? "Generating..." : "Generate Secret Key"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SECRET REVEAL (ONCE) */}
      {revealedKey && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-[#1C1C1F] border border-amber-500/50 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">API Key Created Successfully</h3>
                <p className="text-xs text-amber-400/90 font-medium">
                  Copy this key now. For security, you will never be able to view it again.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#252529] border border-[#2e2e32] rounded-xl space-y-2">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Raw API Secret Key
              </span>
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-xs text-white break-all select-all">
                  {revealedKey.key_secret}
                </code>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-black hover:bg-amber-400 shrink-0"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setRevealedKey(null)}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
              >
                I have stored this secret safely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER WEBHOOK */}
      {showCreateWebhookModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-[#1C1C1F] border border-[#2e2e32] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-white">Register Webhook Endpoint</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Receive signed JSON events over HTTPS with automated HMAC verification.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-300 mb-1">Target Endpoint URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://api.yourcompany.com/webhooks/procurement"
                  className="w-full px-3 py-2 bg-[#252529] border border-[#2e2e32] rounded-lg text-neutral-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={webhookDesc}
                  onChange={(e) => setWebhookDesc(e.target.value)}
                  placeholder="e.g. ERP Inbound PO listener"
                  className="w-full px-3 py-2 bg-[#252529] border border-[#2e2e32] rounded-lg text-neutral-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 mb-2">Subscribed Event Topics</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {availableEvents.map((ev) => {
                    const isChecked = webhookEvents.includes(ev.event);
                    return (
                      <label
                        key={ev.event}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-blue-500/10 border-blue-500/40 text-neutral-200"
                            : "bg-[#252529] border-[#2e2e32] text-neutral-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWebhookEvents([...webhookEvents, ev.event]);
                            } else {
                              setWebhookEvents(webhookEvents.filter((item) => item !== ev.event));
                            }
                          }}
                          className="mt-0.5 rounded border-neutral-700 bg-neutral-800 text-blue-500"
                        />
                        <div>
                          <div className="font-mono text-xs font-semibold text-white">{ev.event}</div>
                          <div className="text-[11px] text-neutral-400">{ev.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2e2e32]">
              <button
                type="button"
                onClick={() => setShowCreateWebhookModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateWebhook}
                disabled={!webhookUrl.trim() || webhookEvents.length === 0 || createWebhookMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {createWebhookMutation.isPending ? "Registering..." : "Register Webhook"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
