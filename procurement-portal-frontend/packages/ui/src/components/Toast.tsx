"use client";

import React, { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  type?: ToastType;
  title: string;
  message?: string;
  action?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Toast({
  type = 'info',
  title,
  message,
  action,
  onClose,
  className = '',
}: ToastProps) {
  const { isLiquidGlass } = useTheme();

  let Icon = Info;
  let iconColor = 'text-blue-500';

  if (type === 'success') {
    Icon = CheckCircle2;
    iconColor = 'text-emerald-500';
  } else if (type === 'error') {
    Icon = AlertCircle;
    iconColor = 'text-red-500';
  } else if (type === 'warning') {
    Icon = AlertTriangle;
    iconColor = 'text-amber-500';
  }

  return (
    <div
      className={`apple-toast ${isLiquidGlass ? 'glass-surface glass-surface--near' : ''} ${className}`}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1">
        <h4 className="font-semibold text-sm text-neutral-900 dark:text-white leading-snug">
          {title}
        </h4>
        {message && (
          <p className="text-xs text-neutral-500 dark:text-neutral-300 mt-1 leading-relaxed">
            {message}
          </p>
        )}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-0.5 rounded transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
