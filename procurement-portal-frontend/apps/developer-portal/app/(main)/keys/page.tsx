"use client";

import React, { useState } from "react";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useWebhooks,
  useCreateWebhook,
  useDeleteWebhook,
  useTestPingWebhook,
  useDeveloperScopes,
  useAppToast,
} from "@procurement/hooks";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Globe,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Radio,
} from "lucide-react";

export default function DeveloperKeysAndWebhooksPage() {
  const { toast } = useAppToast();
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks">("keys");

  // API Keys state
  const { data: keys, isLoading: isKeysLoading } = useApiKeys();
  const createKeyMutation = useCreateApiKey();
  const revokeKeyMutation = useRevokeApiKey();
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read:prs", "read:pos"]);
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhooks state
  const { data: webhooks, isLoading: isWebhooksLoading } = useWebhooks();
  const createWebhookMutation = useCreateWebhook();
  const deleteWebhookMutation = useDeleteWebhook();
  const testPingMutation = useTestPingWebhook();
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [webhookDesc, setWebhookDesc] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["pr.approved", "po.created"]);

  // Available scopes & events
  const { data: scopesData } = useDeveloperScopes();

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    try {
      const res = await createKeyMutation.mutateAsync({
        name: keyName,
        scopes: selectedScopes,
        rate_limit_rpm: 120,
        expires_in_days: 90,
      });
      setCreatedKeySecret(res.key_secret);
      toast.success("API Key Generated", "Copy the key now; it will not be shown again.");
    } catch (err: any) {
      toast.error("Generation Failed", err?.message || "Could not generate API key");
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endpointUrl.trim()) return;
    try {
      await createWebhookMutation.mutateAsync({
        endpoint_url: endpointUrl,
        description: webhookDesc || undefined,
        subscribed_events: selectedEvents,
      });
      setWebhookModalOpen(false);
      setEndpointUrl("");
      setWebhookDesc("");
      toast.success("Webhook Subscribed", "Endpoint registered with HMAC-SHA256 signature verification.");
    } catch (err: any) {
      toast.error("Subscription Failed", err?.message || "Could not register webhook");
    }
  };

  const handleTestPing = async (subId: string) => {
    try {
      const res = await testPingMutation.mutateAsync({
        id: subId,
        payload: { event_type: "ping.test" },
      });
      if (res.is_success) {
        toast.success("Ping Succeeded", `HTTP ${res.response_status_code} in ${res.execution_time_ms}ms`);
      } else {
        toast.error("Ping Failed", res.error_message || "Endpoint returned non-2xx code");
      }
    } catch (err: any) {
      toast.error("Ping Error", err?.message || "Failed to dispatch test ping");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Key className="w-4 h-4" />
            <span>Credentials & Event Subscriptions</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">API Keys & Webhooks</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Manage granular scoped API keys for server integrations and configure HMAC-verified webhook listeners.
          </p>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("keys")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "keys"
                ? "bg-cyan-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            API Keys
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("webhooks")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "webhooks"
                ? "bg-cyan-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Webhooks
          </button>
        </div>
      </div>

      {/* Tab 1: API Keys */}
      {activeTab === "keys" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Active Organization API Keys</h2>
            <button
              type="button"
              onClick={() => {
                setKeyName("");
                setCreatedKeySecret(null);
                setKeyModalOpen(true);
              }}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create API Key</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {isKeysLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Key Name</th>
                    <th className="px-4 py-3">Prefix</th>
                    <th className="px-4 py-3">Scopes</th>
                    <th className="px-4 py-3">Rate Limit</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium text-slate-300">
                  {(keys || []).map((k) => (
                    <tr key={k.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{k.name}</td>
                      <td className="px-4 py-3 font-mono text-cyan-400">{k.key_prefix}...</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 bg-slate-800 text-[10px] rounded text-slate-300">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">{k.rate_limit_rpm} req/min</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(k.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => revokeKeyMutation.mutate({ id: k.id, payload: { reason: "Revoked by user" } })}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(keys || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500">
                        No API keys generated yet. Click &quot;Create API Key&quot; to provision credentials.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Webhook Subscriptions */}
      {activeTab === "webhooks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Registered Webhook Endpoints</h2>
            <button
              type="button"
              onClick={() => setWebhookModalOpen(true)}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Webhook</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {isWebhooksLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {(webhooks || []).map((sub) => (
                  <div key={sub.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-cyan-400" />
                        <span className="font-mono text-xs text-white font-semibold">{sub.endpoint_url}</span>
                        {sub.is_active ? (
                          <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] bg-red-950 text-red-400 border border-red-800 px-1.5 py-0.2 rounded font-semibold">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      {sub.description && <p className="text-xs text-slate-400">{sub.description}</p>}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {sub.subscribed_events.map((ev) => (
                          <span key={ev} className="px-2 py-0.5 bg-slate-800 text-[10px] text-cyan-300 font-mono rounded">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestPing(sub.id)}
                        disabled={testPingMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Test Ping</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWebhookMutation.mutate(sub.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Webhook"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {(webhooks || []).length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    No webhooks registered. Click &quot;Add Webhook&quot; to listen to events.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Key Modal */}
      {keyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Generate New API Key</h3>
              <button
                type="button"
                onClick={() => setKeyModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdKeySecret ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-200 text-xs space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Save Your API Secret Now
                  </span>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    For security reasons, this raw token is never stored in plaintext and will <strong>never be shown again</strong>.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 break-all flex items-center justify-between gap-2">
                  <span>{createdKeySecret}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdKeySecret);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-300"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setKeyModalOpen(false)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
                >
                  I have copied my key
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Key Description / Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., SAP ERP Middleware Integration"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-2">Assigned Scopes</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {(scopesData?.scopes || [
                      { scope: "read:prs", description: "Read requisitions" },
                      { scope: "write:prs", description: "Submit requisitions" },
                      { scope: "read:pos", description: "Read purchase orders" },
                      { scope: "write:pos", description: "Acknowledge purchase orders" },
                      { scope: "read:invoices", description: "Read invoice matches" },
                    ]).map((s: any) => (
                      <label
                        key={s.scope}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(s.scope)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedScopes([...selectedScopes, s.scope]);
                            } else {
                              setSelectedScopes(selectedScopes.filter((x) => x !== s.scope));
                            }
                          }}
                          className="rounded text-cyan-500"
                        />
                        <span className="font-mono text-cyan-400 text-[11px]">{s.scope}</span>
                        <span className="text-slate-500 text-[10px] truncate">— {s.description}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setKeyModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createKeyMutation.isPending}
                    className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl flex items-center gap-1.5"
                  >
                    {createKeyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                    <span>Generate Key</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Create Webhook Modal */}
      {webhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Subscribe Webhook Endpoint</h3>
              <button
                type="button"
                onClick={() => setWebhookModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWebhook} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Payload URL (HTTPS)</label>
                <input
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/webhooks/procureos"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="ERP Order Intake Sync Listener"
                  value={webhookDesc}
                  onChange={(e) => setWebhookDesc(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-2">Subscribed Event Topics</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {[
                    "pr.submitted",
                    "pr.approved",
                    "po.created",
                    "po.acknowledged",
                    "asn.dispatched",
                    "grn.received",
                    "invoice.matched",
                  ].map((ev) => (
                    <label
                      key={ev}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(ev)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEvents([...selectedEvents, ev]);
                          } else {
                            setSelectedEvents(selectedEvents.filter((x) => x !== ev));
                          }
                        }}
                        className="rounded text-cyan-500"
                      />
                      <span className="font-mono text-cyan-400 text-[11px]">{ev}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWebhookModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createWebhookMutation.isPending}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl flex items-center gap-1.5"
                >
                  {createWebhookMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  <span>Register Webhook</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
