"use client";

import React from 'react';

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'md',
}: SkeletonProps) {
  let roundedClass = 'rounded-lg';
  if (rounded === 'sm') roundedClass = 'rounded-md';
  else if (rounded === 'lg') roundedClass = 'rounded-xl';
  else if (rounded === 'xl') roundedClass = 'rounded-2xl';
  else if (rounded === 'full') roundedClass = 'rounded-full';

  return (
    <div
      style={{ width, height }}
      className={`animate-pulse bg-neutral-200/70 dark:bg-neutral-800/70 ${roundedClass} ${className}`}
      aria-hidden="true"
    />
  );
}
