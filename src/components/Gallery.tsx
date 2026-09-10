import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import { GALLERY } from '../data/site';
import { imgProps, media } from '../lib/media';
import { useScrollLock, useFocusTrap } from '../hooks/useScrollLock';

export default function Gallery() {
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const move = useCallback(
    (dir: number) => setIndex((i) => (i === null ? i : (i + dir + GALLERY.length) % GALLERY.length)),
    []
  );

  /* The SAME lock the project sheet uses — see hooks/useScrollLock. The old
     `body { overflow: hidden }` here never held: Lenis drives this page's
     scroll off wheel/touch handlers on the window, so the background carried on
     gliding behind an open frame. The hook stops Lenis as well, and is
     refcounted so two overlays cannot unlock each other. */
  const box = useRef<HTMLDivElement>(null);
  useScrollLock(index !== null);
  useFocusTrap(box, index !== null);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, close, move]);

  /* TOUCH: SWIPE TO CHANGE FRAME. The arrows are a pointer affordance and the
     keyboard has its own handler; a phone had neither, so the only way through
     the gallery was to close each image and open the next. Threshold is 45px
     with the horizontal travel required to beat the vertical, so a scroll
     gesture that starts on the image never registers as a swipe. */
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    swipe.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s0 = swipe.current;
    if (!s0) return;
    swipe.current = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - s0.x, dy = t.clientY - s0.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
  };

  const active = index !== null ? GALLERY[index] : null;

  return (
    <section id="gallery" className="section bg-alt grain">
      <div className="container">
        <div className="section-head">
          <Reveal><span className="eyebrow">Gallery</span></Reveal>
          <RevealText className="title" lines={[<>Frames from</>, <>our <em>portfolio.</em></>]} />
        </div>
        <div className="gallery__grid">
          {GALLERY.map((g, i) => (
            <Reveal key={i} dir="scale" delay={(i % 3) * 0.08}>
              <figure className="gitem cursor-target" onClick={() => setIndex(i)} data-cursor="Open">
                <img {...imgProps(g.image, '(max-width: 800px) 100vw, 380px')} alt={g.title} />
                <figcaption className="gitem__over">
                  <span>{g.cat}</span>
                  <h3>{g.title}</h3>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>

      {/* THE OVERLAY IS PORTALLED TO <body>, AND THAT IS THE WHOLE BUG FIX.
          `.section` carries `isolation: isolate`, so everything rendered inside
          this one — the lightbox included — is stacked in the SECTION's own
          context, where `z-index: 1100` is only ever compared against its
          siblings here. The navbar is a full-width fixed strip at z-800 in the
          ROOT context with `pointer-events: auto` once it fades in, so it
          painted over the top edge of the lightbox and swallowed every click on
          the close button — which sits at `top: 1.6rem`, squarely inside that
          strip. The arrows (top: 50%) and the backdrop were never under it,
          which is exactly why they kept working and only the X "randomly" died:
          it worked until the navbar faded in. Same for the floating Up / Call /
          WhatsApp column at z-940 over the bottom-right corner.
          A portal moves the DOM node to the document root, where 1100 outranks
          both. React events still bubble through the component tree, so the
          handlers below are untouched. */}
      {createPortal(
      <AnimatePresence>
        {active && (
          <motion.div
            ref={box}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={active.title}
            className="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Every control stops the click it handles, so nothing reaches
                the backdrop's own close — the two were the same action by luck
                before, and any future backdrop behaviour would have made these
                buttons do two things at once. */}
            <button className="lightbox__x" onClick={(e) => { e.stopPropagation(); close(); }} aria-label="Close"><X size={20} /></button>
            <button className="lightbox__nav lightbox__nav--prev" onClick={(e) => { e.stopPropagation(); move(-1); }} aria-label="Previous"><ChevronLeft size={22} /></button>
            <motion.img
              key={index}
              src={media(active.image)}
              alt={active.title}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
            <button className="lightbox__nav lightbox__nav--next" onClick={(e) => { e.stopPropagation(); move(1); }} aria-label="Next"><ChevronRight size={22} /></button>
            {/* The caption is CONTENT, not backdrop: tapping the title or the
                category used to bubble up and shut the frame. */}
            <div className="lightbox__cap" onClick={(e) => e.stopPropagation()}>
              <span>{active.cat}</span>
              <h3>{active.title}</h3>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body)}
    </section>
  );
}
