"use client";

import React, { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      children,
      loading = false,
      disabled,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    let variantClass = 'btn-primary';
    if (variant === 'secondary') variantClass = 'btn-secondary';
    else if (variant === 'ghost') variantClass = 'btn-ghost';
    else if (variant === 'destructive') variantClass = 'btn-destructive';
    else if (variant === 'icon') variantClass = 'btn-icon';

    let sizeClass = '';
    if (variant !== 'icon') {
      if (size === 'sm') sizeClass = '!py-1.5 !px-3.5 !text-xs';
      else if (size === 'lg') sizeClass = '!py-3 !px-6 !text-base';
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${variantClass} ${sizeClass} ${className}`}
        {...rest}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
        ) : (
          icon && <span className="inline-flex items-center">{icon}</span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
