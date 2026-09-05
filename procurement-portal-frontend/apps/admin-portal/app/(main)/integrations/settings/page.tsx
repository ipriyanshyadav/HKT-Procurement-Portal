"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useIntegrationConfig, useUpdateIntegrationConfig } from "@procurement/hooks";
import {
  ArrowLeft,
  Save,
  Server,
  Shield,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Globe,
  Key,
} from "lucide-react";

export default function IntegrationSettingsPage() {
  const { data: config, isLoading, error } = useIntegrationConfig();
  const updateMutation = useUpdateIntegrationConfig();

  const [provider, setProvider] = useState<string>("SAP");
  const [endpointUrl, setEndpointUrl] = useState<string>("");
  const [authType, setAuthType] = useState<string>("API_KEY");
  const [apiKey, setApiKey] = useState<string>("");
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (config) {
      setProvider(config.erp_provider || "SAP");
      setEndpointUrl(config.endpoint_url || "");
      setAuthType(config.auth_type || "API_KEY");
      setIsEnabled(config.is_enabled ?? true);
      setAllowedDomains(config.allowed_domains || []);
    }
  }, [config]);

  const handleAddDomain = () => {
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed) return;
    if (allowedDomains.includes(trimmed)) {
      setFeedback({ type: "error", text: "Domain is already in allowlist." });
      return;
    }
    setAllowedDomains([...allowedDomains, trimmed]);
    setNewDomain("");
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    setAllowedDomains(allowedDomains.filter((d) => d !== domainToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    try {
      await updateMutation.mutateAsync({
        erp_provider: provider,
        endpoint_url: endpointUrl || null,
        auth_type: authType,
        api_key: apiKey || null,
        allowed_domains: allowedDomains,
        is_enabled: isEnabled,
      });
      setFeedback({
        type: "success",
        text: "Integration configuration and SSRF allowlist saved successfully.",
      });
      setApiKey("");
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.response?.data?.error?.message || "Failed to update integration settings.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RotateCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
        <p className="text-sm font-medium">Loading integration settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <Link
          href="/integrations"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Integration Monitor
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Server className="w-6 h-6 text-blue-600" />
              ERP Connector & SSRF Security Configuration
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure tenant enterprise ERP backend connection and manage strict outbound domain allowlists.
            </p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ERP Connector Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Primary ERP Provider Settings
              </h2>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              Enable ERP Sync
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ERP Adapter Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SAP">SAP S/4HANA & ECC (IDoc / RFC)</option>
                <option value="ORACLE">Oracle ERP Cloud / EBS</option>
                <option value="CUSTOM">Custom Generic REST Connector</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Authentication Scheme
              </label>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="API_KEY">API Key / Token</option>
                <option value="BEARER_TOKEN">OAuth 2.0 Bearer Token</option>
                <option value="BASIC_AUTH">HTTP Basic Authentication</option>
                <option value="MTLS">Mutual TLS (mTLS)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ERP Gateway / Base Endpoint URL
              </label>
              <input
                type="url"
                placeholder="https://erp-gateway.company.corp/api/v1"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                The domain in this URL must be included in the SSRF allowlist below.
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Credentials / Secret Key
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  placeholder={
                    config?.api_key_masked
                      ? `Stored: ${config.api_key_masked} (enter new key to update)`
                      : "Enter API key or credential secret..."
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SSRF Domain Allowlist Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Shield className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              SSRF Prevention & Outbound Domain Allowlist
            </h2>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-200">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Strict Security Enforcement
            </p>
            Outbound HTTP requests from integration adapters and webhooks are restricted to explicitly allowed
            domains. Private subnets (RFC 1918), loopback addresses (127.0.0.1, localhost), and cloud instance
            metadata (169.254.169.254) are rejected unconditionally.
          </div>

          {/* Add Domain Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. erp.company.corp or *.sap.internal"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddDomain();
                  }
                }}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <button
              type="button"
              onClick={handleAddDomain}
              className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Domain
            </button>
          </div>

          {/* Domain List Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {allowedDomains.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-sans">
                No allowed domains registered. External adapter calls without an allowlisted domain will fail
                with HTTP 403 (SSRF_BLOCKED).
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-mono">
                {allowedDomains.map((dom) => (
                  <li
                    key={dom}
                    className="p-3 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      <span>{dom}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDomain(dom)}
                      className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Remove Domain"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/integrations"
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {updateMutation.isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
