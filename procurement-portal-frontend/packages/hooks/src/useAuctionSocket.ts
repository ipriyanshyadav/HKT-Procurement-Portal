import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@procurement/stores";

declare const process: { env: Record<string, string | undefined> };

export type AuctionMessage = {
  type: string;
  auction_id: string;
  ts: string;
  payload: Record<string, unknown>;
};

export interface SocketRankEntry {
  rank: number;
  vendor_id: string;
  vendor_name: string;
  bid_amount_inr: number;
  submitted_at: string;
}

export interface SocketMyRank {
  lot_id?: string | null;
  your_rank?: number | null;
  your_bid_inr?: number | null;
  l1_price_inr?: number | null;
}

export interface UseAuctionSocketOptions {
  onNewBid?: (payload: Record<string, unknown>) => void;
  onLeaderboardUpdate?: (rankings: SocketRankEntry[]) => void;
  onRankUpdate?: (myRank: SocketMyRank) => void;
  onAuctionExtended?: (newCloseAt: string, count: number) => void;
  onAuctionClosed?: (winnerVendorId?: string | null) => void;
  onAuctionCancelled?: (reason?: string) => void;
  onBidRejected?: (reason: string) => void;
}

export function useAuctionSocket(auctionId: string, options?: UseAuctionSocketOptions) {
  const token = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<AuctionMessage | null>(null);
  const [rankings, setRankings] = useState<SocketRankEntry[]>([]);
  const [myRank, setMyRank] = useState<SocketMyRank | null>(null);
  const [l1Price, setL1Price] = useState<number | null>(null);
  const [totalBids, setTotalBids] = useState<number>(0);
  const [closeAt, setCloseAt] = useState<string | null>(null);
  const [extensionCount, setExtensionCount] = useState<number>(0);
  const [auctionStatus, setAuctionStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!auctionId || !token) return;

    let wsBase =
      typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname.includes(":") && !window.location.hostname.startsWith("[") ? `[${window.location.hostname}]` : window.location.hostname}:8000`
        : process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    const url = `${wsBase}/ws/auction/${auctionId}?token=${token}`;

    const connect = () => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          reconnectCount.current = 0;
        };

        ws.onclose = () => {
          setConnected(false);
          // Exponential back-off reconnect (max 30s)
          const delay = Math.min(1000 * 2 ** reconnectCount.current, 30000);
          reconnectCount.current += 1;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        };

        ws.onmessage = (e) => {
          try {
            const msg: AuctionMessage = JSON.parse(e.data);
            setLastMessage(msg);

            const payload = msg.payload || {};

            switch (msg.type) {
              case "LEADERBOARD_UPDATE": {
                const newRanks = (payload.rankings as SocketRankEntry[]) || [];
                setRankings(newRanks);
                if (newRanks.length > 0 && newRanks[0].bid_amount_inr != null) {
                  setL1Price(Number(newRanks[0].bid_amount_inr));
                }
                optionsRef.current?.onLeaderboardUpdate?.(newRanks);
                queryClient.invalidateQueries({ queryKey: ["auction-leaderboard", auctionId] });
                queryClient.invalidateQueries({ queryKey: ["auction-bids", auctionId] });
                break;
              }
              case "RANK_UPDATE": {
                const updatedMyRank: SocketMyRank = {
                  lot_id: payload.lot_id as string | undefined,
                  your_rank: payload.your_rank as number | undefined,
                  your_bid_inr: payload.your_bid_inr as number | undefined,
                  l1_price_inr: payload.l1_price_inr as number | undefined,
                };
                setMyRank(updatedMyRank);
                if (updatedMyRank.l1_price_inr != null) {
                  setL1Price(Number(updatedMyRank.l1_price_inr));
                }
                optionsRef.current?.onRankUpdate?.(updatedMyRank);
                queryClient.invalidateQueries({ queryKey: ["auction-my-rank", auctionId] });
                break;
              }
              case "NEW_BID": {
                if (payload.l1_price_inr != null) {
                  setL1Price(Number(payload.l1_price_inr));
                }
                if (payload.total_bids != null) {
                  setTotalBids(Number(payload.total_bids));
                }
                optionsRef.current?.onNewBid?.(payload);
                queryClient.invalidateQueries({ queryKey: ["auction-bids", auctionId] });
                break;
              }
              case "AUCTION_OPENED": {
                setAuctionStatus("OPEN");
                if (payload.close_at) {
                  setCloseAt(payload.close_at as string);
                }
                queryClient.invalidateQueries({ queryKey: ["live-auction", auctionId] });
                break;
              }
              case "AUCTION_EXTENDED": {
                if (payload.new_close_at) {
                  setCloseAt(payload.new_close_at as string);
                }
                if (payload.extension_count != null) {
                  setExtensionCount(Number(payload.extension_count));
                }
                optionsRef.current?.onAuctionExtended?.(
                  payload.new_close_at as string,
                  Number(payload.extension_count || 0)
                );
                queryClient.invalidateQueries({ queryKey: ["live-auction", auctionId] });
                break;
              }
              case "AUCTION_CLOSED": {
                setAuctionStatus("CLOSED");
                optionsRef.current?.onAuctionClosed?.(payload.winner_vendor_id as string | null);
                queryClient.invalidateQueries({ queryKey: ["live-auction", auctionId] });
                break;
              }
              case "AUCTION_CANCELLED": {
                setAuctionStatus("CANCELLED");
                optionsRef.current?.onAuctionCancelled?.(payload.reason as string | undefined);
                queryClient.invalidateQueries({ queryKey: ["live-auction", auctionId] });
                break;
              }
              case "RESULTS_RELEASED": {
                setAuctionStatus("RESULTS_RELEASED");
                queryClient.invalidateQueries({ queryKey: ["live-auction", auctionId] });
                break;
              }
              case "BID_REJECTED": {
                const reason = (payload.reason as string) || "Bid not competitive";
                setRejectionReason(reason);
                optionsRef.current?.onBidRejected?.(reason);
                break;
              }
              default:
                break;
            }
          } catch {
            // Ignore malformed message frames
          }
        };
      } catch {
        setConnected(false);
      }
    };

    connect();

    // Heartbeat PING sent every 25 seconds via setInterval to prevent proxy timeout
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "PING" }));
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [auctionId, token, queryClient]);

  const sendBid = useCallback((lotId: string | null, bidAmountInr: number) => {
    setRejectionReason(null);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "SUBMIT_BID",
          lot_id: lotId,
          bid_amount_inr: bidAmountInr,
        })
      );
    }
  }, []);

  const sendProxyFloor = useCallback((lotId: string | null, floorAmountInr: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "SET_PROXY_FLOOR",
          lot_id: lotId,
          floor_amount_inr: floorAmountInr,
        })
      );
    }
  }, []);

  const ping = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "PING" }));
    }
  }, []);

  return {
    connected,
    lastMessage,
    rankings,
    myRank,
    l1Price,
    totalBids,
    closeAt,
    extensionCount,
    auctionStatus,
    rejectionReason,
    clearRejection: () => setRejectionReason(null),
    sendBid,
    sendProxyFloor,
    ping,
  };
}

