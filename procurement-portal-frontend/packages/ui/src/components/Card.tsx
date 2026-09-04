"use client";

import React, { forwardRef, HTMLAttributes, ReactNode, useRef } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { useLiquidGlassCursor } from '../hooks/useLiquidGlassCursor';
import { useParallaxTilt } from '../hooks/useParallaxTilt';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  glass?: boolean;
  tilt?: boolean;
  className?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      title,
      subtitle,
      action,
      footer,
      glass = false,
      tilt = false,
      className = '',
      ...rest
    },
    forwardedRef
  ) => {
    const { isLiquidGlass } = useTheme();
    const internalRef = useRef<HTMLDivElement>(null);
    const refToUse = (forwardedRef as React.RefObject<HTMLDivElement>) || internalRef;

    useLiquidGlassCursor(refToUse);
    if (tilt) {
      useParallaxTilt(refToUse, 5);
    }

    const useGlassStyle = glass || isLiquidGlass;
    const cardBaseClass = useGlassStyle ? 'apple-card glass-surface' : 'apple-card';

    return (
      <div
        ref={refToUse}
        className={`${cardBaseClass} ${className}`}
        {...rest}
      >
        {(title || action) && (
          <div className="apple-card__header flex items-center justify-between pb-2">
            <div>
              {title && <h3 className="apple-card__title">{title}</h3>}
              {subtitle && <p className="apple-card__subtitle">{subtitle}</p>}
            </div>
            {action && <div>{action}</div>}
          </div>
        )}
        <div className="apple-card__body">{children}</div>
        {footer && <div className="apple-card__footer">{footer}</div>}
      </div>
    );
  }
);

Card.displayName = 'Card';
