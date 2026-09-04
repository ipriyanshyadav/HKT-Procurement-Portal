"use client";

import React, { ReactNode } from 'react';
import { useCountUp } from '../hooks/useCountUp';

export interface KPIItemProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  delay?: number;
  sublabel?: string;
}

export function KPIItem({
  value,
  label,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1200,
  delay = 0,
  sublabel,
}: KPIItemProps) {
  const animatedValue = useCountUp(value, duration, delay, decimals);
  const formatted = decimals > 0
    ? animatedValue.toFixed(decimals)
    : Math.floor(animatedValue).toLocaleString();

  return (
    <div className="kpi-item">
      <div className="kpi-value text-neutral-900 dark:text-white">
        {prefix}{formatted}{suffix}
      </div>
      <div className="kpi-label text-neutral-500 dark:text-neutral-400">{label}</div>
      {sublabel && (
        <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 font-normal">{sublabel}</div>
      )}
    </div>
  );
}

export interface HeroKPIStripProps {
  items: KPIItemProps[];
  className?: string;
  children?: ReactNode;
}

export function HeroKPIStrip({ items, className = '', children }: HeroKPIStripProps) {
  return (
    <section className={`kpi-strip ${className}`}>
      {items.map((item, idx) => (
        <KPIItem key={idx} {...item} delay={idx * 100} />
      ))}
      {children}
    </section>
  );
}
