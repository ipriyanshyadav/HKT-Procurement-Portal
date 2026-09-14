"use client";

import React, { useState } from "react";
import {
  useTenantApiKeys,
  useCreateTenantApiKey,
  useRevokeTenantApiKey,
  useRotateTenantApiKey,
  useApiKeyUsageMetrics,
  useApiKeyRecentLogs,
  ApiKeyItem,
} from "@procurement/hooks";
import { useAppToast } from "@procurement/hooks";
import {
  Key,
  Plus,
  RefreshCw,
  Search,
  Check,
  Copy,
  Trash2,
  RotateCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Shield,
  X,
  Loader2,
  BarChart3,
  ListFilter,
  Terminal,
} from "lucide-react";

const AVAILABLE_SCOPES = [
  { scope: "read:pr", label: "Read Purchase Requisitions" },
  { scope: "write:pr", label: "Create & Update Requisitions" },
  { scope: "read:po", label: "Read Purchase Orders" },
  { scope: "write:po", label: "Manage Purchase Orders" },
  { scope: "read:grn", label: "Read Goods Receipt Notes" },
  { scope: "read:invoice", label: "Read Invoices & Matching" },
  { scope: "write:invoice", label: "Submit & Process Invoices" },
  { scope: "read:vendor", label: "Read Supplier Directory" },
  { scope: "write:vendor", label: "Manage Suppliers & Onboarding" },
];

export default function ApiKeyManagementPage() {
  const { toast } = useAppToast();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKeyItem | null>(null);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formScopes, setFormScopes] = useState<string[]>(["read:pr", "read:po"]);
  const [formTier, setFormTier] = useState<"TEST" | "STANDARD" | "ENTERPRISE">("STANDARD");
  const [formType, setFormType] = useState<"LIVE" | "TEST">("LIVE");
  const [formExpiryDays, setFormExpiryDays] = useState(90);

  // Queries & Mutations
  const { data: apiKeys = [], isLoading, refetch } = useTenantApiKeys();
  const createMutation = useCreateTenantApiKey();
  const revokeMutation = useRevokeTenantApiKey();
  const rotateMutation = useRotateTenantApiKey();

  const { data: usageMetrics, isLoading: isUsageLoading } = useApiKeyUsageMetrics(
    selectedKey?.id || null
  );

  const { data: recentLogs = [], isLoading: isLogsLoading } = useApiKeyRecentLogs(
    selectedKey?.id || null
  );

  const filteredKeys = apiKeys.filter(
    (k) =>
      k.name.toLowerCase().includes(search.toLowerCase()) ||
      k.key_prefix.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = apiKeys.filter((k) => k.status === "ACTIVE").length;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formScopes.length === 0) {
      toast.error("Validation Error", "Please specify a key name and at least one scope.");
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        name: formName.trim(),
        scopes: formScopes,
        rate_limit_tier: formTier,
        key_type: formType,
        expires_in_days: formExpiryDays,
      });

      setCreatedRawKey(result.raw_key);
      setFormName("");
      setFormScopes(["read:pr", "read:po"]);
      toast.success("API Key Generated", "Bearer key generated. Copy it immediately.");
    } catch {
      toast.error("Failed to generate API key", "Could not create key.");
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this API key? Any applications currently using it will be rejected with 401 Unauthorized.")) {
      return;
    }
    try {
      await revokeMutation.mutateAsync(id);
      toast.success("Key Revoked", "The API key status was changed to REVOKED.");
    } catch {
      toast.error("Revocation Failed", "Could not revoke key.");
    }
  };

  const handleRotate = async (id: string) => {
    if (
      !confirm(
        "Rotate this key? The existing key will remain valid for a 24-hour grace period while you transition to the new key."
      )
    ) {
      return;
    }
    try {
      const result = await rotateMutation.mutateAsync(id);
      setCreatedRawKey(result.raw_key);
      toast.success("API Key Rotated", "New key issued with a 24h grace period for the old key.");
    } catch {
      toast.error("Rotation Failed", "Could not rotate key.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Key className="w-6 h-6 text-amber-500" />
            Tenant API Keys & Scopes
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Programmatic bearer authentication for ERP connectors, CI/CD automation, and third-party integrations with granular scopes and rate limiting.
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
              setCreatedRawKey(null);
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create API Key
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 backdrop-blur-md">
          <div className="text-xs text-neutral-500 font-medium">Total API Keys</div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {apiKeys.length}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {activeCount} currently active
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 backdrop-blur-md">
          <div className="text-xs text-neutral-500 font-medium">Rate Limit Security</div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            120 RPM
          </div>
          <div className="text-xs text-neutral-400 mt-1">Standard tier sliding window enforcement</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 backdrop-blur-md">
          <div className="text-xs text-neutral-500 font-medium">Rotation Protocol</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            24h Grace
          </div>
          <div className="text-xs text-neutral-400 mt-1">Zero-downtime dual-key rotation window</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter API keys by name or prefix..."
          className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      {/* Keys List */}
      <div className="space-y-3">
        {filteredKeys.length === 0 ? (
          <div className="p-12 text-center bg-white/60 dark:bg-neutral-900/40 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <Key className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <div className="text-base font-medium text-neutral-700 dark:text-neutral-300">
              No API keys generated
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Create an API key to securely call the HKT Procurement API from scripts or external systems.
            </p>
          </div>
        ) : (
          filteredKeys.map((key) => {
            const isLive = key.key_type === "LIVE";
            const isActive = key.status === "ACTIVE";

            return (
              <div
                key={key.id}
                className="p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition shadow-xs"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                        {key.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isLive
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {key.key_type}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-700"
                        }`}
                      >
                        {key.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                      <span>Prefix: {key.key_prefix}...</span>
                      <span>•</span>
                      <span>{key.rate_limit_rpm} RPM</span>
                      {key.expires_at && (
                        <>
                          <span>•</span>
                          <span>Expires: {new Date(key.expires_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700 font-mono"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKey(key);
                        setIsUsageOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                      Usage Metrics
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKey(key);
                        setIsLogsOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                    >
                      <Terminal className="w-3.5 h-3.5 text-purple-600" />
                      Audit Logs
                    </button>

                    {isActive && (
                      <button
                        type="button"
                        onClick={() => handleRotate(key.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-amber-600 dark:text-amber-400"
                        title="Rotate key with 24h grace period"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        Rotate
                      </button>
                    )}

                    {isActive && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(key.id)}
                        className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-600 hover:border-red-300 transition"
                        title="Revoke API key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Raw Key Display Alert */}
      {createdRawKey && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md animate-in fade-in">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                <Shield className="w-4 h-4 text-amber-600" />
                Raw API Key Secret Token (Bearer)
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                This token will NOT be displayed again. Copy it and store it in your secrets vault.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <code className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-white dark:bg-black border border-amber-500/40 text-amber-700 dark:text-amber-300">
                  {createdRawKey}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdRawKey, "new-raw-key")}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition flex items-center gap-1.5"
                >
                  {copiedText === "new-raw-key" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedText === "new-raw-key" ? "Copied" : "Copy Token"}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreatedRawKey(null)}
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
                <Key className="w-4 h-4 text-amber-500" />
                Generate Enterprise API Key
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
                  Key Description / Application Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. SAP Gateway Sync Bot"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Environment
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as "LIVE" | "TEST")}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="LIVE">Live Production</option>
                    <option value="TEST">Sandbox Test</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Rate Limit Tier
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as "TEST" | "STANDARD" | "ENTERPRISE")}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="TEST">Test (30 RPM)</option>
                    <option value="STANDARD">Standard (120 RPM)</option>
                    <option value="ENTERPRISE">Enterprise (600 RPM)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Expiration Period
                </label>
                <select
                  value={formExpiryDays}
                  onChange={(e) => setFormExpiryDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                >
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days (Recommended)</option>
                  <option value={180}>180 Days</option>
                  <option value={365}>1 Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Assigned Scopes *
                </label>
                <div className="max-h-40 overflow-y-auto p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 space-y-1">
                  {AVAILABLE_SCOPES.map((item) => (
                    <label
                      key={item.scope}
                      className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/40 dark:hover:bg-neutral-700/40 p-1 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formScopes.includes(item.scope)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormScopes([...formScopes, item.scope]);
                          } else {
                            setFormScopes(formScopes.filter((x) => x !== item.scope));
                          }
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="font-mono text-[11px] font-medium">{item.scope}</span>
                      <span className="text-[10px] text-neutral-400">({item.label})</span>
                    </label>
                  ))}
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
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Usage Modal */}
      {isUsageOpen && selectedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                Usage Telemetry — {selectedKey.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsUsageOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isUsageLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : usageMetrics ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-[11px] text-neutral-500 font-medium">Requests Today</div>
                    <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                      {usageMetrics.requests_today}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-[11px] text-neutral-500 font-medium">Monthly Total</div>
                    <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                      {usageMetrics.requests_this_month}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-[11px] text-neutral-500 font-medium">Average Latency</div>
                    <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                      {usageMetrics.avg_latency_ms}ms
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-[11px] text-neutral-500 font-medium">Errors Today</div>
                    <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                      {usageMetrics.error_count_today}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 text-xs">
                  <span className="text-neutral-500">Lifetime Invocations: </span>
                  <span className="font-semibold">{usageMetrics.total_requests.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500">
                No telemetry recorded yet for this key.
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsUsageOpen(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {isLogsOpen && selectedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-500" />
                Recent Invocations — {selectedKey.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsLogsOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {isLogsLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  No invocation logs available for this key.
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">
                        {log.method}
                      </span>
                      <span className="text-neutral-600 dark:text-neutral-400 truncate max-w-xs">
                        {log.endpoint}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          log.status_code < 400
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {log.status_code}
                      </span>
                      <span className="text-neutral-400 text-[10px] font-mono">
                        {log.latency_ms}ms
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLogsOpen(false)}
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
