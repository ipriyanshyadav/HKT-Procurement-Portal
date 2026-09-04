"use client";

import React, { useEffect, useRef } from 'react';
import { useTheme } from '../theme/ThemeProvider';

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  opacity: number;
}

export function LiquidGlassBackground() {
  const { isLiquidGlass } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isLiquidGlass) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Dynamic Orbs that the glass refracts
    const orbs: Orb[] = [
      { x: 300, y: 200, vx: 0.3, vy: 0.2, radius: 280, color: '#6040FF', opacity: 0.45 },
      { x: 900, y: 400, vx: -0.2, vy: 0.3, radius: 240, color: '#00C8FF', opacity: 0.35 },
      { x: 600, y: 600, vx: 0.15, vy: -0.25, radius: 200, color: '#FF4080', opacity: 0.3 },
      { x: 1200, y: 150, vx: -0.3, vy: 0.15, radius: 180, color: '#40FF90', opacity: 0.25 },
      { x: 200, y: 700, vx: 0.25, vy: -0.2, radius: 220, color: '#FF8040', opacity: 0.3 },
    ];

    const draw = () => {
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      orbs.forEach((orb) => {
        if (orb.x + orb.radius > canvas.width || orb.x - orb.radius < 0) orb.vx *= -1;
        if (orb.y + orb.radius > canvas.height || orb.y - orb.radius < 0) orb.vy *= -1;
        orb.x += orb.vx;
        orb.y += orb.vy;

        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        grad.addColorStop(0, orb.color + 'CC');
        grad.addColorStop(0.5, orb.color + '40');
        grad.addColorStop(1, 'transparent');

        ctx.globalAlpha = orb.opacity;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [isLiquidGlass]);

  if (!isLiquidGlass) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        width: '100vw',
        height: '100vh',
      }}
      aria-hidden="true"
    />
  );
}
