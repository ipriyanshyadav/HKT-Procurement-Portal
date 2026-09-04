"use client";

import { useEffect, RefObject } from 'react';

export function useLiquidGlassCursor(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ticking = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
          const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

          el.style.setProperty('--specular-x', `${x.toFixed(1)}%`);
          el.style.setProperty('--specular-y', `${y.toFixed(1)}%`);
          ticking = false;
        });
        ticking = true;
      }
    };

    el.addEventListener('mousemove', handleMouseMove);
    return () => el.removeEventListener('mousemove', handleMouseMove);
  }, [ref]);
}
