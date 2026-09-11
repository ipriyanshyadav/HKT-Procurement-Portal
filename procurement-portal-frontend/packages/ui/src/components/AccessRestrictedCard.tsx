"use client";

import React from "react";
import { Lock, Crown, ArrowLeft, LifeBuoy, Users, CheckCircle, Shield } from "lucide-react";
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
    <div className="w-full max-w-2xl mx-auto my-10 px-4">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm p-6 sm:p-8 text-center">
        {/* Refined Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 mb-4">
          <Lock className="w-7 h-7 stroke-[1.75]" />
        </div>

        {/* Clean Neutral Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 mb-3">
          <Shield className="w-3.5 h-3.5" />
          <span>Access Restricted</span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight mb-2">
          Authorization Required for {moduleName}
        </h2>

        {/* Description */}
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mb-6">
          {reason ||
            `Your current role as ${activePersonaName} does not have access permissions for this section.`}
        </p>

        {/* Security Clearance Breakdown Box */}
        <div className="text-left rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-800 pb-2.5">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Active Persona:
            </span>
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              {activePersonaName} <span className="text-neutral-400 font-normal">({activePersonaTitle})</span>
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-800 pb-2.5">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Your Current Roles:
            </span>
            <div className="flex flex-wrap gap-1 justify-end max-w-md">
              {activeRoles.length > 0 ? (
                activeRoles.map((role) => (
                  <span
                    key={role}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-[11px] font-mono"
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
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Required Role(s):
            </span>
            <div className="flex flex-wrap gap-1 justify-end max-w-md">
              {requiredRoles.map((role) => (
                <span
                  key={role}
                  className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[11px] font-mono font-medium"
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
