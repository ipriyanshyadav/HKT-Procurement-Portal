"use client";

import React from "react";
import { cn } from "./utils";

export interface PaymentTermOption {
  id: string;
  code: string;
  name: string;
  net_days: number;
}

export interface PaymentTermsSelectProps {
  options?: PaymentTermOption[];
  value?: string;
  onChange: (termId: string, termCode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function PaymentTermsSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select Payment Terms...",
  disabled = false,
  isLoading = false,
  className,
}: PaymentTermsSelectProps) {
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
        {isLoading ? "Loading Payment Terms..." : placeholder}
      </option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.code} — {opt.name} (Net {opt.net_days} days)
        </option>
      ))}
    </select>
  );
}
