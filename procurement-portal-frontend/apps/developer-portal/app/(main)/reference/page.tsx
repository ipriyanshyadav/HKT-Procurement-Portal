"use client";

import React, { useState } from "react";
import { FileCode, ExternalLink, Globe, ChevronRight, Check } from "lucide-react";

interface EndpointDoc {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  tag: string;
  summary: string;
  authRequired: boolean;
  sampleCurl: string;
}

const ENDPOINTS: EndpointDoc[] = [
  {
    method: "GET",
    path: "/api/v1/indent/cart",
    tag: "Indent Cart",
    summary: "Retrieve active indent shopping cart for the current department indentor",
    authRequired: true,
    sampleCurl: `curl -X GET "http://localhost:8000/api/v1/indent/cart" \\\n  -H "Authorization: Bearer <TOKEN>"`,
  },
  {
    method: "POST",
    path: "/api/v1/indent/cart/{cart_id}/transfer",
    tag: "Indent Cart",
    summary: "Transfer cart line items into a formal purchase requisition assigned to a sourcing buyer",
    authRequired: true,
    sampleCurl: `curl -X POST "http://localhost:8000/api/v1/indent/cart/<ID>/transfer" \\\n  -H "Authorization: Bearer <TOKEN>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"transfer_note": "Urgent Q3 project requirement"}'`,
  },
  {
    method: "POST",
    path: "/api/v1/grn/{id}/consignee-confirm",
    tag: "Goods Receipt",
    summary: "Consignee electronic verification and CRAC generation",
    authRequired: true,
    sampleCurl: `curl -X POST "http://localhost:8000/api/v1/grn/<ID>/consignee-confirm" \\\n  -H "Authorization: Bearer <TOKEN>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"confirmation_note": "Items accepted in full"}'`,
  },
  {
    method: "GET",
    path: "/api/v1/developer/keys",
    tag: "Developer Platform",
    summary: "List active API keys for the current organization",
    authRequired: true,
    sampleCurl: `curl -X GET "http://localhost:8000/api/v1/developer/keys" \\\n  -H "Authorization: Bearer <TOKEN>"`,
  },
  {
    method: "POST",
    path: "/api/v1/developer/sandbox/reset",
    tag: "Developer Platform",
    summary: "Reset sandbox tenant data to clean mock state",
    authRequired: true,
    sampleCurl: `curl -X POST "http://localhost:8000/api/v1/developer/sandbox/reset" \\\n  -H "Authorization: Bearer <TOKEN>"`,
  },
  {
    method: "GET",
    path: "/api/v1/superadmin/reports/overview",
    tag: "SuperAdmin Reports",
    summary: "Cross-company aggregated GMV and tenant transaction metrics",
    authRequired: true,
    sampleCurl: `curl -X GET "http://localhost:8000/api/v1/superadmin/reports/overview" \\\n  -H "Authorization: Bearer <TOKEN>"`,
  },
];

export default function InteractiveReferencePage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDoc>(ENDPOINTS[0]);
  const [copied, setCopied] = useState(false);

  const getMethodBadge = (m: string) => {
    switch (m) {
      case "GET":
        return "bg-blue-500/20 text-blue-400 border-blue-500/40";
      case "POST":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      case "PUT":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "DELETE":
        return "bg-red-500/20 text-red-400 border-red-500/40";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/40";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileCode className="w-6 h-6 text-cyan-400" />
            <span>Interactive API Reference</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Browse endpoints, expected headers, and payload structures.
          </p>
        </div>

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-400 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <span>Swagger OpenAPI Docs</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Endpoint List */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
            Selected Endpoints ({ENDPOINTS.length})
          </div>
          <div className="space-y-1">
            {ENDPOINTS.map((ep) => (
              <button
                key={`${ep.method}-${ep.path}`}
                type="button"
                onClick={() => setSelectedEndpoint(ep)}
                className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                  selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method
                    ? "bg-slate-900 border-cyan-500/40 shadow-sm"
                    : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60 text-slate-400"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded border ${getMethodBadge(
                      ep.method
                    )}`}
                  >
                    {ep.method}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">{ep.tag}</span>
                </div>
                <div className="font-mono text-white text-xs truncate">{ep.path}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Endpoint Detail Pane */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="space-y-2 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${getMethodBadge(
                  selectedEndpoint.method
                )}`}
              >
                {selectedEndpoint.method}
              </span>
              <span className="font-mono text-sm font-semibold text-white">{selectedEndpoint.path}</span>
            </div>
            <p className="text-xs text-slate-300">{selectedEndpoint.summary}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Request Example</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(selectedEndpoint.sampleCurl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                <span>{copied ? "Copied" : "Copy cURL"}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed">
              <code>{selectedEndpoint.sampleCurl}</code>
            </pre>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs space-y-2">
            <span className="font-semibold text-white block">Standard Envelope Guarantee</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Every endpoint response conforms to the standard envelope format: <code>{"{ success: true, data: { ... }, timestamp: \"...\" }"}</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
