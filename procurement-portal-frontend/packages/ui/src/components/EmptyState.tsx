"use client";

import React, { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      {icon && (
        <div className="mb-4 flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
