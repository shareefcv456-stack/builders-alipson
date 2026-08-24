import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import { GALLERY } from '../data/site';
import { imgProps, media } from '../lib/media';

export default function Gallery() {
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const move = useCallback(
    (dir: number) => setIndex((i) => (i === null ? i : (i + dir + GALLERY.length) % GALLERY.length)),
    []
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, close, move]);

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

      <AnimatePresence>
        {active && (
          <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
            <button className="lightbox__x" onClick={close} aria-label="Close"><X size={20} /></button>
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
            <div className="lightbox__cap">
              <span>{active.cat}</span>
              <h3>{active.title}</h3>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
