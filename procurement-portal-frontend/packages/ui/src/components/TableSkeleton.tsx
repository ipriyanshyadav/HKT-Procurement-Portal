"use client";

import React from 'react';
import { Skeleton } from './Skeleton';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
  className = '',
}: TableSkeletonProps) {
  return (
    <div className={`apple-table-container ${className}`}>
      <table className="apple-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton height={14} width={i === 0 ? 80 : i % 2 === 0 ? 100 : 130} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx}>
                  <Skeleton
                    height={14}
                    width={colIdx === 0 ? 70 : colIdx % 3 === 0 ? '60%' : colIdx % 2 === 0 ? '80%' : '45%'}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
