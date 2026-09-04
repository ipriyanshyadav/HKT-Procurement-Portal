import { useEffect, useRef, useCallback, useState } from "react";
import { useAuthStore } from "@procurement/stores";

declare const process: { env: Record<string, string | undefined> };

export type AuctionMessage = {
  type: string;
  auction_id: string;
  ts: string;
  payload: Record<string, unknown>;
};

export function useAuctionSocket(auctionId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastMessage, setLastMessage] = useState<AuctionMessage | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!auctionId || !token) return;

    const wsBase = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
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
          } catch {}
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
  }, [auctionId, token]);

  const sendBid = useCallback((lotId: string | null, bidAmountInr: number) => {
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

  const ping = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "PING" }));
    }
  }, []);

  return { connected, lastMessage, sendBid, ping };
}
