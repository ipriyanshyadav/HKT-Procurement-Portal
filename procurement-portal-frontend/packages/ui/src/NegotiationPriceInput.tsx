"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "./components/Badge";

export interface NegotiationPriceInputProps {
  originalPrice: number;
  value: number | string;
  onChange: (value: number, isValid: boolean) => void;
  maxTolerancePct?: number; // default 0.5%
  disabled?: boolean;
  label?: string;
  currencySymbol?: string;
  className?: string;
}

export function NegotiationPriceInput({
  originalPrice,
  value,
  onChange,
  maxTolerancePct = 0.5,
  disabled = false,
  label = "Negotiated Price",
  currencySymbol = "₹",
  className = "",
}: NegotiationPriceInputProps) {
  const [inputValue, setInputValue] = useState<string>(
    value !== undefined && value !== null ? String(value) : ""
  );

  useEffect(() => {
    setInputValue(value !== undefined && value !== null ? String(value) : "");
  }, [value]);

  const numVal = parseFloat(inputValue) || 0;
  const priceDiff = numVal - originalPrice;
  const pctChange = originalPrice > 0 ? (priceDiff / originalPrice) * 100 : 0;
  const isIncrease = pctChange > 0;
  const isWithinTolerance = pctChange <= maxTolerancePct;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setInputValue(valStr);
    const parsed = parseFloat(valStr) || 0;
    const change = originalPrice > 0 ? ((parsed - originalPrice) / originalPrice) * 100 : 0;
    const valid = parsed > 0 && change <= maxTolerancePct;
    onChange(parsed, valid);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        <div className="text-xs text-muted-foreground">
          Original:{" "}
          <span className="font-mono font-medium text-foreground">
            {currencySymbol}
            {originalPrice.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground font-mono">
          {currencySymbol}
        </div>
        <input
          type="number"
          step="0.01"
          min="0"
          disabled={disabled}
          value={inputValue}
          onChange={handleInputChange}
          placeholder="0.00"
          className={`w-full pl-8 pr-4 py-2.5 rounded-xl border bg-background text-sm font-mono transition-all duration-150 focus:outline-none focus:ring-2 ${
            !inputValue || numVal <= 0
              ? "border-border focus:ring-primary/20"
              : !isWithinTolerance
              ? "border-red-500 focus:ring-red-500/20 text-red-600 dark:text-red-400"
              : isIncrease
              ? "border-amber-500 focus:ring-amber-500/20 text-amber-600 dark:text-amber-400"
              : "border-emerald-500 focus:ring-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          }`}
        />
      </div>

      {/* Tolerance / Change Indicator */}
      {inputValue && numVal > 0 && (
        <div className="flex items-center justify-between text-xs mt-1">
          <div className="flex items-center gap-1.5">
            {!isWithinTolerance ? (
              <Badge variant="destructive" className="text-[11px] font-medium">
                +{pctChange.toFixed(2)}% Exceeds {maxTolerancePct}% Tolerance
              </Badge>
            ) : isIncrease ? (
              <Badge variant="warning" className="text-[11px] font-medium">
                +{pctChange.toFixed(2)}% Within Tolerance ({maxTolerancePct}%)
              </Badge>
            ) : (
              <Badge variant="success" className="text-[11px] font-medium">
                {pctChange.toFixed(2)}% Savings (Reduced)
              </Badge>
            )}
          </div>

          <span
            className={`font-mono font-medium ${
              priceDiff < 0
                ? "text-emerald-600 dark:text-emerald-400"
                : priceDiff > 0
                ? !isWithinTolerance
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            }`}
          >
            {priceDiff > 0 ? "+" : ""}
            {currencySymbol}
            {priceDiff.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      )}
    </div>
  );
}
