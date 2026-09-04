"use client";
import { useEffect, useState, useRef } from "react";

export interface AuctionCountdownTimerProps {
  closeAt: string;
  onExpired?: () => void;
}

export function AuctionCountdownTimer({
  closeAt,
  onExpired,
}: AuctionCountdownTimerProps) {
  const [remaining, setRemaining] = useState(0);
  const expiredCalledRef = useRef(false);

  useEffect(() => {
    expiredCalledRef.current = false;
    const tick = () => {
      const diff = Math.max(0, new Date(closeAt).getTime() - Date.now());
      setRemaining(diff);
      if (diff === 0 && !expiredCalledRef.current) {
        expiredCalledRef.current = true;
        onExpired?.();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [closeAt, onExpired]);

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  const isUrgent = remaining < 60_000 && remaining > 0;

  return (
    <div
      className={`font-mono text-2xl font-bold tabular-nums ${
        isUrgent ? "text-red-600 animate-pulse" : "text-foreground"
      }`}
    >
      {hours > 0 && `${String(hours).padStart(2, "0")}:`}
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  );
}
