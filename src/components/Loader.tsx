import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Cinematic page loader — a count from 00 → 100 with a filling rule, then the
 * whole panel lifts away. Calls onDone when finished.
 */
export default function Loader({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const skip =
      typeof window !== 'undefined' && window.location.search.includes('noloader');
    const total = skip ? 1 : reduce ? 300 : 1500;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / total, 1);
      setCount(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      className="loader"
      initial={{ y: 0 }}
      animate={count >= 100 ? { y: '-100%' } : {}}
      transition={{ duration: 1, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
      onAnimationComplete={() => count >= 100 && onDone()}
    >
      <motion.div
        className="loader-brand"
        initial={{ opacity: 0, letterSpacing: '0.8em' }}
        animate={{ opacity: 1, letterSpacing: '0.5em' }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        ALIPSON
      </motion.div>
      <div className="loader-bar">
        <motion.span style={{ width: `${count}%` }} />
      </div>
      <div className="loader-count">{String(count).padStart(3, '0')}</div>
    </motion.div>
  );
}
