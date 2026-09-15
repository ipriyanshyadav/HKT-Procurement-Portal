"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Building2, ChevronDown, Check, Search, Globe, Loader2, Shield } from "lucide-react";
import {
  useAccessibleCompanies,
  useSwitchCompanyContext,
  useMyOrganizations,
  useSwitchOrganization,
} from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";

export interface CompanySwitcherProps {
  className?: string;
  showRollupLink?: boolean;
}

export function CompanySwitcher({ className = "", showRollupLink = true }: CompanySwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentUser = useAuthStore((state) => state.user);
  const { data: myOrgs = [], isLoading: isOrgsLoading } = useMyOrganizations();
  const switchOrgMutation = useSwitchOrganization();

  const { data: companies = [], isLoading: isCompaniesLoading } = useAccessibleCompanies();
  const switchEntityMutation = useSwitchCompanyContext();

  const currentOrgId = currentUser?.org_id;
  const activeOrg = myOrgs.find((o) => o.org_id === currentOrgId) || myOrgs[0];
  const activeCompany = companies.find((c) => c.is_active_context) || companies[0];

  const displayName = activeOrg?.org_name || activeCompany?.name || "Select Organization";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredOrgs = myOrgs.filter((o) =>
    o.org_name.toLowerCase().includes(search.toLowerCase()) ||
    o.role_in_org.some((r) => r.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.country_code.toLowerCase().includes(search.toLowerCase()) ||
    (c.gstin && c.gstin.toLowerCase().includes(search.toLowerCase()))
  );

  const isSwitching = switchOrgMutation.isPending || switchEntityMutation.isPending;

  const handleSelectOrg = (targetOrgId: string) => {
    if (targetOrgId === currentOrgId) {
      setIsOpen(false);
      return;
    }
    switchOrgMutation.mutate(
      { target_org_id: targetOrgId },
      {
        onSuccess: () => {
          setIsOpen(false);
          if (typeof window !== "undefined") {
            window.location.reload();
          }
        },
      }
    );
  };

  const handleSelectEntity = (companyId: string) => {
    if (companyId === activeCompany?.id) {
      setIsOpen(false);
      return;
    }
    switchEntityMutation.mutate(
      { target_legal_entity_id: companyId },
      {
        onSettled: () => {
          setIsOpen(false);
        },
      }
    );
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isOrgsLoading || isCompaniesLoading || isSwitching}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100/80 hover:bg-neutral-200/70 dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 border border-neutral-200/90 dark:border-neutral-700/70 text-neutral-800 dark:text-neutral-200 transition-all duration-150 shadow-xs disabled:opacity-50"
        title="Switch active organization / company"
      >
        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span className="max-w-[140px] truncate font-medium">
          {displayName}
        </span>
        {activeOrg && (
          <span className="px-1.5 py-0.2 text-[9px] uppercase font-mono font-semibold tracking-wider rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Tenant
          </span>
        )}
        {isSwitching ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
        ) : (
          <ChevronDown
            className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-88 rounded-2xl bg-white/95 dark:bg-[#1C1C1F]/98 border border-neutral-200/90 dark:border-neutral-800 shadow-2xl py-2 z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 pb-2 pt-1 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Organizations & Entities
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                {myOrgs.length} orgs
              </span>
            </div>
            {(myOrgs.length > 2 || companies.length > 2) && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter organizations or entities..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-blue-500/50"
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto py-1 divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {/* Organizations (Tenant memberships) */}
            {filteredOrgs.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Tenant Organizations
                </div>
                {filteredOrgs.map((org) => {
                  const isActive = org.org_id === currentOrgId;
                  return (
                    <button
                      key={org.org_id}
                      type="button"
                      onClick={() => handleSelectOrg(org.org_id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                        isActive
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0 pr-2">
                        <Building2
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                            isActive ? "text-blue-500" : "text-neutral-400"
                          }`}
                        />
                        <div className="truncate">
                          <div className="truncate font-medium flex items-center gap-1.5">
                            <span>{org.org_name}</span>
                            {org.is_primary && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-normal">
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
                            <Shield className="w-2.5 h-2.5 text-neutral-400" />
                            <span>{org.role_in_org.join(", ")}</span>
                          </div>
                        </div>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Operating Legal Entities */}
            {filteredCompanies.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Operating Legal Entities
                </div>
                {filteredCompanies.map((company) => {
                  const isActive = company.id === activeCompany?.id;
                  return (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => handleSelectEntity(company.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                        isActive
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0 pr-2">
                        <Building2
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                            isActive ? "text-amber-500" : "text-neutral-400"
                          }`}
                        />
                        <div className="truncate">
                          <div className="truncate font-medium">{company.name}</div>
                          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
                            <span>{company.country_code}</span>
                            <span>•</span>
                            <span>{company.currency}</span>
                            <span>•</span>
                            <span>{company.business_unit_count} BUs</span>
                          </div>
                        </div>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredOrgs.length === 0 && filteredCompanies.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-neutral-500">
                No matching organizations or entities found
              </div>
            )}
          </div>

          {showRollupLink && (
            <div className="border-t border-neutral-100 dark:border-neutral-800 pt-1.5 px-2 mt-1">
              <Link
                href="/reports/cross-company"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  <span>Cross-Company Reporting</span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">View →</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
