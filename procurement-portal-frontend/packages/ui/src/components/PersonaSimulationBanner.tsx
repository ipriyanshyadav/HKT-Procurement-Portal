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
    <div className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-neutral-950 px-4 py-2 text-xs font-medium shadow-md flex items-center justify-between border-b border-amber-600/30 sticky top-14 z-30 transition-all">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-6 h-6 rounded-lg bg-neutral-950/10 flex items-center justify-center text-sm flex-shrink-0">
          {persona.icon || "🎭"}
        </span>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-bold text-neutral-950 tracking-tight">
            Active Persona Simulation: {persona.name}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-neutral-950/15 text-neutral-900 text-[10px] font-mono font-bold">
            {persona.title}
          </span>
          <span className="hidden md:inline text-neutral-800 text-[11px]">
            &bull; Scoped Roles: {persona.roles.join(", ")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {onSwitchPersona && (
          <button
            type="button"
            onClick={onSwitchPersona}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-950/10 hover:bg-neutral-950/20 text-neutral-900 font-semibold text-[11px] transition-colors cursor-pointer"
          >
            <UserCheck className="w-3 h-3" />
            <span>Switch Persona</span>
          </button>
        )}
        <button
          type="button"
          onClick={onExitPersona}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-neutral-950 hover:bg-neutral-900 text-amber-300 font-bold text-[11px] shadow-sm transition-transform active:scale-95 cursor-pointer"
          title="Restore full Super Admin access (Alexander Vance)"
        >
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>Exit to Super Admin</span>
        </button>
      </div>
    </div>
  );
}
