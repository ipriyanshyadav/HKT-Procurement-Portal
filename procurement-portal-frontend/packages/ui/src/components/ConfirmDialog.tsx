"use client";

import React, { useState, useCallback, createContext, useContext, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { AlertTriangle, Trash2, Info } from "lucide-react";
import { cn } from "../utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ConfirmDialogVariant = "danger" | "warning" | "info" | "primary";

export interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    variant: "danger",
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        resolve,
        confirmLabel: "Confirm",
        cancelLabel: "Cancel",
        variant: "danger",
        ...options,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state]);

  const variantConfig: Record<ConfirmDialogVariant, { icon: React.ReactNode; iconBg: string; confirmClass: string }> = {
    danger: {
      icon: <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />,
      iconBg: "bg-red-50 dark:bg-red-950/40 ring-1 ring-red-200 dark:ring-red-800/50",
      confirmClass: "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
    },
    warning: {
      icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      iconBg: "bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-800/50",
      confirmClass: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white",
    },
    info: {
      icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      iconBg: "bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-200 dark:ring-blue-800/50",
      confirmClass: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white",
    },
    primary: {
      icon: <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      iconBg: "bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-200 dark:ring-indigo-800/50",
      confirmClass: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white",
    },
  };

  const cfg = variantConfig[state.variant ?? "danger"];

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent showClose={false} className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className={cn("flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full", cfg.iconBg)}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                  {state.title}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                  {state.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogFooter className="mt-2 flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="min-w-[80px]"
            >
              {state.cancelLabel}
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              className={cn("min-w-[80px] shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2", cfg.confirmClass)}
            >
              {state.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export type ConfirmFunction = (options: ConfirmDialogOptions) => Promise<boolean>;

export interface UseConfirmReturn extends ConfirmFunction {
  confirm: ConfirmFunction;
}

export function useConfirm(): UseConfirmReturn {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmDialogProvider");
  }
  const fn = ctx.confirm as any;
  fn.confirm = ctx.confirm;
  return fn as UseConfirmReturn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone component for one-off use
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmDialogProps extends ConfirmDialogOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const variantConfig: Record<ConfirmDialogVariant, { icon: React.ReactNode; iconBg: string; confirmClass: string }> = {
    danger: {
      icon: <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />,
      iconBg: "bg-red-50 dark:bg-red-950/40 ring-1 ring-red-200 dark:ring-red-800/50",
      confirmClass: "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
    },
    warning: {
      icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      iconBg: "bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-800/50",
      confirmClass: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white",
    },
    info: {
      icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      iconBg: "bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-200 dark:ring-blue-800/50",
      confirmClass: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white",
    },
    primary: {
      icon: <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      iconBg: "bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-200 dark:ring-indigo-800/50",
      confirmClass: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white",
    },
  };

  const cfg = variantConfig[variant];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent showClose={false} className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn("flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full", cfg.iconBg)}>
              {cfg.icon}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-2 flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="min-w-[80px]"
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn("min-w-[80px] shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2", cfg.confirmClass)}
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                {confirmLabel}
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
