import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import Logo from './ui/Logo';
import { NAV } from '../data/site';
import { scrollToId } from '../hooks/useLenis';
import { gateOpenScroll } from './StoryScroll';
import { useUI } from '../context/UIContext';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  /* Hidden behind the closed split gate. The threshold comes from StoryScroll so
     it tracks the gate's own timing rather than restating it — the bar appears
     as the doors finish parting, not on the first pixel of scroll. */
  const [past, setPast] = useState(false);
  const [active, setActive] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const { openQuote } = useUI();
  const bar = useRef<HTMLElement>(null);

  /* PUBLISH THE BAR'S REAL HEIGHT as `--nav-h`, so the page can offset anchor
     targets by what the navbar ACTUALLY measures rather than by a number typed
     into the stylesheet. It was 100px there against a bar that is 104px tall at
     the top of the page and 92px once it condenses — so every in-page link
     landed its heading four pixels underneath the navbar with no gap at all.
     A ResizeObserver keeps it right through the condense, a rotation, a font
     swap or any future change to the bar's padding. */
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const write = () => document.documentElement.style.setProperty('--nav-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    /* Scrollspy: the active item is the LAST nav section whose top has crossed
       the probe line. The previous version required the probe to sit *inside*
       the element, so it went blank over the gaps between sections and never
       lit up the pinned hero or the footer at all. */
    const PROBE = 160;
    let raf = 0;

    const measure = () => {
      raf = 0;
      setScrolled(window.scrollY > 40);
      setPast(window.scrollY >= gateOpenScroll());

      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) { setActive(NAV[NAV.length - 1].id); return; }

      let best = NAV[0].id;
      let bestTop = -Infinity;
      for (const { id } of NAV) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= PROBE && top > bestTop) { best = id; bestTop = top; }
      }
      setActive(best);
    };

    /* Measure on the frame AFTER the scroll event, coalesced. GSAP pins this
       page, and reading rects inside the scroll handler caught the pin-spacer
       mid-update — on a programmatic jump (a nav click), which fires exactly
       one scroll event, that left the indicator stuck on the previous section. */
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // Deep links and reloads can land mid-page, where the gate is long gone.
    measure();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  /* Single-page smooth scroll — no route change, so the pinned scroll-driven
     hero is never torn down and re-mounted. The URL is deliberately left clean
     (no #hash written) so a later refresh lands on the hero, not mid-page. */
  const go = (id: string) => {
    setMenuOpen(false);
    setActive(id);          // light the target immediately, don't wait for scroll
    scrollToId(id);
  };

  return (
    <>
      <header ref={bar} className={`nav ${scrolled ? 'scrolled' : ''} ${past ? 'is-in' : ''}`} aria-hidden={!past}>
        <div className="nav__inner">
          <a href="#hero" onClick={(e) => { e.preventDefault(); go('hero'); }} data-cursor="Home">
            <Logo compact={scrolled} />
          </a>

          <nav className="nav__links">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={`nav__link ${active === n.id ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); go(n.id); }}
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="nav__right">
            <button className="btn btn-primary" onClick={openQuote}>
              Book Consultation <ArrowUpRight size={16} />
            </button>
            <button className="nav__toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="mnav"
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          >
            <button className="mnav__x" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <X size={22} />
            </button>
            <div className="mnav__links">
              {NAV.map((n, i) => (
                <motion.a
                  key={n.id}
                  href={`#${n.id}`}
                  className="mnav__link"
                  onClick={(e) => { e.preventDefault(); go(n.id); }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <em>0{i + 1}</em>{n.label}
                </motion.a>
              ))}
            </div>
            <div className="mnav__foot">
              <button className="btn btn-primary" onClick={() => { setMenuOpen(false); openQuote(); }}>
                Book Consultation
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
