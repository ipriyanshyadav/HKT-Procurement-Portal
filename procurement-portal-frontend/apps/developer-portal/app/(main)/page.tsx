"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Code2,
  Terminal,
  Key,
  Box,
  BookOpen,
  ArrowRight,
  Copy,
  Check,
  Zap,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

export default function DeveloperOverviewPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const curlSnippets = [
    {
      title: "1. Authenticate with API Key",
      code: `curl -X GET "http://localhost:8000/api/v1/developer/scopes" \\
  -H "X-ProcureOS-Key: prc_live_sample_key_12345" \\
  -H "Content-Type: application/json"`,
    },
    {
      title: "2. Fetch Approved Requisitions",
      code: `curl -X GET "http://localhost:8000/api/v1/requisitions?status=APPROVED" \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "X-Org-ID: 00000000-0000-0000-0000-000000000001"`,
    },
    {
      title: "3. Confirm Consignee Goods Receipt (GRN)",
      code: `curl -X POST "http://localhost:8000/api/v1/grn/<GRN_ID>/consignee-confirm" \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"confirmation_note": "Inspection passed on dock #3"}'`,
    },
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-8 sm:p-10 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ProcureOS Enterprise API Platform (SPEC_28)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Build, Integrate & Automate on ProcureOS
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Connect ERPs (SAP, Oracle, Dynamics), automate purchase orders, stream live reverse auction events, and test risk-free in isolated multi-tenant sandboxes.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/keys"
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
            >
              <Key className="w-4 h-4" />
              <span>Get API Keys</span>
            </Link>
            <Link
              href="/sandbox"
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-2"
            >
              <Box className="w-4 h-4 text-cyan-400" />
              <span>Launch Sandbox</span>
            </Link>
            <Link
              href="/docs"
              className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white font-medium text-xs transition-colors flex items-center gap-1.5"
            >
              <span>Explore Docs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Feature Pillar Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">High-Throughput REST APIs</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Over 100+ fine-grained endpoints covering the complete S2P journey: Requisitions, Sourcing RFQs, 3-Way Invoicing & Payments.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">HMAC Signed Webhooks</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Guaranteed at-least-once event delivery for order updates, approvals, and invoices with SHA-256 cryptographic signatures.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Interactive Sandbox & Time Travel</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Test edge cases, simulate SLA breaches, and advance time by days to evaluate automated escalation workflows without affecting live data.
          </p>
        </div>
      </div>

      {/* Quickstart Code Snippets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Quickstart Request Samples</h2>
            <p className="text-xs text-slate-400">Executable curl examples for initial integration</p>
          </div>
          <Link
            href="/reference"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
          >
            <span>Full API Reference</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-4">
          {curlSnippets.map((snippet, idx) => (
            <div
              key={snippet.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-sm"
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/60 border-b border-slate-800">
                <span className="text-xs font-semibold text-slate-300">{snippet.title}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(snippet.code, idx)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                <code>{snippet.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
