"use client";

import { useEffect, RefObject } from 'react';

export function useParallaxTilt(ref: RefObject<HTMLElement>, intensity = 6) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      const rotateX = -dy * intensity;
      const rotateY = dx * intensity;
      el.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    };

    const handleMouseLeave = () => {
      el.style.transition = 'transform 400ms cubic-bezier(0.25, 0.1, 0.25, 1)';
      el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
      setTimeout(() => {
        if (el) el.style.transition = '';
      }, 400);
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [ref, intensity]);
}
