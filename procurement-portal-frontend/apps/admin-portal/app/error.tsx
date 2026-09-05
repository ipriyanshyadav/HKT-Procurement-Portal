"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@procurement/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="apple-card max-w-md w-full text-center p-8 border border-red-500/20 shadow-2xl bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl rounded-2xl">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 shadow-inner">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
          Admin Console Error
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
          {error.message || "An unexpected error occurred while loading this admin module."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={<RefreshCw className="w-4 h-4 mr-1.5" />}
            onClick={() => reset()}
          >
            Try Again
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.location.href = "/"}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
