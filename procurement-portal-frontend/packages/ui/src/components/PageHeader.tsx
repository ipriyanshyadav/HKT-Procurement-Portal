"use client";

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${className}`}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1.5">
            {breadcrumbs.map((bc, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <React.Fragment key={index}>
                  {index > 0 && <ChevronRight className="w-3 h-3 text-neutral-400 flex-shrink-0" />}
                  {bc.href && !isLast ? (
                    <Link href={bc.href} className="hover:text-neutral-900 dark:hover:text-white transition-colors">
                      {bc.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'text-neutral-900 dark:text-neutral-100 font-medium' : ''}>
                      {bc.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}
