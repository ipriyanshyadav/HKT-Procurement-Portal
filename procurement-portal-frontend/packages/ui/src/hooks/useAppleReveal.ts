"use client";

import { useEffect, RefObject } from 'react';

export function useAppleReveal(ref: RefObject<HTMLElement>, delay = 0) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transition = `opacity 600ms cubic-bezier(0.25, 0.1, 0.25, 1) ${delay}ms,
                                 transform 600ms cubic-bezier(0.25, 0.1, 0.25, 1) ${delay}ms`;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );

    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    observer.observe(el);

    return () => observer.disconnect();
  }, [ref, delay]);
}
