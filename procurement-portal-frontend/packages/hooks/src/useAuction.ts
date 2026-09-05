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

// -----------------------------------------------------------------------------
// SPEC_11B: Persistent Database-Backed Live Reverse Auction Engine
// -----------------------------------------------------------------------------

export interface AuctionConfig {
  auction_start_at: string;
  auction_duration_minutes: number;
  lot_ids?: string[];
  reserve_price_inr?: number | null;
  min_decrement_type: "PERCENTAGE" | "ABSOLUTE";
  min_decrement_value: number;
  rank_visibility: "RANK_ONLY" | "PRICE_AND_RANK" | "NO_RANK";
  auto_extend: boolean;
  auto_extend_trigger_minutes: number;
  auto_extend_duration_minutes: number;
  max_extensions: number;
  allow_proxy_bid: boolean;
  require_all_lots: boolean;
}

export interface LiveAuctionDetail {
  id: string;
  org_id: string;
  rfq_id: string;
  rfq_number?: string | null;
  rfq_title?: string | null;
  status: "SCHEDULED" | "OPEN" | "PAUSED" | "CLOSED" | "CANCELLED" | "RESULTS_RELEASED";
  config: AuctionConfig;
  scheduled_start_at: string;
  actual_start_at?: string | null;
  current_close_at: string;
  extension_count: number;
  winner_vendor_id?: string | null;
  winning_bid_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LiveAuctionRankEntry {
  rank: number;
  vendor_id: string;
  vendor_name: string;
  bid_amount_inr: number;
  submitted_at: string;
}

export interface LiveAuctionMyRank {
  lot_id?: string | null;
  your_rank?: number | null;
  your_bid_inr?: number | null;
  l1_price_inr?: number | null;
  status?: string;
}

export interface LiveAuctionBidHistoryItem {
  id: string;
  bid_sequence: number;
  lot_id?: string | null;
  vendor_id: string;
  vendor_name?: string;
  bid_amount_inr: number;
  is_proxy_bid: boolean;
  is_valid: boolean;
  created_at: string;
}

export interface CreateAuctionPayload {
  rfq_id: string;
  config: AuctionConfig;
}

export function useLiveAuctions(params?: { rfq_id?: string; status?: string }) {
  return useQuery({
    queryKey: ["live-auctions", params],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<LiveAuctionDetail[]>>("/auctions", {
        params: { rfq_id: params?.rfq_id, status: params?.status },
      });
      return res.data.data;
    },
    enabled: params?.rfq_id !== undefined ? Boolean(params.rfq_id) : true,
    refetchInterval: 10000,
  });
}

export function useLiveAuction(auctionId: string) {
  return useQuery({
    queryKey: ["live-auction", auctionId],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<LiveAuctionDetail>>(`/auctions/${auctionId}`);
      return res.data.data;
    },
    enabled: Boolean(auctionId),
    refetchInterval: 5000,
  });
}

export function useCreateLiveAuction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAuctionPayload) => {
      const res = await apiClient.post<APIEnvelope<LiveAuctionDetail>>("/auctions", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-auctions"] });
    },
  });
}

export function useOpenLiveAuction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (auctionId: string) => {
      const res = await apiClient.post<APIEnvelope<LiveAuctionDetail>>(`/auctions/${auctionId}/open`);
      return res.data.data;
    },
    onSuccess: (_, auctionId) => {
      queryClient.invalidateQueries({ queryKey: ["live-auctions"] });
      queryClient.invalidateQueries({ queryKey: ["live-auction", auctionId] });
    },
  });
}

export function useCancelLiveAuction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ auctionId, reason }: { auctionId: string; reason: string }) => {
      const res = await apiClient.post<APIEnvelope<LiveAuctionDetail>>(`/auctions/${auctionId}/cancel`, { reason });
      return res.data.data;
    },
    onSuccess: (_, { auctionId }) => {
      queryClient.invalidateQueries({ queryKey: ["live-auctions"] });
      queryClient.invalidateQueries({ queryKey: ["live-auction", auctionId] });
    },
  });
}

export function useReleaseLiveAuctionResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (auctionId: string) => {
      const res = await apiClient.post<APIEnvelope<LiveAuctionDetail>>(`/auctions/${auctionId}/release-results`);
      return res.data.data;
    },
    onSuccess: (_, auctionId) => {
      queryClient.invalidateQueries({ queryKey: ["live-auctions"] });
      queryClient.invalidateQueries({ queryKey: ["live-auction", auctionId] });
    },
  });
}

export function useAuctionLeaderboard(auctionId: string) {
  return useQuery({
    queryKey: ["auction-leaderboard", auctionId],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<LiveAuctionRankEntry[]>>(`/auctions/${auctionId}/leaderboard`);
      return res.data.data;
    },
    enabled: Boolean(auctionId),
    refetchInterval: 5000,
  });
}

export function useAuctionMyRank(auctionId: string) {
  return useQuery({
    queryKey: ["auction-my-rank", auctionId],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<LiveAuctionMyRank>>(`/auctions/${auctionId}/my-rank`);
      return res.data.data;
    },
    enabled: Boolean(auctionId),
    refetchInterval: 5000,
  });
}

export function useAuctionBidHistory(auctionId: string) {
  return useQuery({
    queryKey: ["auction-bids", auctionId],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<LiveAuctionBidHistoryItem[]>>(`/auctions/${auctionId}/bids`);
      return res.data.data;
    },
    enabled: Boolean(auctionId),
    refetchInterval: 5000,
  });
}

export function useSetProxyFloor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      auctionId,
      lotId,
      floorAmountInr,
    }: {
      auctionId: string;
      lotId?: string | null;
      floorAmountInr: number;
    }) => {
      const res = await apiClient.post<APIEnvelope<unknown>>(`/auctions/${auctionId}/proxy-floor`, {
        lot_id: lotId || undefined,
        floor_amount_inr: floorAmountInr,
      });
      return res.data.data;
    },
    onSuccess: (_, { auctionId }) => {
      queryClient.invalidateQueries({ queryKey: ["live-auction", auctionId] });
      queryClient.invalidateQueries({ queryKey: ["auction-my-rank", auctionId] });
    },
  });
}

