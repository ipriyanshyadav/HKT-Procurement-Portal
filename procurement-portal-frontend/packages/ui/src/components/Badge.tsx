"use client";

import React, { ReactNode } from 'react';

export type BadgeVariant =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'draft'
  | 'review'
  | 'active'
  | 'completed'
  | 'in_approval'
  | 'cancelled'
  | 'submitted'
  | 'warning'
  | 'info';

export interface BadgeProps {
  variant?: BadgeVariant | string;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({
  variant = 'draft',
  children,
  className = '',
  dot = true,
}: BadgeProps) {
  const normVariant = variant.toLowerCase().replace(/[\s-]/g, '_');

  let variantClass = 'badge-draft';
  if (['approved', 'active', 'completed', 'delivered', 'paid'].includes(normVariant)) {
    variantClass = 'badge-approved';
  } else if (['pending', 'in_approval', 'under_review', 'submitted', 'warning'].includes(normVariant)) {
    variantClass = 'badge-pending';
  } else if (['rejected', 'cancelled', 'overdue', 'failed'].includes(normVariant)) {
    variantClass = 'badge-rejected';
  } else if (['review', 'rfq_issued', 'info'].includes(normVariant)) {
    variantClass = 'badge-review';
  }

  return (
    <span
      className={`apple-badge ${variantClass} ${!dot ? 'before:hidden' : ''} ${className}`}
    >
      {children}
    </span>
  );
}
