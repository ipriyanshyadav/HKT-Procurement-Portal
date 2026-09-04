"use client";
import React, { useState } from "react";
import { Decimal } from "decimal.js";

export interface BidEntryPanelProps {
  lotId: string | null;
  currentL1Inr: number | null;
  minDecrementType: "PERCENTAGE" | "ABSOLUTE";
  minDecrementValue: number;
  auctionClosed: boolean;
  onSubmit: (lotId: string | null, amount: number) => void;
}

export function BidEntryPanel({
  lotId,
  currentL1Inr,
  minDecrementType,
  minDecrementValue,
  auctionClosed,
  onSubmit,
}: BidEntryPanelProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const maxAllowed =
    currentL1Inr == null
      ? null
      : minDecrementType === "PERCENTAGE"
      ? new Decimal(currentL1Inr).mul(1 - minDecrementValue / 100).toNumber()
      : currentL1Inr - minDecrementValue;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (maxAllowed !== null && amount > maxAllowed) {
      setError(`Bid must be ≤ ₹${maxAllowed.toFixed(2)} (min decrement not met)`);
      return;
    }
    setError(null);
    onSubmit(lotId, amount);
    setValue("");
  };

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-xl bg-card">
      {currentL1Inr != null && (
        <p className="text-sm text-muted-foreground">
          L1 Price:{" "}
          <span className="font-semibold text-green-600">
            ₹{currentL1Inr.toLocaleString("en-IN")}
          </span>
          {maxAllowed != null &&
            ` | Your max: ₹${maxAllowed.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}`}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={auctionClosed}
          placeholder="Enter bid amount (₹)"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={auctionClosed || !value}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Submit Bid
        </button>
      </form>
      {error && <p className="text-xs text-destructive text-red-600">{error}</p>}
    </div>
  );
}
