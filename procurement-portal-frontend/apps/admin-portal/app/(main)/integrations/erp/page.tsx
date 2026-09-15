"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Network, ShieldCheck } from "lucide-react";
import { ERPGatewayReconciliationConsole } from "@procurement/ui";

export default function ERPGatewayPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1 text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Integrations
            </Link>
            <span>/</span>
            <span>SPEC_20 Enterprise Integration</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Multi-ERP Bi-Directional Sync Gateway
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-neutral-400">
            Real-time synchronization across SAP S/4HANA (IDoc ORDERS05/INVOIC02), NetSuite SuiteTalk REST, and local procurement ledger with automated Dead Letter Queue recovery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-1.5 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Idempotent Checksum Lock Active
          </div>
        </div>
      </div>

      <ERPGatewayReconciliationConsole />
    </div>
  );
}
