"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Terminal,
  Key,
  Box,
  BookOpen,
  History,
  FileCode,
  ExternalLink,
  Code2,
  Sparkles,
  ShieldCheck,
  Server,
} from "lucide-react";
import { UATOverlay } from "@procurement/ui";

interface NavLink {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_LINKS: NavLink[] = [
  { label: "Overview & Quickstart", href: "/", icon: Terminal },
  { label: "API Keys & Webhooks", href: "/keys", icon: Key },
  { label: "Sandbox Console", href: "/sandbox", icon: Box },
  { label: "Documentation Hub", href: "/docs", icon: BookOpen },
  { label: "API Changelog", href: "/changelog", icon: History },
  { label: "Interactive Reference", href: "/reference", icon: FileCode },
];

export default function DeveloperMainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <UATOverlay />

      {/* Top Header Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">ProcureOS Developer Platform</span>
              <span className="text-[10px] font-mono bg-cyan-950 border border-cyan-700/50 text-cyan-300 px-1.5 py-0.5 rounded">
                v2.4
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Enterprise REST APIs, Event Webhooks & Isolated Sandbox</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>API Gateway: <strong>Online (Port 8000)</strong></span>
          </div>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            <span>Buyer Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="flex-1 flex">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900/50 p-4 space-y-6 hidden md:block">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-3">
              Developer Navigation
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
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-3 bg-gradient-to-b from-slate-800/60 to-slate-900/60 rounded-xl border border-slate-800 text-[11px] space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Sandbox Isolation</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Sandbox operations run with zero risk to production financial databases. Reset or time-travel at any time.
            </p>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
