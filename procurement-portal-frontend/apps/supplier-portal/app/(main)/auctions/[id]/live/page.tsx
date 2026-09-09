"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LiveAuctionRoom } from "@procurement/ui";

export default function SupplierAuctionRoomPage() {
  const params = useParams();
  const auctionId = params.id as string;
  return <LiveAuctionRoom auctionId={auctionId} isHost={false} />;
}
