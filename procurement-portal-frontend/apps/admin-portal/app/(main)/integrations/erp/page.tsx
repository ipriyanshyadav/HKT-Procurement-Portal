"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Network, ShieldCheck } from "lucide-react";
import { ERPGatewayReconciliationConsole } from "@procurement/ui";

export default function ERPGatewayPage() {
  return (
    <div className="min-h-screen bg-[#141416] p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1 text-neutral-400 hover:text-white"
            >
              <ArrowLeft className="h-3 w-3" />
              Integrations
            </Link>
            <span>/</span>
            <span>SPEC_20 Enterprise Integration</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Multi-ERP Bi-Directional Sync Gateway
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
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
