import { useEffect, useRef, useState } from 'react';

/**
 * Custom cursor: a fast dot + a lagging ring. The ring grows and shows a label
 * over elements marked with [data-cursor] or common interactive tags.
 */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine) return;

    document.body.classList.add('has-cursor');
    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ringPos = { ...pos };
    let raf = 0;

    const move = (e: MouseEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (dot.current) dot.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

      const el = (e.target as HTMLElement)?.closest(
        'a, button, [data-cursor], input, textarea, .cursor-target'
      ) as HTMLElement | null;
      const r = ring.current;
      if (!r) return;
      if (el) {
        r.classList.add('is-hover');
        setLabel(el.getAttribute('data-cursor') || '');
      } else {
        r.classList.remove('is-hover');
        setLabel('');
      }
    };

    const loop = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.16;
      ringPos.y += (pos.y - ringPos.y) * 0.16;
      if (ring.current)
        ring.current.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener('mousemove', move);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', move);
      document.body.classList.remove('has-cursor');
    };
  }, []);

  return (
    <>
      <div ref={dot} className="cursor-dot" />
      <div ref={ring} className="cursor-ring">
        <span className="cursor-label">{label}</span>
      </div>
    </>
  );
}
