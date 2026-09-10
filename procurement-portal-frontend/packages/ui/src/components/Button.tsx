"use client";

import React, { forwardRef, ButtonHTMLAttributes, ReactNode, useRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'danger' | 'outline' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      leftIcon,
      rightIcon,
      children,
      loading = false,
      disabled,
      className = '',
      type = 'button',
      onClick,
      ...rest
    },
    ref
  ) => {
    const isClickingRef = useRef(false);

    let variantClass = 'btn-primary';
    if (variant === 'secondary' || variant === 'outline') variantClass = 'btn-secondary';
    else if (variant === 'ghost') variantClass = 'btn-ghost';
    else if (variant === 'destructive' || variant === 'danger') variantClass = 'btn-destructive';
    else if (variant === 'icon') variantClass = 'btn-icon';

    let sizeClass = 'btn-md';
    if (size === 'sm') sizeClass = 'btn-sm';
    else if (size === 'lg') sizeClass = 'btn-lg';

    const effectiveLeftIcon = leftIcon || icon;
    const isActionDisabled = Boolean(disabled || loading);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isActionDisabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Suppress rapid double-clicks (400ms throttle guard)
      if (isClickingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      isClickingRef.current = true;
      setTimeout(() => {
        isClickingRef.current = false;
      }, 400);

      if (onClick) {
        onClick(e);
      }
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isActionDisabled}
        aria-busy={loading ? "true" : undefined}
        aria-disabled={isActionDisabled ? "true" : undefined}
        onClick={handleClick}
        className={`${variantClass} ${sizeClass} ${className}`}
        {...rest}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
        ) : (
          effectiveLeftIcon && <span className="inline-flex items-center mr-1.5">{effectiveLeftIcon}</span>
        )}
        {children}
        {rightIcon && <span className="inline-flex items-center ml-1.5">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
