"use client";

import React, { useRef, ReactNode, HTMLAttributes } from 'react';
import { useLiquidGlassCursor } from '../hooks/useLiquidGlassCursor';
import { useParallaxTilt } from '../hooks/useParallaxTilt';
import { triggerGlassRipple } from './refraction';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tilt?: boolean;
  rippleOnClick?: boolean;
  depth?: 'near' | 'mid' | 'far';
  tint?: 'admin' | 'supplier' | 'buyer' | 'default';
  className?: string;
}

export function GlassCard({
  children,
  tilt = false,
  rippleOnClick = false,
  depth = 'mid',
  tint = 'default',
  className = '',
  onClick,
  ...rest
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  useLiquidGlassCursor(cardRef);
  if (tilt) {
    useParallaxTilt(cardRef, 5);
  }

  const depthClass = depth === 'near'
    ? 'glass-surface--near'
    : depth === 'far'
    ? 'glass-surface--far'
    : 'glass-surface--mid';

  const tintClass = tint === 'admin'
    ? 'glass-surface--admin'
    : tint === 'supplier'
    ? 'glass-surface--supplier'
    : tint === 'buyer'
    ? 'glass-surface--buyer'
    : '';

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (rippleOnClick && cardRef.current) {
      triggerGlassRipple(cardRef.current);
    }
    onClick?.(e);
  };

  return (
    <div
      ref={cardRef}
      className={`glass-surface glass-hover-pull rounded-2xl p-6 transition-all duration-300 ${depthClass} ${tintClass} ${className}`}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </div>
  );
}
