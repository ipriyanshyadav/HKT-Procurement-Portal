"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRequestExport, useAppToast } from "@procurement/hooks";
import { Download, ChevronDown, FileSpreadsheet, FileText, ExternalLink, Loader2 } from "lucide-react";

export interface ExportButtonProps {
  exportType: string;
  filters?: Record<string, unknown>;
  defaultFormat?: "CSV" | "EXCEL";
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "outline" | "ghost";
  className?: string;
}

export function ExportButton({
  exportType,
  filters = {},
  defaultFormat = "CSV",
  label = "Export",
  size = "sm",
  variant = "outline",
  className = "",
}: ExportButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const requestExport = useRequestExport();
  const { toast } = useAppToast();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleExport = async (format: "CSV" | "EXCEL") => {
    setMenuOpen(false);
    try {
      await requestExport.mutateAsync({
        export_type: exportType,
        filters,
        format,
      });
      toast.success(
        "Export Queued",
        `Your ${exportType.toLowerCase().replace(/_/g, " ")} export (${format}) is processing. Download it anytime from the Export Center.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to queue export job.";
      toast.error("Export Failed", msg);
    }
  };

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs font-medium gap-1.5",
    md: "px-3 py-2 text-sm font-medium gap-2",
    lg: "px-4 py-2.5 text-base font-semibold gap-2.5",
  }[size];

  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-sm",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-800 border-transparent",
    outline: "border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-700 shadow-sm",
    ghost: "hover:bg-gray-100 text-gray-700",
  }[variant];

  return (
    <div className={`relative inline-flex rounded-lg shadow-sm ${className}`} ref={menuRef}>
      <button
        type="button"
        disabled={requestExport.isPending}
        onClick={() => handleExport(defaultFormat)}
        className={`inline-flex items-center justify-center rounded-l-lg border transition-colors ${sizeClasses} ${variantClasses} ${
          requestExport.isPending ? "opacity-60 cursor-not-allowed" : ""
        }`}
        title={`Quick Export as ${defaultFormat}`}
      >
        {requestExport.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
        ) : (
          <Download className="w-3.5 h-3.5 text-current" />
        )}
        <span>{requestExport.isPending ? "Queueing..." : label}</span>
      </button>

      <button
        type="button"
        aria-label="Export format options"
        disabled={requestExport.isPending}
        onClick={() => setMenuOpen((prev) => !prev)}
        className={`inline-flex items-center justify-center rounded-r-lg border-y border-r transition-colors px-1.5 ${variantClasses} ${
          requestExport.isPending ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        <ChevronDown className={`w-3.5 h-3.5 text-current transition-transform ${menuOpen ? "rotate-180" : ""}`} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg bg-white border border-gray-200 shadow-lg py-1.5 z-50 animate-in fade-in-50 zoom-in-95">
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Export Format
          </div>

          <button
            type="button"
            onClick={() => handleExport("CSV")}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <div>
              <div className="font-medium text-gray-900">Export as CSV (.csv)</div>
              <div className="text-[11px] text-gray-500">Fast, lightweight tabular data</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleExport("EXCEL")}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <div>
              <div className="font-medium text-gray-900">Export as Excel (.xlsx)</div>
              <div className="text-[11px] text-gray-500">Formatted spreadsheet tables</div>
            </div>
          </button>

          <div className="my-1 border-t border-gray-100" />

          <a
            href="/export-center"
            className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 flex items-center justify-between transition-colors"
          >
            <span>Go to Export Center</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
