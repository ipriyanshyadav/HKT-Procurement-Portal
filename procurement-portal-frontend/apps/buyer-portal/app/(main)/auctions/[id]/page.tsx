"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveAuction } from "@procurement/hooks";
import { ArrowLeft, Gavel, Loader2 } from "lucide-react";

export default function BuyerAuctionRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const auctionId = params?.id as string;
  const { data: auction, isLoading } = useLiveAuction(auctionId);

  useEffect(() => {
    if (auction?.rfq_id) {
      router.replace(`/rfqs/${auction.rfq_id}/auction`);
    }
  }, [auction, router]);

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/auctions"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Live Auctions</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1C1C1F] p-12 text-center shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-neutral-500 dark:text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium">Entering reverse auction room...</p>
          </div>
        ) : auction ? (
          <div className="space-y-4">
            <Gavel className="w-10 h-10 mx-auto text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Auction #{auctionId.slice(0, 8)}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              Status: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{auction.status}</span>
            </p>
            {auction.rfq_id && (
              <Link
                href={`/rfqs/${auction.rfq_id}/auction`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium text-xs hover:bg-blue-500 shadow-sm"
              >
                <span>Enter Live Auction Floor</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Auction Not Found
            </h3>
            <p className="text-xs text-neutral-500">
              The requested reverse auction could not be located or has been archived.
            </p>
            <Link
              href="/auctions"
              className="inline-block mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Return to Auctions
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
