"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function BuyerAuctionRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const auctionId = (params?.id as string) || "";

  useEffect(() => {
    if (auctionId) {
      router.replace(`/rfqs/${auctionId}/auction`);
    }
  }, [auctionId, router]);

  return (
    <div className="max-w-4xl mx-auto p-12 text-center space-y-3">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-sm text-gray-500">Redirecting to Live Auction Room…</p>
    </div>
  );
}
