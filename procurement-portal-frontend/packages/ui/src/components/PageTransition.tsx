"use client";

import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Apple-style Page Transition
 * Smoothly cross-fades and translates page contents on route navigation
 * using Apple standard cubic-bezier curve (0.25, 0.1, 0.25, 1) in 300ms.
 */
export function PageTransition({ children, className = 'w-full' }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{
          duration: 0.3,
          ease: [0.25, 0.1, 0.25, 1],
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
