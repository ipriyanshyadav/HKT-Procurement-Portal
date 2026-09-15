"use client";

import React, { useState } from "react";
import { useApiDocumentation } from "@procurement/hooks";
import {
  BookOpen,
  Code2,
  Lock,
  Radio,
  Package,
  AlertCircle,
  Loader2,
  Search,
  ExternalLink,
} from "lucide-react";

export default function DeveloperDocumentationPage() {
  const { data: docs, isLoading } = useApiDocumentation();
  const [selectedSlug, setSelectedSlug] = useState<string>("getting-started");
  const [search, setSearch] = useState("");

  const activeDoc = (docs || []).find((d) => d.slug === selectedSlug) || (docs || [])[0];

  const filteredDocs = (docs || []).filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-cyan-400" />
          <span>ProcureOS Documentation Hub</span>
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Technical architecture guides, OAuth & API Key protocols, and integration best practices.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar doc selector */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-xl bg-slate-900 border border-slate-800 pl-8 pr-3 py-2 text-slate-200"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          ) : (
            <nav className="space-y-1">
              {filteredDocs.map((doc) => (
                <button
                  key={doc.slug}
                  type="button"
                  onClick={() => setSelectedSlug(doc.slug)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    selectedSlug === doc.slug
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{doc.category}</div>
                  <div className="truncate">{doc.title}</div>
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Main Doc Content Viewer */}
        <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          {activeDoc ? (
            <>
              <div className="border-b border-slate-800 pb-4">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                  {activeDoc.category}
                </span>
                <h2 className="text-xl font-bold text-white mt-1">{activeDoc.title}</h2>
              </div>

              <div className="text-slate-300 text-xs sm:text-sm leading-relaxed space-y-4">
                <p>{activeDoc.content}</p>

                {activeDoc.slug === "getting-started" && (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <span className="font-semibold text-white text-xs block">Base API Endpoints:</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs font-mono">
                      <li>Production Gateway: <code>https://api.procureos.internal:8000/api/v1</code></li>
                      <li>Sandbox Gateway: <code>http://localhost:8000/api/v1</code></li>
                    </ul>
                  </div>
                )}

                {activeDoc.slug === "authentication" && (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <span className="font-semibold text-white text-xs block">Required Headers:</span>
                    <pre className="font-mono text-xs text-cyan-300 overflow-x-auto">
                      <code>{`Authorization: Bearer <JWT_ACCESS_TOKEN>\nX-ProcureOS-Key: prc_live_...\nX-Org-ID: 00000000-0000-0000-0000-000000000001`}</code>
                    </pre>
                  </div>
                )}

                {activeDoc.slug === "webhooks" && (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <span className="font-semibold text-white text-xs block">HMAC Signature Verification (Python):</span>
                    <pre className="font-mono text-xs text-cyan-300 overflow-x-auto">
                      <code>{`import hmac, hashlib\n\ndef verify(payload_bytes, secret, signature):\n    expected = "sha256=" + hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()\n    return hmac.compare_digest(expected, signature)`}</code>
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">Select a documentation article.</div>
          )}
        </div>
      </div>
    </div>
  );
}
