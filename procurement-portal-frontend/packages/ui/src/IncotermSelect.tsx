"use client";

import React from "react";
import { cn } from "./utils";

export interface IncotermOption {
  id: string;
  code: string;
  name: string;
  edition_year?: number;
  risk_transfer_point?: string;
}

export interface IncotermSelectProps {
  options?: IncotermOption[];
  value?: string;
  onChange: (incotermId: string, incotermCode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function IncotermSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select Incoterm (e.g. DDP, FOB, CIF)...",
  disabled = false,
  isLoading = false,
  className,
}: IncotermSelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedOpt = options.find((opt) => opt.id === selectedId || opt.code === selectedId);
    onChange(selectedId, selectedOpt ? selectedOpt.code : selectedId);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled || isLoading}
      className={cn(
        "w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
        (disabled || isLoading) && "bg-gray-100 dark:bg-neutral-900 cursor-not-allowed opacity-60",
        className,
      )}
    >
      <option value="" disabled>
        {isLoading ? "Loading Incoterms..." : placeholder}
      </option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.code} — {opt.name}
        </option>
      ))}
    </select>
  );
}
