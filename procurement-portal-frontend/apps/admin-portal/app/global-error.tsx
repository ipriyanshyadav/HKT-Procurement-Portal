"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 dark:bg-black font-sans text-neutral-900 dark:text-neutral-100 antialiased">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center p-8 bg-white dark:bg-[#1C1C1E] border border-red-500/20 shadow-2xl rounded-2xl">
            <h2 className="text-xl font-bold mb-2">Critical Console Error</h2>
            <p className="text-sm text-neutral-500 mb-6">
              {error.message || "A fatal error occurred in the administration portal."}
            </p>
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-[#0071E3] text-white rounded-xl text-sm font-medium hover:bg-[#0077ED] transition-colors"
            >
              Reset Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
