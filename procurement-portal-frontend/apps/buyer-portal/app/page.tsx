"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  ShieldCheck,
  Factory,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  KeyRound,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
} from "lucide-react";

interface CredentialItem {
  role: string;
  name: string;
  email: string;
  pass: string;
  badge: string;
}

interface PortalCard {
  id: "buyer" | "admin" | "supplier";
  title: string;
  tagline: string;
  description: string;
  theme: {
    badgeBg: string;
    badgeText: string;
    iconBg: string;
    iconColor: string;
    buttonBg: string;
    borderAccent: string;
  };
  icon: React.ComponentType<{ className?: string }>;
  credentials: CredentialItem[];
  defaultUrl: string;
  features: string[];
}

export default function UnifiedGatewayPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getAdminUrl = () => {
    if (process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL) {
      return process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL;
    }
    if (typeof window !== "undefined" && window.location.hostname.includes("localhost")) {
      return "http://localhost:3002/login";
    }
    return "https://hkt-admin-portal.vercel.app/login";
  };

  const getSupplierUrl = () => {
    if (process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL) {
      return process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL;
    }
    if (typeof window !== "undefined" && window.location.hostname.includes("localhost")) {
      return "http://localhost:3001/login";
    }
    return "https://hkt-supplier-portal.vercel.app/login";
  };

  const portals: PortalCard[] = [
    {
      id: "buyer",
      title: "Buyer Portal",
      tagline: "Procurement, Requisitions & Sourcing",
      description:
        "Manage purchase requests, RFQs, live reverse auctions, purchase orders, consignee GRN inspections, and 3-way invoice matching.",
      theme: {
        badgeBg: "bg-blue-100 dark:bg-blue-950/60",
        badgeText: "text-blue-700 dark:text-blue-300",
        iconBg: "bg-blue-600 text-white shadow-blue-500/20",
        iconColor: "text-blue-600 dark:text-blue-400",
        buttonBg: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25",
        borderAccent: "hover:border-blue-500/50 hover:shadow-blue-500/10",
      },
      icon: ShoppingCart,
      defaultUrl: "/login",
      features: [
        "Requisitioning & Demand Cart",
        "RFQ & Live Reverse Auction Room",
        "PO Issuance & GRN Delivery",
        "3-Way Invoice Reconciliation",
      ],
      credentials: [
        {
          role: "Buyer Specialist",
          name: "Sarah Jenkins",
          email: "buyer@procurement.com",
          pass: "Buyer123456!@#",
          badge: "PRs / RFQs / POs",
        },
        {
          role: "Department Approver",
          name: "Robert Taylor",
          email: "approver@procurement.com",
          pass: "Approver123!@#",
          badge: "Sign-offs & Approvals",
        },
      ],
    },
    {
      id: "admin",
      title: "Admin Portal",
      tagline: "System Governance & Master Data",
      description:
        "Configure organization hierarchies, enterprise user accounts, role matrices, multi-tiered approval rules, and audit logs.",
      theme: {
        badgeBg: "bg-purple-100 dark:bg-purple-950/60",
        badgeText: "text-purple-700 dark:text-purple-300",
        iconBg: "bg-purple-600 text-white shadow-purple-500/20",
        iconColor: "text-purple-600 dark:text-purple-400",
        buttonBg: "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/25",
        borderAccent: "hover:border-purple-500/50 hover:shadow-purple-500/10",
      },
      icon: ShieldCheck,
      defaultUrl: getAdminUrl(),
      features: [
        "User Directory & Role Matrix",
        "Dynamic Approval Workflows",
        "Master Catalogs & Currencies",
        "Real-Time Audit Trail & SLAs",
      ],
      credentials: [
        {
          role: "System Administrator",
          name: "David Miller",
          email: "admin@procurement.com",
          pass: "Admin123456!@#",
          badge: "Org & Master Setup",
        },
        {
          role: "Universal Super Admin",
          name: "Alexander Vance",
          email: "superadmin@procurement.com",
          pass: "SuperAdmin123456!@#",
          badge: "Omnipotent Bypass",
        },
      ],
    },
    {
      id: "supplier",
      title: "Supplier Portal",
      tagline: "Vendor Extranet & Live Bidding",
      description:
        "Vendor workspace to review RFQs, participate in English/Dutch live reverse auctions, acknowledge orders, and dispatch ASNs.",
      theme: {
        badgeBg: "bg-emerald-100 dark:bg-emerald-950/60",
        badgeText: "text-emerald-700 dark:text-emerald-300",
        iconBg: "bg-emerald-600 text-white shadow-emerald-500/20",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25",
        borderAccent: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
      },
      icon: Factory,
      defaultUrl: getSupplierUrl(),
      features: [
        "Interactive RFQ Response & Bidding",
        "Real-Time WebSocket Auction Floor",
        "PO Confirmation & ASN Dispatch",
        "Direct E-Invoice Submission",
      ],
      credentials: [
        {
          role: "Supplier Partner",
          name: "Rajesh Kumar (Acme Tech)",
          email: "supplier@acme.com",
          pass: "Supplier123456!@#",
          badge: "Bid & Order Execution",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header */}
      <header className="border-b border-gray-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-xs font-black tracking-wider bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white rounded-lg shadow-sm">
              HKT
            </span>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-600 dark:from-white dark:via-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent">
                ProcureOS
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase">
                Source-to-Pay Gateway
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              API Online
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Select Workspace Portal to Enter</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Enterprise Procurement Hub
          </h1>
          <p className="mt-3 text-base sm:text-lg text-gray-600 dark:text-gray-300">
            Access the integrated Source-to-Pay portals below. Credentials for each role are pre-configured for instant demo testing.
          </p>
        </div>

        {/* 3 Portal Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <div
                key={portal.id}
                className={`flex flex-col justify-between bg-white dark:bg-neutral-900/90 rounded-2xl border border-gray-200 dark:border-neutral-800 p-6 sm:p-7 shadow-sm hover:shadow-xl transition-all duration-200 ${portal.theme.borderAccent}`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl shadow-md ${portal.theme.iconBg}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${portal.theme.badgeBg} ${portal.theme.badgeText}`}
                    >
                      {portal.tagline}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {portal.title}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-5">
                    {portal.description}
                  </p>

                  {/* Feature Highlights */}
                  <div className="mb-6 space-y-2 border-t border-gray-100 dark:border-neutral-800/80 pt-4">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                      Key Capabilities
                    </span>
                    {portal.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Credentials Section */}
                  <div className="space-y-3 mb-6 bg-gray-50 dark:bg-neutral-950/70 p-4 rounded-xl border border-gray-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                        Demo Credentials
                      </span>
                      <span className="text-[10px] text-gray-400">Click icon to copy</span>
                    </div>

                    {portal.credentials.map((cred, idx) => {
                      const emailKey = `${portal.id}-email-${idx}`;
                      const passKey = `${portal.id}-pass-${idx}`;
                      return (
                        <div
                          key={idx}
                          className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-gray-200/80 dark:border-neutral-800/80 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {cred.role}
                            </span>
                            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800">
                              {cred.badge}
                            </span>
                          </div>

                          <div className="space-y-1 font-mono text-[11px]">
                            {/* Email Row */}
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-neutral-950 px-2 py-1 rounded border border-gray-100 dark:border-neutral-800/80">
                              <span className="text-gray-600 dark:text-gray-300 truncate max-w-[190px]">
                                {cred.email}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(cred.email, emailKey)}
                                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-0.5"
                                title="Copy Email"
                              >
                                {copiedKey === emailKey ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            {/* Password Row */}
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-neutral-950 px-2 py-1 rounded border border-gray-100 dark:border-neutral-800/80">
                              <span className="text-gray-600 dark:text-gray-300 truncate max-w-[190px]">
                                {cred.pass}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(cred.pass, passKey)}
                                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-0.5"
                                title="Copy Password"
                              >
                                {copiedKey === passKey ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card Action Button */}
                <a
                  href={portal.defaultUrl}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all duration-150 ${portal.theme.buttonBg}`}
                >
                  <span>Launch {portal.title}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            );
          })}
        </div>

        {/* Global Context Footer Card */}
        <div className="mt-12 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Universal Organization ID (For All Logins)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Pre-configured in all portals. Required if manually entering org context.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-950 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-neutral-800">
              <span className="font-mono text-xs text-gray-700 dark:text-gray-300 select-all">
                00000000-0000-0000-0000-000000000001
              </span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard("00000000-0000-0000-0000-000000000001", "org-id")
                }
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1"
                title="Copy Org ID"
              >
                {copiedKey === "org-id" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
