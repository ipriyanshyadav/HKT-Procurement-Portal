"use client";

import React, { useState } from "react";
import {
  useTenantWebhooks,
  useTenantWebhookEvents,
  useCreateTenantWebhook,
  useUpdateTenantWebhook,
  useDeleteTenantWebhook,
  useRotateTenantWebhookSecret,
  useTestTenantWebhook,
  useTenantWebhookDeliveries,
  TenantWebhookEndpoint,
  TenantWebhookDeliveryItem,
  TenantWebhookTestResult,
} from "@procurement/hooks";
import { useAppToast } from "@procurement/hooks";
import {
  Webhook,
  Plus,
  RefreshCw,
  Search,
  Check,
  Copy,
  Trash2,
  Play,
  RotateCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Shield,
  X,
  Loader2,
} from "lucide-react";

export default function WebhookManagementPage() {
  const { toast } = useAppToast();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<TenantWebhookEndpoint | null>(null);
  const [isDeliveriesOpen, setIsDeliveriesOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [testEventType, setTestEventType] = useState("pr.created");
  const [testResult, setTestResult] = useState<TenantWebhookTestResult | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formMaxRetries, setFormMaxRetries] = useState(5);
  const [formTimeout, setFormTimeout] = useState(30);

  // Queries & Mutations
  const { data: webhooks = [], isLoading, refetch } = useTenantWebhooks();
  const { data: availableEvents = [] } = useTenantWebhookEvents();
  const createMutation = useCreateTenantWebhook();
  const updateMutation = useUpdateTenantWebhook();
  const deleteMutation = useDeleteTenantWebhook();
  const rotateMutation = useRotateTenantWebhookSecret();
  const testMutation = useTestTenantWebhook();

  const { data: deliveries = [], isLoading: isDeliveriesLoading } = useTenantWebhookDeliveries(
    selectedWebhook?.id || null
  );

  const filteredWebhooks = webhooks.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.url.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = webhooks.filter((w) => w.is_active).length;
  const failingCount = webhooks.filter((w) => w.failure_count > 0).length;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim() || formEvents.length === 0) {
      toast.error("Validation Error", "Please fill in all required fields and select at least one event.");
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        name: formName.trim(),
        url: formUrl.trim(),
        subscribed_events: formEvents,
        max_retries: formMaxRetries,
        timeout_seconds: formTimeout,
      });

      setCreatedSecret(result.secret);
      setFormName("");
      setFormUrl("");
      setFormEvents([]);
      toast.success("Webhook Created", "Webhook registered successfully. Copy the secret now.");
    } catch {
      toast.error("Failed to create webhook", "Ensure the URL is valid and reachable.");
    }
  };

  const handleToggleActive = async (webhook: TenantWebhookEndpoint) => {
    try {
      await updateMutation.mutateAsync({
        id: webhook.id,
        data: { is_active: !webhook.is_active },
      });
      toast.success("Webhook Updated", `Webhook marked as ${!webhook.is_active ? "Active" : "Disabled"}.`);
    } catch {
      toast.error("Update Failed", "Could not toggle webhook status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook subscription?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Webhook Deleted", "Subscription was removed.");
    } catch {
      toast.error("Delete Failed", "Could not remove webhook subscription.");
    }
  };

  const handleRotate = async (id: string) => {
    if (!confirm("Rotate webhook secret? External consumers will need to update their signature verification immediately.")) return;
    try {
      const result = await rotateMutation.mutateAsync(id);
      setCreatedSecret(result.new_secret);
      toast.success("Secret Rotated", "New secret generated. Copy it below.");
    } catch {
      toast.error("Rotation Failed", "Could not rotate secret.");
    }
  };

  const handleTest = async () => {
    if (!selectedWebhook) return;
    setTestResult(null);
    try {
      const res = await testMutation.mutateAsync({
        id: selectedWebhook.id,
        event_type: testEventType,
      });
      setTestResult(res);
      toast.success("Test Dispatched", `Received status code: ${res.status_code || "N/A"} (${res.status})`);
    } catch {
      toast.error("Test Dispatch Failed", "Could not reach target endpoint.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Webhook className="w-6 h-6 text-emerald-500" />
            Webhook Management Engine
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Publish enterprise real-time procurement events with HMAC-SHA256 signatures, exponential backoff, and delivery audit logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-2 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatedSecret(null);
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Webhook Endpoint
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 backdrop-blur-md">
          <div className="text-xs text-neutral-500 font-medium">Total Webhooks</div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {webhooks.length}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {activeCount} actively delivering
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 backdrop-blur-md">
          <div className="text-xs text-neutral-500 font-medium">Available Event Topics</div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {availableEvents.length || 10}
          </div>
          <div className="text-xs text-neutral-400 mt-1">PR, PO, GRN, Invoicing, Contracts</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 backdrop-blur-md">
          <div className="text-xs text-neutral-500 font-medium">Endpoints in Alert State</div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {failingCount}
          </div>
          <div className={`text-xs mt-1 flex items-center gap-1 ${failingCount > 0 ? "text-amber-500" : "text-neutral-400"}`}>
            <AlertTriangle className="w-3.5 h-3.5" /> {failingCount === 0 ? "All healthy" : "Requires attention"}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter webhooks by name or destination URL..."
          className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>

      {/* Webhook Endpoints List */}
      <div className="space-y-3">
        {filteredWebhooks.length === 0 ? (
          <div className="p-12 text-center bg-white/60 dark:bg-neutral-900/40 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <Webhook className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <div className="text-base font-medium text-neutral-700 dark:text-neutral-300">
              No webhook subscriptions configured
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Add your first endpoint to receive HTTP POST callbacks on procurement life-cycle events.
            </p>
          </div>
        ) : (
          filteredWebhooks.map((wh) => (
            <div
              key={wh.id}
              className="p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition shadow-xs"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                      {wh.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(wh)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition ${
                        wh.is_active
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700"
                      }`}
                    >
                      {wh.is_active ? "ACTIVE" : "DISABLED"}
                    </button>
                    {wh.failure_count > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {wh.failure_count} failures
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                    <span className="truncate max-w-md">{wh.url}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(wh.url, `url-${wh.id}`)}
                      className="text-neutral-400 hover:text-neutral-600"
                      title="Copy URL"
                    >
                      {copiedText === `url-${wh.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {wh.subscribed_events.map((evt) => (
                      <span
                        key={evt}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700 font-mono"
                      >
                        {evt}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWebhook(wh);
                      setIsTestOpen(true);
                      setTestResult(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-600" />
                    Test Ping
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWebhook(wh);
                      setIsDeliveriesOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                  >
                    <History className="w-3.5 h-3.5 text-blue-600" />
                    Deliveries
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotate(wh.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-amber-600 dark:text-amber-400"
                    title="Rotate secret key"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Rotate
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(wh.id)}
                    className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-600 hover:border-red-300 transition"
                    title="Delete webhook"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Secret Display Banner / Modal */}
      {createdSecret && (
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md animate-in fade-in">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                <Shield className="w-4 h-4 text-emerald-600" />
                HMAC-SHA256 Signing Secret Generated
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Copy this secret immediately. It is never displayed again in plaintext.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <code className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-white dark:bg-black border border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                  {createdSecret}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdSecret, "new-secret")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition flex items-center gap-1.5"
                >
                  {copiedText === "new-secret" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedText === "new-secret" ? "Copied" : "Copy Secret"}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreatedSecret(null)}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Webhook className="w-4 h-4 text-emerald-500" />
                Register Webhook Endpoint
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Endpoint Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. ERP Invoicing Sync"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Destination URL (HTTPS) *
                </label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://api.yourcompany.com/webhooks/procure"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Subscribed Topics *
                </label>
                <div className="max-h-36 overflow-y-auto p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 space-y-1">
                  {availableEvents.map((evt) => (
                    <label key={evt} className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/40 dark:hover:bg-neutral-700/40 p-1 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEvents.includes(evt)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormEvents([...formEvents, evt]);
                          } else {
                            setFormEvents(formEvents.filter((x) => x !== evt));
                          }
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-mono text-[11px]">{evt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Max Retries
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formMaxRetries}
                    onChange={(e) => setFormMaxRetries(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Timeout (Seconds)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={formTimeout}
                    onChange={(e) => setFormTimeout(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Register Endpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Ping Modal */}
      {isTestOpen && selectedWebhook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-500" />
                Dispatch Test Event to {selectedWebhook.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsTestOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Event Topic
                </label>
                <select
                  value={testEventType}
                  onChange={(e) => setTestEventType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                >
                  {selectedWebhook.subscribed_events.map((evt) => (
                    <option key={evt} value={evt}>
                      {evt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                <div>URL: {selectedWebhook.url}</div>
                <div>Header: X-HKT-Signature: sha256=...</div>
                <div>Payload: Synthetic test record</div>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    testResult.status === "SUCCESS"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    {testResult.status === "SUCCESS" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Delivery {testResult.status}: HTTP {testResult.status_code || "N/A"}
                  </div>
                  <div>Latency: {testResult.latency_ms}ms</div>
                  {testResult.error_message && <div>Error: {testResult.error_message}</div>}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTestOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50"
                >
                  {testMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Send Test Ping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries Drawer / Modal */}
      {isDeliveriesOpen && selectedWebhook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-500" />
                Delivery Audit Trail — {selectedWebhook.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsDeliveriesOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {isDeliveriesLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : deliveries.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500">
                  No deliveries recorded yet for this endpoint.
                </div>
              ) : (
                deliveries.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-semibold text-[10px] ${
                            d.status === "DELIVERED"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                              : "bg-red-500/10 text-red-600 border border-red-500/30"
                          }`}
                        >
                          {d.status} {d.status_code ? `(${d.status_code})` : ""}
                        </span>
                        <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                          {d.event_type}
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(d.delivered_at).toLocaleString()} • {d.latency_ms}ms
                      </span>
                    </div>

                    {d.error_message && (
                      <div className="text-red-500 font-mono text-[11px]">
                        Error: {d.error_message}
                      </div>
                    )}

                    <details className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                      <summary className="cursor-pointer text-blue-500 hover:underline">
                        View Payload JSON
                      </summary>
                      <pre className="mt-2 p-2.5 rounded-lg bg-black/5 dark:bg-black/40 overflow-x-auto text-[10px]">
                        {JSON.stringify(d.payload, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDeliveriesOpen(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
