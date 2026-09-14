"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LifeBuoy,
  BookOpen,
  Headphones,
  ExternalLink,
  ShieldCheck,
  Star,
  CheckCircle2,
} from "lucide-react";
import { UATOverlay } from "@procurement/ui";

interface NavLink {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_LINKS: NavLink[] = [
  { label: "Tickets & Inquiries", href: "/", icon: LifeBuoy },
  { label: "Knowledge Base", href: "/kb", icon: BookOpen },
];

export default function SupportMainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col">
      <UATOverlay />

      {/* Top Header Bar */}
      <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight">ProcureOS Support Desk</span>
              <span className="text-[10px] font-semibold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 px-1.5 py-0.5 rounded">
                24/7 Enterprise SLA
              </span>
            </div>
            <span className="text-[11px] text-neutral-500">Procurement Discrepancy & Dispute Resolution Hub</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg text-amber-800 dark:text-amber-200 font-medium">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>Customer CSAT: <strong>4.9 / 5.0</strong></span>
          </div>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium transition-colors"
          >
            <span>Buyer Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Body with Sidebar */}
      <div className="flex-1 flex">
        <aside className="w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 p-4 space-y-6 hidden md:block">
          <div>
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 px-3">
              Helpdesk Navigation
            </div>
            <nav className="space-y-1">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 shadow-sm font-semibold"
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-sky-600" : "text-neutral-400"}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-3.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>SLA Target: &lt;30m</span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Discrepancies regarding 3-way invoice holds or ASN quantity variances are prioritized with critical SLA routing.
            </p>
          </div>
        </aside>

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
