"use client";

import React from "react";
import { ShieldAlert, Crown, ArrowLeft, LifeBuoy, Users, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ENTERPRISE_PERSONAS, EnterprisePersona } from "@procurement/stores";

export interface AccessRestrictedCardProps {
  moduleName: string;
  requiredRoles: string[];
  activePersonaName: string;
  activePersonaTitle: string;
  activeRoles: string[];
  reason?: string;
  isSuperAdminUser?: boolean;
  isEmulating?: boolean;
  onSwitchToSuperAdmin?: () => void;
  onSelectPersona?: (persona: EnterprisePersona) => void;
  homeHref?: string;
}

export function AccessRestrictedCard({
  moduleName,
  requiredRoles,
  activePersonaName,
  activePersonaTitle,
  activeRoles,
  reason,
  isSuperAdminUser = false,
  isEmulating = false,
  onSwitchToSuperAdmin,
  onSelectPersona,
  homeHref = "/",
}: AccessRestrictedCardProps) {
  const [showPersonaPicker, setShowPersonaPicker] = React.useState(false);

  return (
    <div className="w-full max-w-3xl mx-auto my-8 px-4">
      <div className="relative overflow-hidden rounded-3xl border border-red-500/30 dark:border-red-500/40 bg-gradient-to-b from-red-500/10 via-white/95 to-amber-500/5 dark:from-red-950/40 dark:via-neutral-900/95 dark:to-neutral-950/90 backdrop-blur-2xl shadow-2xl p-6 sm:p-10 text-center">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-red-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        {/* Big Pulsing Danger Sign */}
        <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mb-6">
          <div className="absolute inset-0 rounded-3xl bg-red-500/20 dark:bg-red-500/30 blur-xl animate-pulse" />
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-red-600 via-red-500 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-red-500/30 ring-4 ring-red-500/20">
            <ShieldAlert className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
        </div>

        {/* Danger Pill Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 mb-3 shadow-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
          <span>Access Restricted &bull; Authorization Required</span>
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight mb-2">
          You are not authorized to use {moduleName}
        </h2>

        {/* Description */}
        <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xl mx-auto mb-6">
          {reason ||
            `Your active persona (${activePersonaName}) does not have the required role permissions to view or execute operations in this section.`}
        </p>

        {/* Security Clearance Breakdown Box */}
        <div className="text-left rounded-2xl bg-white/80 dark:bg-neutral-950/70 border border-red-500/20 dark:border-red-500/30 p-4 sm:p-5 mb-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-2.5">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Active Persona / User:
            </span>
            <span className="text-xs font-bold text-neutral-900 dark:text-white">
              {activePersonaName} <span className="opacity-75 font-normal">({activePersonaTitle})</span>
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-2.5">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Assigned Roles:
            </span>
            <div className="flex flex-wrap gap-1 justify-end max-w-md">
              {activeRoles.length > 0 ? (
                activeRoles.map((role) => (
                  <span
                    key={role}
                    className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[11px] font-mono font-medium"
                  >
                    {role}
                  </span>
                ))
              ) : (
                <span className="text-xs text-neutral-400">None assigned</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              Required Role(s) for Access:
            </span>
            <div className="flex flex-wrap gap-1 justify-end max-w-md">
              {requiredRoles.map((role) => (
                <span
                  key={role}
                  className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60 text-[11px] font-mono font-bold"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Super Admin Quick Recovery Actions */}
        {isSuperAdminUser && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/15 to-orange-500/15 border border-amber-500/30 p-4 sm:p-5 mb-6 text-left shadow-sm">
            <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                  👑
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                    Super Admin Recovery Control
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    You are logged in as Alexander Vance. You can restore full omnipotent access at any time.
                  </p>
                </div>
              </div>

              {onSwitchToSuperAdmin && (
                <button
                  type="button"
                  onClick={onSwitchToSuperAdmin}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-neutral-950 font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer"
                >
                  <Crown className="w-4 h-4 text-neutral-950" />
                  <span>Switch to Super Admin</span>
                </button>
              )}
            </div>

            {/* Persona Switcher Quick Drawer */}
            {onSelectPersona && (
              <div className="mt-3 pt-3 border-t border-amber-500/20">
                <button
                  type="button"
                  onClick={() => setShowPersonaPicker((prev) => !prev)}
                  className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{showPersonaPicker ? "Hide Persona Switcher" : "Test with another persona"}</span>
                </button>

                {showPersonaPicker && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pt-1">
                    {ENTERPRISE_PERSONAS.map((p) => {
                      const isAuthorized = requiredRoles.some((rr) => p.roles.includes(rr));
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onSelectPersona(p)}
                          className={`flex items-center justify-between p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            isAuthorized
                              ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 hover:border-emerald-500"
                              : "bg-white/60 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">{p.icon}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                {p.name}
                              </p>
                              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                                {p.title}
                              </p>
                            </div>
                          </div>
                          {isAuthorized && (
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5 flex-shrink-0">
                              <CheckCircle className="w-3 h-3" /> Authorized
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Standard User Recovery Actions */}
        {!isSuperAdminUser && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={homeHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to My Dashboard</span>
            </Link>
            <Link
              href="/tickets"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Request Role Permission</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
