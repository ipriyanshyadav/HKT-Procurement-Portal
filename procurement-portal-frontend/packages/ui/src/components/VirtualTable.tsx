"use client";

import React, { useRef, ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualTableColumn<T> {
  key: string;
  header: string;
  width?: string | number;
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => ReactNode;
}

export interface VirtualTableProps<T> {
  data: T[];
  columns: VirtualTableColumn<T>[];
  estimateRowHeight?: number;
  maxHeight?: number | string;
  overscan?: number;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  className?: string;
}

/**
 * Apple Virtualized Data Table
 * High-performance virtual scrolling for tables with large datasets (>50 rows).
 * Only mounts visible DOM elements to maintain 60fps rendering without DOM bloat.
 */
export function VirtualTable<T>({
  data,
  columns,
  estimateRowHeight = 52,
  maxHeight = '560px',
  overscan = 10,
  onRowClick,
  emptyMessage = 'No data available',
  isLoading = false,
  className = '',
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div
      className={`apple-table-container relative overflow-hidden flex flex-col ${className}`}
    >
      {/* Fixed Sticky Header Table */}
      <div className="w-full overflow-hidden border-b border-[var(--apple-separator)] bg-[var(--apple-bg-well)] z-10">
        <table className="apple-table w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--apple-label-secondary)] ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable container for Virtual Rows */}
      <div
        ref={parentRef}
        style={{
          maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
          overflowY: 'auto',
          width: '100%',
        }}
        className="w-full relative apple-scroll-container overscroll-contain"
      >
        <div
          style={{
            height: `${totalSize}px`,
            position: 'relative',
            width: '100%',
          }}
        >
          {isLoading ? (
            <div className="text-center py-16 text-[var(--apple-label-secondary)]">
              <div className="inline-block w-6 h-6 border-2 border-[var(--apple-blue)] border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs">Loading items...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-16 text-sm text-[var(--apple-label-secondary)]">
              {emptyMessage}
            </div>
          ) : (
            virtualItems.map((virtualRow) => {
              const item = data[virtualRow.index];
              if (!item) return null;

              return (
                <div
                  key={virtualRow.index}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  onClick={() => onRowClick && onRowClick(item)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    cursor: onRowClick ? 'pointer' : 'default',
                  }}
                  className="border-b border-[var(--apple-separator)] transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <table className="apple-table w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                    <tbody>
                      <tr>
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            style={col.width ? { width: col.width } : undefined}
                            className={`px-4 py-3 text-sm text-[var(--apple-label-primary)] ${col.className || ''}`}
                          >
                            {col.render
                              ? col.render(item, virtualRow.index)
                              : ((item as Record<string, unknown>)[col.key] as ReactNode) ?? '—'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Row counter footer */}
      {data.length > 0 && (
        <div className="px-4 py-2 border-t border-[var(--apple-separator)] bg-[var(--apple-fill-quaternary)] flex items-center justify-between text-xs text-[var(--apple-label-secondary)]">
          <span>Total records: {data.length.toLocaleString()}</span>
          <span>Virtual window: {virtualItems.length} active DOM rows</span>
        </div>
      )}
    </div>
  );
}
