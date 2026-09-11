import { useRef, type ReactNode } from 'react';
import { m, useMotionValue, useSpring } from 'framer-motion';

/**
 * Magnetic wrapper — the child eases toward the cursor while hovered and
 * springs back on leave. Used for buttons and nav CTAs.
 */
export default function Magnetic({
  children,
  strength = 0.4,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 200, damping: 15, mass: 0.4 });

  /* THE BOX IS MEASURED ONCE PER HOVER, NOT ONCE PER MOUSE MOVE — and the
     reason is correctness before it is cost. This element is being translated
     by the two springs below, so a `getBoundingClientRect()` taken mid-move
     returns the box WHERE THE SPRING HAS ALREADY PUT IT: the magnet then
     measures its offset from a centre that is itself running away, and chases
     its own transform. Measuring on enter pins the centre to the element's
     resting position, which is what "distance from the button" is supposed to
     mean. It also takes a forced layout read out of a per-frame handler that
     writes a transform on the same element — the read-then-write cycle the
     forced-reflow audit is about. */
  const box = useRef<DOMRect | null>(null);

  const handleEnter = () => { box.current = ref.current?.getBoundingClientRect() ?? null; };
  const handleMove = (e: React.MouseEvent) => {
    const r = box.current;
    if (!r) return;
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    box.current = null;
    x.set(0);
    y.set(0);
  };

  return (
    <m.div
      ref={ref}
      className={className}
      style={{ x: sx, y: sy, display: 'inline-flex' }}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={reset}
    >
      {children}
    </m.div>
  );
}
