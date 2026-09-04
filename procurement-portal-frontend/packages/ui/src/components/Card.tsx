"use client";

import React, { forwardRef, HTMLAttributes, ReactNode, useRef } from 'react';
import { useParallaxTilt } from '../hooks/useParallaxTilt';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
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
      tilt = false,
      className = '',
      ...rest
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const refToUse = (forwardedRef as React.RefObject<HTMLDivElement>) || internalRef;

    if (tilt) {
      useParallaxTilt(refToUse, 5);
    }

    return (
      <div
        ref={refToUse}
        className={`apple-card ${className}`}
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
