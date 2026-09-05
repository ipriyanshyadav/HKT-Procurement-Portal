"use client";

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

export interface SpendItem {
  id?: string;
  name: string;
  spend: number;
  count?: number;
  percentage?: number;
  [key: string]: any;
}

export type BreakdownType = 'category' | 'bu' | 'vendor';

export interface SpendChartProps {
  title?: string;
  description?: string;
  data: SpendItem[];
  currency?: string;
  activeBreakdown?: BreakdownType;
  onBreakdownChange?: (breakdown: BreakdownType) => void;
  showBreakdownSelector?: boolean;
  onBarClick?: (item: SpendItem) => void;
  height?: number;
  barColor?: string;
  emptyMessage?: string;
  className?: string;
}

const BAR_COLORS = [
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
  '#f43f5e', // rose-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#64748b', // slate-500
];

export function SpendChart({
  title = "Spend Breakdown",
  description,
  data = [],
  currency = "$",
  activeBreakdown = 'category',
  onBreakdownChange,
  showBreakdownSelector = true,
  onBarClick,
  height = 340,
  barColor = '#3b82f6',
  emptyMessage = "No spend data available for the selected period",
  className = "",
}: SpendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Format currency
  const formatCurrency = (val: number) => {
    if (val >= 1_000_000_000) {
      return `${currency}${(val / 1_000_000_000).toFixed(1)}B`;
    }
    if (val >= 1_000_000) {
      return `${currency}${(val / 1_000_000).toFixed(1)}M`;
    }
    if (val >= 1_000) {
      return `${currency}${(val / 1_000).toFixed(1)}k`;
    }
    return `${currency}${val.toLocaleString()}`;
  };

  const formattedData = (data || []).map((d) => ({
    ...d,
    spend: Number(d.spend) || 0,
    name: d.name || 'Unknown',
  }));

  const totalSpend = formattedData.reduce((acc, curr) => acc + curr.spend, 0);

  return (
    <div
      className={`rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 shadow-sm ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {description}
            </p>
          )}
          <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            Total:{' '}
            <span className="font-semibold text-neutral-900 dark:text-white">
              {formatCurrency(totalSpend)}
            </span>
          </div>
        </div>

        {showBreakdownSelector && onBreakdownChange && (
          <div className="inline-flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => onBreakdownChange('category')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeBreakdown === 'category'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Category
            </button>
            <button
              type="button"
              onClick={() => onBreakdownChange('bu')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeBreakdown === 'bu'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Business Unit
            </button>
            <button
              type="button"
              onClick={() => onBreakdownChange('vendor')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeBreakdown === 'vendor'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Vendor
            </button>
          </div>
        )}
      </div>

      {formattedData.length === 0 ? (
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center"
        >
          <p className="text-sm text-neutral-400 dark:text-neutral-500">{emptyMessage}</p>
        </div>
      ) : (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={formattedData}
              margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload.length > 0 && onBarClick) {
                  onBarClick(e.activePayload[0].payload as SpendItem);
                }
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
                className="dark:stroke-neutral-800"
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={({ x, y, payload }) => {
                  const label = payload.value.length > 14
                    ? `${payload.value.substring(0, 12)}...`
                    : payload.value;
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text
                        x={0}
                        y={0}
                        dy={14}
                        textAnchor="middle"
                        fill="#737373"
                        fontSize={11}
                      >
                        {label}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                tick={{ fill: '#737373', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as SpendItem;
                    const pct = totalSpend > 0 ? ((item.spend / totalSpend) * 100).toFixed(1) : 0;
                    return (
                      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 p-3 shadow-lg backdrop-blur-sm text-xs">
                        <p className="font-semibold text-neutral-900 dark:text-white">
                          {item.name}
                        </p>
                        <p className="mt-1 text-neutral-600 dark:text-neutral-300">
                          Spend:{' '}
                          <span className="font-bold text-neutral-900 dark:text-white">
                            {currency}
                            {item.spend.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </p>
                        <p className="text-neutral-500 dark:text-neutral-400">
                          Share: {pct}%
                        </p>
                        {item.count !== undefined && (
                          <p className="text-neutral-500 dark:text-neutral-400">
                            Orders: {item.count}
                          </p>
                        )}
                        {onBarClick && (
                          <p className="mt-1 text-[10px] text-blue-500 font-medium">
                            Click to drill down
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="spend"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
                onMouseEnter={(_, index) => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {formattedData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAR_COLORS[index % BAR_COLORS.length]}
                    opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.6}
                    cursor={onBarClick ? 'pointer' : 'default'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
