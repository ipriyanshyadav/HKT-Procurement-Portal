"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  useTenantBranding,
  useUpdateTenantBranding,
  useVerifyCustomDomain,
} from "@procurement/hooks";
import { useAppToast } from "@procurement/hooks";
import {
  Palette,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Save,
  RefreshCw,
  Copy,
  Check,
  Eye,
  Building2,
  Sparkles,
  Mail,
  Loader2,
} from "lucide-react";

// Helper to calculate contrast ratio against white #FFFFFF
function getContrastRatioWithWhite(hexColor: string): number {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return 4.5;
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const toLuminance = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L1 = 1.0; // white luminance
  const L2 = 0.2126 * toLuminance(r) + 0.7152 * toLuminance(g) + 0.0722 * toLuminance(b);

  return Number(((L1 + 0.05) / (L2 + 0.05)).toFixed(1));
}

export default function TenantBrandingPage() {
  const { toast } = useAppToast();
  const { data: branding, isLoading, refetch } = useTenantBranding();
  const updateMutation = useUpdateTenantBranding();
  const verifyDomainMutation = useVerifyCustomDomain();

  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0284c7");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [customDomain, setCustomDomain] = useState("");
  const [emailSenderName, setEmailSenderName] = useState("");
  const [emailFooterText, setEmailFooterText] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (branding) {
      setCompanyName(branding.company_display_name || "");
      setLogoUrl(branding.logo_url || "");
      setFaviconUrl(branding.favicon_url || "");
      setPrimaryColor(branding.primary_color || "#0284c7");
      setSecondaryColor(branding.secondary_color || "#0f172a");
      setAccentColor(branding.accent_color || "#f59e0b");
      setCustomDomain(branding.custom_domain || "");
      setEmailSenderName(branding.email_sender_name || "");
      setEmailFooterText(branding.email_footer_text || "");
    }
  }, [branding]);

  const primaryContrast = useMemo(() => getContrastRatioWithWhite(primaryColor), [primaryColor]);
  const isAccessible = primaryContrast >= 4.5;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        company_display_name: companyName.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
        favicon_url: faviconUrl.trim() || undefined,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        custom_domain: customDomain.trim() || undefined,
        email_sender_name: emailSenderName.trim() || undefined,
        email_footer_text: emailFooterText.trim() || undefined,
      });
      toast.success("Branding Saved", "Organization white-label theme updated.");
    } catch {
      toast.error("Save Failed", "Could not update organization branding.");
    }
  };

  const handleVerifyDomain = async () => {
    try {
      const res = await verifyDomainMutation.mutateAsync();
      if (res.custom_domain_verified) {
        toast.success("Domain Verified", `DNS TXT record verified for ${res.custom_domain}.`);
      } else {
        toast.error("Verification Pending", "DNS TXT record not found yet. Please allow up to 24 hours for DNS propagation.");
      }
    } catch {
      toast.error("Verification Request Failed", "Could not verify custom domain.");
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="text-xs text-neutral-500">Loading organization branding...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Palette className="w-6 h-6 text-purple-500" />
            Tenant White-Label Branding & Custom Domains
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Customize portal logos, color schemes, email headers, and verify dedicated custom domains for seamless enterprise corporate identity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration Form */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Visual Identity Section */}
            <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 space-y-4 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Corporate Visual Identity
              </h2>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Company Display Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Global Enterprises"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Primary Logo URL (SVG or PNG)
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://assets.acme.com/logo.svg"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Favicon URL (ICO or PNG)
                  </label>
                  <input
                    type="url"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="https://assets.acme.com/favicon.png"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              {/* Color Controls */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono"
                    />
                  </div>
                  <div className="mt-1 text-[10px] flex items-center gap-1">
                    <span
                      className={`font-semibold ${
                        isAccessible ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"
                      }`}
                    >
                      {primaryContrast}:1 WCAG
                    </span>
                    {isAccessible ? "AA Pass" : "Low Contrast"}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Email Communications Section */}
            <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 space-y-4 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                Email Notifications White-Labeling
              </h2>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Email Sender Display Name
                </label>
                <input
                  type="text"
                  value={emailSenderName}
                  onChange={(e) => setEmailSenderName(e.target.value)}
                  placeholder="e.g. Acme Procurement Operations"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Email Footer Legal Text
                </label>
                <textarea
                  rows={2}
                  value={emailFooterText}
                  onChange={(e) => setEmailFooterText(e.target.value)}
                  placeholder="e.g. This is an automated message from Acme Corp Procurement. Confidential."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Custom Domain Section */}
            <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-500" />
                  Custom Dedicated Domain
                </h2>
                {branding?.custom_domain_verified ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> VERIFIED
                  </span>
                ) : branding?.custom_domain ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> PENDING DNS
                  </span>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Domain FQDN
                </label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="procure.acmecorp.com"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              {branding?.dns_txt_record_name && (
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
                  <div className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                    Add this DNS TXT record in your DNS provider (Cloudflare, Route53, GoDaddy):
                  </div>
                  <div className="flex items-center justify-between font-mono bg-black/5 dark:bg-black/30 p-2 rounded-lg">
                    <span className="truncate pr-2">Record: {branding.dns_txt_record_name}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(branding.dns_txt_record_name!, "dns-name")}
                      className="text-neutral-400 hover:text-neutral-600"
                    >
                      {copiedField === "dns-name" ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between font-mono bg-black/5 dark:bg-black/30 p-2 rounded-lg">
                    <span className="truncate pr-2">Value: {branding.dns_txt_record_value}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(branding.dns_txt_record_value!, "dns-val")}
                      className="text-neutral-400 hover:text-neutral-600"
                    >
                      {copiedField === "dns-val" ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyDomain}
                    disabled={verifyDomainMutation.isPending}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    {verifyDomainMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Shield className="w-3.5 h-3.5" />
                    )}
                    Verify DNS Record Now
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save White-Label Configuration
            </button>
          </form>
        </div>

        {/* Right Column: Real-Time Live Preview Pane */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6 p-6 rounded-3xl bg-neutral-100/90 dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 space-y-5 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-purple-500" />
                Live White-Label Preview
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                Interactive
              </span>
            </div>

            {/* Mock Header */}
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="w-7 h-7 object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {companyName.charAt(0) || "P"}
                    </div>
                  )}
                  <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate max-w-[160px]">
                    {companyName || "Acme Procurement"}
                  </span>
                </div>
                <div
                  className="px-2 py-0.5 text-[10px] font-semibold rounded-full text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Enterprise
                </div>
              </div>

              {/* Mock Content */}
              <div className="space-y-2 py-2">
                <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Purchase Requisition #PR-2026-0042
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-medium text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    Pending Approval
                  </span>
                  <span className="text-[10px] text-neutral-400">Total: ₹45,000.00</span>
                </div>
              </div>

              {/* Mock Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-white shadow-xs transition"
                  style={{ backgroundColor: primaryColor }}
                >
                  Approve Order
                </button>
                <button
                  type="button"
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-white shadow-xs transition"
                  style={{ backgroundColor: secondaryColor }}
                >
                  Reject
                </button>
              </div>
            </div>

            {/* Email Notification Mock */}
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-black p-4 space-y-2 shadow-xs text-xs">
              <div className="flex items-center gap-1.5 text-neutral-500 font-mono text-[10px]">
                <Mail className="w-3 h-3" />
                From: {emailSenderName || "Acme Procurement"} &lt;notifications@
                {customDomain || "hkt-procure.com"}&gt;
              </div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                Purchase Order #PO-9912 Dispatched
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Vendor confirmation received. Delivery expected on Sept 20, 2026.
              </p>
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 text-[9px] text-neutral-400">
                {emailFooterText || "Acme Global Procurement Portal • All rights reserved."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
