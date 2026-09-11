import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Phone, ArrowUp } from 'lucide-react';
import { CONTACT } from '../data/site';
import { onScrollFrame, viewportH } from '../lib/scrollbus';

/** Set to false to pin the buttons on screen at all times, as they were. */
const YIELD_TO_SCROLL = true;

function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.02 2C6.55 2 2.1 6.45 2.1 11.92c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.77 1.21h.01c5.46 0 9.91-4.45 9.91-9.92C21.94 6.45 17.49 2 12.02 2z" />
    </svg>
  );
}

export default function FloatingActions() {
  const [showUp, setShowUp] = useState(false);
  /* THEY STEP OUT OF THE WAY WHILE YOU ARE READING DOWN THE PAGE.
   *
   * This cluster is `position: fixed` in the bottom-right corner, and at 390px
   * there is no gutter for it to live in — so it sits ON the text. Measured
   * with Range rects and `elementFromPoint`, the buttons were physically
   * covering up to 80% of a line across the capabilities, gateway, studio and
   * founder sections, headings included. No amount of padding fixes that: any
   * opaque fixed element in that corner covers whatever scrolls under it.
   *
   * So they yield to the gesture instead. Scrolling DOWN is reading, and they
   * slide out; scrolling UP is looking for something to do, and they come
   * straight back. Both directions are one compositor-only transform, and the
   * buttons are never more than a short flick away.
   *
   * They stay put for the first 60% of a viewport so the cluster is visible on
   * arrival rather than appearing out of nowhere, and the 6px threshold keeps
   * sub-pixel scroll jitter from flickering them.
   *
   * ONE CONSTANT TURNS IT OFF. If always-on WhatsApp matters more than the
   * covered text — a fair call to make on a lead-generating site — set
   * YIELD_TO_SCROLL to false and they behave exactly as they did before. */
  const [away, setAway] = useState(false);

  /* NO LISTENER OF ITS OWN. This used to run a second `scroll` subscription
     with a second rAF coalescer alongside the navbar's, both computing the
     same `window.scrollY` on the same frame, and it read `window.innerHeight`
     per sample — a live-layout read taken while GSAP's pin has the page dirty.
     `onScrollFrame` hands over a position that has already been read once for
     the whole page, and the viewport comes from the resize-backed cache, so
     this handler now does one comparison and nothing else. The state is still
     only written when the answer CHANGES, so a scroll past the fold is a
     single render, not one per frame. */
  useEffect(() => onScrollFrame((y) => {
    const next = y > viewportH();
    setShowUp((cur) => (cur === next ? cur : next));
  }), []);

  useEffect(() => {
    if (!YIELD_TO_SCROLL) return;
    let last = window.scrollY;
    /* Same single subscription as everything else — one `scrollY` read per
       frame for the whole app, and no layout reads in here at all: the
       viewport comes from the resize-backed cache, so this handler is two
       comparisons and nothing the browser has to measure. */
    return onScrollFrame((y) => {
      const dy = y - last;
      if (Math.abs(dy) < 6) return;
      last = y;
      const next = dy > 0 && y > viewportH() * 0.6;
      setAway((cur) => (cur === next ? cur : next));
    });
  }, []);

  const toTop = () => {
    const lenis = (window as unknown as { lenis?: { scrollTo: (n: number, o?: object) => void } }).lenis;
    if (lenis) lenis.scrollTo(0, { duration: 1.4 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`floaters${away ? ' is-away' : ''}`}>
      <AnimatePresence>
        {showUp && (
          <m.button
            className="floater floater--up"
            onClick={toTop}
            aria-label="Back to top"
            data-cursor=""
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <ArrowUp size={20} />
          </m.button>
        )}
      </AnimatePresence>
      <a className="floater floater--call" href={CONTACT.phoneHref} aria-label="Call now" data-cursor="Call">
        <Phone size={20} />
      </a>
      <a
        className="floater floater--wa"
        href={CONTACT.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        data-cursor="Chat"
      >
        <span className="floater-pulse" />
        <WhatsAppIcon size={26} />
      </a>
    </div>
  );
}
