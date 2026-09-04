"use client";

import React, { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  render?: (item: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  className = '',
}: TableProps<T>) {
  return (
    <div className={`apple-table-container ${className}`}>
      <table className="apple-table">
        <thead>
          <tr>
            {columns.map((col) => {
              let alignClass = 'text-left';
              if (col.align === 'center') alignClass = 'text-center';
              else if (col.align === 'right') alignClass = 'text-right';

              return (
                <th key={col.key} className={alignClass} style={{ width: col.width }}>
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-12 text-neutral-400 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={keyExtractor(item, index)}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? 'cursor-pointer' : ''}
              >
                {columns.map((col) => {
                  let alignClass = 'text-left';
                  if (col.align === 'center') alignClass = 'text-center';
                  else if (col.align === 'right') alignClass = 'text-right';

                  return (
                    <td key={col.key} className={alignClass}>
                      {col.render ? col.render(item, index) : (item as Record<string, unknown>)[col.key] as ReactNode}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
