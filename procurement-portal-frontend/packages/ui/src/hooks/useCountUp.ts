"use client";

import { useEffect, useState, useRef } from 'react';

export function useCountUp(
  target: number,
  duration = 1200,
  delay = 0,
  decimals = 0
): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

    const timeout = setTimeout(() => {
      const animate = (time: number) => {
        if (!startTime.current) startTime.current = time;
        const progress = Math.min((time - startTime.current) / duration, 1);
        // Apple-style cubic ease-out
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(parseFloat((eased * target).toFixed(decimals)));
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setValue(target);
        }
      };
      requestAnimationFrame(animate);
    }, delay);

    return () => clearTimeout(timeout);
  }, [target, duration, delay, decimals]);

  return value;
}
