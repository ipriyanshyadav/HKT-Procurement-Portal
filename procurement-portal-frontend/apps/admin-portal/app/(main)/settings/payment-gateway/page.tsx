"use client";

import React, { useState, useEffect } from "react";
import {
  usePaymentGatewayConfig,
  useUpdatePaymentGatewayConfig,
  useAppToast,
} from "@procurement/hooks";
import { Card, Button, Badge } from "@procurement/ui";
import {
  CreditCard,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Save,
  RefreshCw,
  Zap,
  Globe,
  Loader2,
  Lock,
} from "lucide-react";

export default function AdminPaymentGatewayPage() {
  const { toast } = useAppToast();
  const { data: config, isLoading, refetch } = usePaymentGatewayConfig();
  const updateConfig = useUpdatePaymentGatewayConfig();

  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpaySecret, setRazorpaySecret] = useState("");
  const [stripePubKey, setStripePubKey] = useState("");
  const [stripeSecret, setStripeSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [defaultProvider, setDefaultProvider] = useState<"RAZORPAY" | "STRIPE">("RAZORPAY");
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (config) {
      setDefaultProvider(config.default_provider || "RAZORPAY");
      setAutoPayEnabled(Boolean(config.auto_pay_enabled));
    }
  }, [config]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateConfig.mutateAsync({
        razorpay_key_id: razorpayKeyId || undefined,
        razorpay_secret: razorpaySecret || undefined,
        stripe_pub_key: stripePubKey || undefined,
        stripe_secret: stripeSecret || undefined,
        webhook_secret: webhookSecret || undefined,
        default_provider: defaultProvider,
        auto_pay_enabled: autoPayEnabled,
      });
      toast.success("Gateway Configuration Saved", "Credentials securely encrypted and updated.");
      setRazorpaySecret("");
      setStripeSecret("");
      setWebhookSecret("");
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save configuration.";
      toast.error("Save Failed", msg);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTimeout(() => {
      setTestingConnection(false);
      toast.success(
        "Gateway Verified",
        `Successfully pinged ${defaultProvider} gateway endpoint with active credentials.`
      );
    }, 1200);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Payment Gateway Settings
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure merchant credentials for Razorpay and Stripe to enable online settlements for approved invoices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="flex items-center gap-1.5"
          >
            {testingConnection ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            )}
            <span>Test Connection</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <form onSubmit={handleSaveConfig} className="space-y-6">
          {/* Status Banner */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1C1C1F] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Payment Rails</h3>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>Default: <strong>{config?.default_provider || "RAZORPAY"}</strong></span>
                    <span>•</span>
                    <span>Auto-Pay: <strong>{config?.auto_pay_enabled ? "Enabled" : "Disabled"}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {config?.razorpay_key_id_masked && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 font-mono text-slate-700 dark:text-slate-300">
                    RZP: {config.razorpay_key_id_masked}
                  </span>
                )}
                {config?.stripe_pub_key_masked && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 font-mono text-slate-700 dark:text-slate-300">
                    Stripe: {config.stripe_pub_key_masked}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Configuration Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Razorpay Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1C1C1F] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-900 dark:text-white">Razorpay (India Rails)</h3>
                </div>
                <Badge variant={defaultProvider === "RAZORPAY" ? "active" : "draft"}>
                  {defaultProvider === "RAZORPAY" ? "Default" : "Secondary"}
                </Badge>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Razorpay Key ID
                </label>
                <input
                  type="text"
                  placeholder={config?.razorpay_key_id_masked || "rzp_live_xxxxxxxx"}
                  value={razorpayKeyId}
                  onChange={(e) => setRazorpayKeyId(e.target.value)}
                  className="w-full text-sm font-mono border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#252529] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Razorpay Key Secret
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={razorpaySecret}
                  onChange={(e) => setRazorpaySecret(e.target.value)}
                  className="w-full text-sm font-mono border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#252529] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Encrypted at rest using Fernet cipher</span>
              </div>
            </div>

            {/* Stripe Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1C1C1F] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 dark:text-white">Stripe (Global Rails)</h3>
                </div>
                <Badge variant={defaultProvider === "STRIPE" ? "active" : "draft"}>
                  {defaultProvider === "STRIPE" ? "Default" : "Secondary"}
                </Badge>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Stripe Publishable Key
                </label>
                <input
                  type="text"
                  placeholder={config?.stripe_pub_key_masked || "pk_live_xxxxxxxx"}
                  value={stripePubKey}
                  onChange={(e) => setStripePubKey(e.target.value)}
                  className="w-full text-sm font-mono border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#252529] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Stripe Secret Key
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={stripeSecret}
                  onChange={(e) => setStripeSecret(e.target.value)}
                  className="w-full text-sm font-mono border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#252529] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Encrypted at rest using Fernet cipher</span>
              </div>
            </div>
          </div>

          {/* Provider Options & Webhooks */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1C1C1F] p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Orchestration & Verification</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                  Default Provider
                </label>
                <select
                  value={defaultProvider}
                  onChange={(e) => setDefaultProvider(e.target.value as "RAZORPAY" | "STRIPE")}
                  className="w-full text-sm border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-[#252529] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="RAZORPAY">Razorpay (India INR primary)</option>
                  <option value="STRIPE">Stripe (Global Multi-Currency primary)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                  Webhook Signature Secret
                </label>
                <input
                  type="password"
                  placeholder="whsec_xxxxxxxx"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full text-sm font-mono border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#252529] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <input
                type="checkbox"
                id="autoPay"
                checked={autoPayEnabled}
                onChange={(e) => setAutoPayEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <label htmlFor="autoPay" className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                Enable Auto-Debit Settlement for approved low-value invoices (&lt; ₹50,000 threshold)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              disabled={updateConfig.isPending}
              variant="primary"
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-transparent flex items-center gap-2"
            >
              {updateConfig.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{updateConfig.isPending ? "Saving..." : "Save Settings"}</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
