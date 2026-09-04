"use client";

import React from "react";
import { cn } from "./utils";

export interface UOMOption {
  id: string;
  code: string;
  name: string;
}

export interface UOMSelectProps {
  options?: UOMOption[];
  value?: string;
  onChange: (uomId: string, uomCode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function UOMSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select Unit of Measure...",
  disabled = false,
  isLoading = false,
  className,
}: UOMSelectProps) {
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
        {isLoading ? "Loading UOMs..." : placeholder}
      </option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.code} — {opt.name}
        </option>
      ))}
    </select>
  );
}
