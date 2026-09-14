"use client";

import React from "react";
import { useApiChangelog } from "@procurement/hooks";
import { History, Sparkles, AlertTriangle, CheckCircle2, Loader2, GitCommit } from "lucide-react";

export default function DeveloperChangelogPage() {
  const { data: entries, isLoading } = useApiChangelog();

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <History className="w-6 h-6 text-cyan-400" />
          <span>API Changelog & Release Notes</span>
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Stay informed about schema deprecations, backwards-incompatible contract shifts, and newly minted endpoints.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : (
        <div className="space-y-8 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
          {(entries || []).map((entry) => (
            <div key={entry.version} className="relative pl-8 space-y-3">
              <div className="absolute left-1.5 top-1 w-5 h-5 rounded-full bg-slate-900 border-2 border-cyan-400 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-cyan-400">{entry.version}</span>
                    <span className="text-sm font-semibold text-white">{entry.title}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">{entry.release_date}</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{entry.description}</p>

                {entry.new_features && entry.new_features.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      New Features & Endpoints
                    </span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {entry.new_features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {entry.breaking_changes && entry.breaking_changes.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Breaking Changes
                    </span>
                    <ul className="space-y-1 text-xs text-amber-200">
                      {entry.breaking_changes.map((bc, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span>&bull;</span>
                          <span>{bc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
