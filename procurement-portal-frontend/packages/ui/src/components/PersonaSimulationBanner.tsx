"use client";

import React from "react";
import { Crown, Sparkles, X, ChevronRight, UserCheck } from "lucide-react";
import { EnterprisePersona } from "@procurement/stores";

export interface PersonaSimulationBannerProps {
  persona: EnterprisePersona;
  onExitPersona: () => void;
  onSwitchPersona?: () => void;
}

export function PersonaSimulationBanner({
  persona,
  onExitPersona,
  onSwitchPersona,
}: PersonaSimulationBannerProps) {
  return (
    <div className="w-full bg-gradient-to-r from-purple-950/95 via-indigo-950/95 to-slate-950/95 text-white px-4 sm:px-6 py-2 text-xs font-medium shadow-lg flex items-center justify-between border-b border-purple-500/30 backdrop-blur-xl sticky top-[52px] z-30 transition-all">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-sm flex-shrink-0 shadow-inner">
          {persona.icon || "🎭"}
        </span>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
            SIMULATION
          </span>
          <span className="font-semibold text-neutral-100 tracking-tight">
            {persona.name}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-white/10 text-purple-200 text-[10px] font-medium border border-white/10">
            {persona.title}
          </span>
          <span className="hidden md:inline text-neutral-400 text-[11px]">
            &bull; Roles: {persona.roles.join(", ")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {onSwitchPersona && (
          <button
            type="button"
            onClick={onSwitchPersona}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-neutral-200 font-medium text-xs transition-colors cursor-pointer border border-white/10"
          >
            <UserCheck className="w-3.5 h-3.5 text-purple-300" />
            <span>Switch Persona</span>
          </button>
        )}
        <button
          type="button"
          onClick={onExitPersona}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-xs shadow-md transition-all active:scale-95 cursor-pointer ring-1 ring-amber-400/30"
          title="Restore full Super Admin access (Alexander Vance)"
        >
          <Crown className="w-3.5 h-3.5 text-amber-200" />
          <span>Exit to Super Admin</span>
        </button>
      </div>
    </div>
  );
}
