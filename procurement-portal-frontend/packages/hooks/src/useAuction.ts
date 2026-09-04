import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, API_URL } from "@procurement/utils";

export interface AuctionBid {
  id: string;
  bidder_id: string;
  bidder_name: string;
  amount: number;
  remarks?: string | null;
  timestamp: string;
}

export interface AuctionState {
  rfq_id: string;
  current_lowest_bid: number;
  currency: string;
  min_decrement: number;
  total_bids: number;
  leading_bidder_id?: string | null;
  leading_bidder_name: string;
  status: "LIVE" | "PAUSED" | "ENDED";
  bids: AuctionBid[];
  ends_at: string;
}

interface APIEnvelope<T> {
  data: T;
  meta?: unknown;
}

export function useAuctionState(rfqId: string) {
  return useQuery({
    queryKey: ["auction", rfqId],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<AuctionState>>(`/rfqs/${rfqId}/auction/state`);
      return res.data.data;
    },
    enabled: Boolean(rfqId),
    refetchInterval: 10000, // Background polling backup for WebSocket
  });
}

export function usePlaceAuctionBid(rfqId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ amount, remarks }: { amount: number; remarks?: string }) => {
      const res = await apiClient.post<APIEnvelope<AuctionBid>>(`/rfqs/${rfqId}/auction/bid`, {
        amount,
        remarks,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction", rfqId] });
    },
  });
}

export function useAuctionRoom(rfqId: string) {
  const [liveState, setLiveState] = useState<AuctionState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastBid, setLastBid] = useState<AuctionBid | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial REST fetch as baseline
  const { data: initialData, isLoading } = useAuctionState(rfqId);

  // Sync initial query state
  useEffect(() => {
    if (initialData && !liveState) {
      setLiveState(initialData);
    }
  }, [initialData, liveState]);

  // WebSocket Connection
  useEffect(() => {
    if (!rfqId || typeof window === "undefined") return;

    let isMounted = true;

    const connectWs = () => {
      try {
        const wsBase = API_URL.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
        const wsUrl = `${wsBase}/api/v1/rfqs/${rfqId}/auction/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          setErrorMessage(null);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "AUCTION_STATE" && msg.data) {
              setLiveState(msg.data);
            } else if (msg.type === "NEW_BID" && msg.data) {
              const { bid, current_lowest_bid, total_bids, leading_bidder_name } = msg.data;
              setLastBid(bid);
              setLiveState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  current_lowest_bid,
                  total_bids,
                  leading_bidder_name,
                  leading_bidder_id: bid.bidder_id,
                  bids: [bid, ...prev.bids.filter((b) => b.id !== bid.id)],
                };
              });
            } else if (msg.type === "ERROR") {
              setErrorMessage(msg.message || "Auction room error");
            }
          } catch {
            // Ignore malformed WS frames
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          // Try to reconnect in 3 seconds
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setIsConnected(false);
        };
      } catch {
        setIsConnected(false);
      }
    };

    connectWs();

    // Heartbeat ping interval
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "PING" }));
      }
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [rfqId]);

  // Bid placement mutation
  const placeBidMutation = usePlaceAuctionBid(rfqId);

  const placeBid = useCallback(
    async (amount: number, remarks?: string) => {
      setErrorMessage(null);
      try {
        await placeBidMutation.mutateAsync({ amount, remarks });
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || err.message || "Failed to place bid";
        setErrorMessage(msg);
        throw err;
      }
    },
    [placeBidMutation]
  );

  return {
    auctionState: liveState || initialData || null,
    isLoading: isLoading && !liveState,
    isConnected,
    lastBid,
    errorMessage,
    clearError: () => setErrorMessage(null),
    placeBid,
    isSubmitting: placeBidMutation.isPending,
  };
}
