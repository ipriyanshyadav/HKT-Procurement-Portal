"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Building2, ChevronDown, Check, Search, Globe, Loader2 } from "lucide-react";
import { useAccessibleCompanies, useSwitchCompanyContext } from "@procurement/hooks";

export interface CompanySwitcherProps {
  className?: string;
  showRollupLink?: boolean;
}

export function CompanySwitcher({ className = "", showRollupLink = true }: CompanySwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: companies = [], isLoading } = useAccessibleCompanies();
  const switchMutation = useSwitchCompanyContext();

  const activeCompany = companies.find((c) => c.is_active_context) || companies[0];

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

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.country_code.toLowerCase().includes(search.toLowerCase()) ||
    (c.gstin && c.gstin.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = (companyId: string) => {
    if (companyId === activeCompany?.id) {
      setIsOpen(false);
      return;
    }
    switchMutation.mutate(
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
        disabled={isLoading || switchMutation.isPending}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100/80 hover:bg-neutral-200/70 dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 border border-neutral-200/90 dark:border-neutral-700/70 text-neutral-800 dark:text-neutral-200 transition-all duration-150 shadow-xs disabled:opacity-50"
        title="Switch active operating company"
      >
        <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="max-w-[130px] truncate">
          {activeCompany ? activeCompany.name : "Select Company"}
        </span>
        {activeCompany?.currency && (
          <span className="px-1.5 py-0.2 text-[10px] uppercase font-mono font-semibold tracking-wider rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-300/60 dark:border-neutral-600">
            {activeCompany.currency}
          </span>
        )}
        {switchMutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white/95 dark:bg-[#1C1C1F]/98 border border-neutral-200/90 dark:border-neutral-800 shadow-2xl py-2 z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 pb-2 pt-1 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Operating Companies
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                {companies.length} accessible
              </span>
            </div>
            {companies.length > 3 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter entities..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-amber-500/50"
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {filteredCompanies.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-neutral-500">
                No matching legal entities found
              </div>
            ) : (
              filteredCompanies.map((company) => {
                const isActive = company.id === activeCompany?.id;
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleSelect(company.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                      isActive
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0 pr-2">
                      <Building2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? "text-amber-500" : "text-neutral-400"}`} />
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
                    {isActive && (
                      <Check className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {showRollupLink && (
            <div className="border-t border-neutral-100 dark:border-neutral-800 pt-1.5 px-2 mt-1">
              <Link
                href="/analytics/rollup"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  <span>Group Spend Rollup Cockpit</span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">Rollup →</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
