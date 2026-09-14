"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "@procurement/stores";
import { FlaskConical, AlertTriangle, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";

export function UATOverlay(): React.ReactElement | null {
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions) || [];
  const [minimized, setMinimized] = useState(false);

  const isQATester = Boolean(
    user?.role_names?.includes("QA_TESTER") ||
      permissions.includes("qa.access_test_mode") ||
      permissions.includes("qa.execute_tests")
  );

  useEffect(() => {
    if (!isQATester || typeof document === "undefined") return;

    if (!document.title.startsWith("[TEST] ")) {
      document.title = `[TEST] ${document.title}`;
    }
  }, [isQATester]);

  if (!isQATester) return null;

  return (
    <>
      {/* Top 2px amber border line */}
      <div
        className="fixed top-0 left-0 right-0 h-1 bg-amber-500 z-[99999] pointer-events-none shadow-[0_1px_4px_rgba(245,158,11,0.5)]"
        role="status"
        aria-label="UAT Test Mode Active"
      />

      {/* Floating HUD at bottom right */}
      <div className="fixed bottom-4 right-4 z-[99999] flex flex-col items-end">
        {minimized ? (
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs px-3 py-2 rounded-full shadow-lg transition-transform hover:scale-105"
            title="Expand UAT Overlay"
          >
            <FlaskConical className="w-4 h-4 animate-pulse" />
            <span>UAT Test Mode</span>
            <ChevronUp className="w-3 h-3" />
          </button>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/90 border-2 border-amber-500 rounded-xl p-3.5 shadow-2xl max-w-xs text-amber-900 dark:text-amber-100 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 font-semibold text-xs text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                <span>UAT / QA Active</span>
              </div>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="p-1 text-amber-700 hover:text-amber-900 dark:text-amber-300 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
                aria-label="Minimize HUD"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/90 mb-2">
              You are testing in QA isolation. Records created will be marked as test data (<code>is_test_record=true</code>) and excluded from production financial ledgers.
            </p>

            <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Safety Sandbox Protocol Active</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
