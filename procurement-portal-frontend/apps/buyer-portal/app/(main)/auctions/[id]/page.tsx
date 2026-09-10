"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LiveAuctionRoom } from "@procurement/ui";

export default function BuyerAuctionRoomPage() {
  const params = useParams();
  const auctionId = params.id as string;
  return <LiveAuctionRoom auctionId={auctionId} isHost={true} />;
}
