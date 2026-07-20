import type { ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import { isCapture } from '../../lib/capture';

const EASE = [0.16, 1, 0.3, 1] as const;

type Dir = 'up' | 'down' | 'left' | 'right' | 'scale' | 'none';

const offset: Record<Dir, { x?: number; y?: number; scale?: number }> = {
  up: { y: 44 },
  down: { y: -44 },
  left: { x: 44 },
  right: { x: -44 },
  scale: { scale: 0.92 },
  none: {},
};

/** Fade + directional reveal that fires once when scrolled into view. */
export default function Reveal({
  children,
  dir = 'up',
  delay = 0,
  duration = 0.9,
  className,
  amount = 0.25,
}: {
  children: ReactNode;
  dir?: Dir;
  delay?: number;
  duration?: number;
  className?: string;
  amount?: number;
}) {
  const variants: Variants = {
    hidden: { opacity: 0, ...offset[dir] },
    show: { opacity: 1, x: 0, y: 0, scale: 1, transition: { duration, delay, ease: EASE } },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial={isCapture() ? 'show' : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger container — use with <Reveal> children or motion items. */
export function Stagger({
  children,
  className,
  gap = 0.09,
  amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  amount?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={isCapture() ? 'show' : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 34 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};
