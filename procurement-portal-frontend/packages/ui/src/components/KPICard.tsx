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

export interface KPICardProps {
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendGood?: boolean;
  sparklineData?: number[];
  sparklineColor?: string;
  icon?: ReactNode;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export function KPICard({
  title,
  value,
  prefix = '',
  suffix = '',
  change,
  changeLabel,
  trend,
  trendGood = true,
  sparklineData,
  sparklineColor = '#3b82f6',
  icon,
  subtitle,
  className = '',
  onClick,
}: KPICardProps) {
  // Determine trend direction if not explicitly given
  const derivedTrend = trend ?? (change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : undefined);
  const isPositive = derivedTrend === 'up';
  const isNegative = derivedTrend === 'down';

  // Color mapping: is good trend or bad?
  let trendColor = 'text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800';
  if (derivedTrend === 'up') {
    trendColor = trendGood
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
      : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40';
  } else if (derivedTrend === 'down') {
    trendColor = trendGood
      ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
      : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40';
  }

  // SVG Sparkline calculation
  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null;
    const width = 84;
    const height = 30;
    const padding = 3;
    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;

    const points = sparklineData
      .map((val, idx) => {
        const x = (idx / (sparklineData.length - 1)) * (width - padding * 2) + padding;
        const y = height - padding - ((val - min) / range) * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const fillPoints = `${padding},${height} ${points} ${width - padding},${height}`;

    const stroke = sparklineColor || (derivedTrend === 'up' ? (trendGood ? '#10b981' : '#f43f5e') : (trendGood ? '#f43f5e' : '#10b981'));

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`kpi-grad-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill={`url(#kpi-grad-${title.replace(/\s+/g, '-')})`} />
        <polyline
          points={points}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {title}
        </span>
        {icon && (
          <span className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {prefix}
            {typeof value === 'number' ? value.toLocaleString() : value}
            {suffix}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{subtitle}</p>
          )}
        </div>

        {sparklineData && sparklineData.length >= 2 && (
          <div className="flex-shrink-0 self-end pb-1">{renderSparkline()}</div>
        )}
      </div>

      {(change !== undefined || changeLabel) && (
        <div className="mt-3.5 flex items-center gap-1.5 text-xs">
          {derivedTrend && (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium ${trendColor}`}>
              {isPositive && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
              {isNegative && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {!isPositive && !isNegative && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />
                </svg>
              )}
              {change !== undefined && `${change > 0 ? '+' : ''}${change}%`}
            </span>
          )}
          {changeLabel && (
            <span className="text-neutral-500 dark:text-neutral-400 truncate">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
