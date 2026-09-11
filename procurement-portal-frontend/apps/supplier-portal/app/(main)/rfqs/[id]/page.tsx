"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function SupplierRfqRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params?.id as string;

  useEffect(() => {
    if (rfqId) {
      router.replace(`/rfqs/${rfqId}/bid`);
    }
  }, [rfqId, router]);

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/rfqs"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tenders</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1C1C1F] p-12 text-center shadow-sm">
        <div className="flex flex-col items-center gap-3 text-neutral-500 dark:text-neutral-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium">Opening tender bid submission...</p>
        </div>
      </div>
    </div>
  );
}
