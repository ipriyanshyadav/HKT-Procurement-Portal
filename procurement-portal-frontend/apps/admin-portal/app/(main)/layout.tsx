import type { ReactNode } from "react";
import Link from "next/link";
import { Providers } from "../providers";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="flex h-screen bg-gray-50 text-gray-900">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 text-white flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-800">
            <h1 className="text-lg font-bold tracking-tight text-white">Procurement Portal</h1>
            <p className="text-xs text-gray-400">Admin Console</p>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Master Data
              </p>
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/master-data/categories"
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    <span>📁</span>
                    <span>Categories</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/master-data/import"
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    <span>📥</span>
                    <span>CSV Bulk Import</span>
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                System
              </p>
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/"
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    <span>📊</span>
                    <span>Dashboard</span>
                  </Link>
                </li>
              </ul>
            </div>
          </nav>

          <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
            v1.0.0 · SPEC_24 Master Data
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </Providers>
  );
}
