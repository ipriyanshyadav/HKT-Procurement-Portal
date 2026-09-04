"use client";

import React from "react";
import { cn } from "./utils";

export interface CurrencyOption {
  id: string;
  code: string;
  name: string;
  symbol?: string;
  exchange_rate_to_base?: string | number;
}

export interface CurrencySelectProps {
  options?: CurrencyOption[];
  value?: string;
  onChange: (currencyId: string, currencyCode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  showRate?: boolean;
  className?: string;
}

export function CurrencySelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select Currency...",
  disabled = false,
  isLoading = false,
  showRate = false,
  className,
}: CurrencySelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedOpt = options.find((opt) => opt.id === selectedId);
    onChange(selectedId, selectedOpt ? selectedOpt.code : "");
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled || isLoading}
      className={cn(
        "w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
        (disabled || isLoading) && "bg-gray-100 cursor-not-allowed opacity-60",
        className,
      )}
    >
      <option value="" disabled>
        {isLoading ? "Loading Currencies..." : placeholder}
      </option>
      {options.map((opt) => {
        const symbolLabel = opt.symbol ? ` (${opt.symbol})` : "";
        const rateLabel = showRate && opt.exchange_rate_to_base ? ` — Rate: ${opt.exchange_rate_to_base}` : "";
        return (
          <option key={opt.id} value={opt.id}>
            {opt.code}
            {symbolLabel} — {opt.name}
            {rateLabel}
          </option>
        );
      })}
    </select>
  );
}
