import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import Logo from './ui/Logo';
import { NAV } from '../data/site';
import { gateOpenScroll } from './StoryScroll';
import { useUI } from '../context/UIContext';
import { navigate, usePath, isKnown } from '../router';
import { onScrollFrame, viewportH } from '../lib/scrollbus';
import { useScrollLock } from '../hooks/useScrollLock';

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
  /* Every nav item is a page now, so the lit item is normally just "which URL
     is this". The home page is the exception and keeps its scrollspy: it is
     still one long scroll containing all of these sections, and the indicator
     tracking your position down it is existing behaviour worth keeping. */
  const rawPath = usePath();
  const path = isKnown(rawPath) ? rawPath : '/';
  const isHome = path === '/';

  /* THE PAGE BEHIND THE DRAWER DOES NOT MOVE. This was the one full-screen
     overlay on the site not using the shared lock (the project sheet, the
     lightbox and all three modals already do), so a finger that started on the
     panel and carried past its edge scrolled the document underneath — you
     closed the menu and the page was somewhere else, which reads as the app
     having lost your place. `useScrollLock` is refcounted and restores the
     exact offset on close; on a route change the restore lands first and App's
     `toTop()` follows it, so a navigation still opens the new page at its top. */
  useScrollLock(menuOpen);

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
    /* NO LAYOUT READS ON THE SCROLL PATH. This used to take eleven
       `getBoundingClientRect()` calls every 150ms while scrolling — each one a
       forced layout on a page GSAP's pin had just dirtied. A section's position
       in the DOCUMENT does not change as you scroll; it changes when the page
       does — a <Deferred> section mounting, a resize, a ScrollTrigger refresh
       resizing the pin-spacer — and every one of those resizes <body>. So the
       offsets are measured once per body resize, and scrolling is arithmetic.
       The hero is pinned, so its measured top can be off if the page resizes
       mid-pin — harmless: it is NAV[0], which is also the fallback answer. */
    const LAST = NAV[NAV.length - 1].id;
    let spots: { id: string; top: number; bottom: number }[] = [];
    const locate = () => {
      const y = window.scrollY;
      spots = [];
      for (const { id } of NAV) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        spots.push({ id, top: r.top + y, bottom: r.bottom + y });
      }
    };

    const measure = (y: number) => {
      setScrolled(y > 40);
      /* THE SPLIT GATE ONLY EXISTS ON THE HOME HERO. Off it there is nothing to
         hide behind and nothing to wait for, so gating the bar on a scroll
         threshold there would leave /services with no navbar at all until the
         visitor scrolled — the one page where the navbar is the only way out. */
      setPast(!isHome || y >= gateOpenScroll());

      /* Off the home page the answer is the URL, not the scroll position —
         and a dedicated page contains exactly one nav section, so probing
         offsets would only ever confirm what the route already said. */
      if (!isHome) { setActive(NAV.find((n) => n.path === path)?.id ?? ''); return; }

      /* No `scrollHeight` either: "at the bottom" is when the last nav
         section's own bottom edge is on screen — nothing below it to scroll. */
      let best = NAV[0].id;
      let bestTop = -Infinity;
      let atBottom = false;
      for (const s of spots) {
        const top = s.top - y;
        if (s.id === LAST && s.bottom - y <= viewportH() + 2) atBottom = true;
        if (top <= PROBE && top > bestTop) { best = s.id; bestTop = top; }
      }
      setActive(atBottom ? LAST : best);
    };

    /* Fires once on observe (the initial measurement), then on every change
       to the page's size. Home only — elsewhere `measure` never reads spots. */
    let ro: ResizeObserver | undefined;
    if (isHome) {
      ro = new ResizeObserver(() => { locate(); measure(window.scrollY); });
      ro.observe(document.body);
    }

    /* ONE SUBSCRIPTION, SHARED WITH EVERY OTHER SCROLL CONSUMER. `scrollbus`
       reads the position once per animation frame for the whole app and hands
       the same number to each subscriber, so the navbar no longer takes its own
       `scrollY` sample (a live-layout read) on top of the floating actions'.
       Coalescing to the frame AFTER the event still matters for a different
       reason: GSAP pins this page, and reading rects inside the scroll event
       itself caught the pin-spacer mid-update. It also fires immediately on
       subscribe, which covers the deep link that lands mid-page. */
    const off = onScrollFrame(measure);
    return () => {
      off();
      ro?.disconnect();
    };
  }, [isHome, path]);

  /* THE HREF IS THE REAL ROUTE, and the click handler only takes over the
     plain-left-click case. That is what keeps middle-click, ctrl/cmd-click and
     "open in new tab" working: those are the browser's to handle, and calling
     preventDefault on them unconditionally is how a SPA quietly breaks every
     one of them. Same reason the anchors are <a href> and not <button>: hover
     shows the destination, and the link is copyable. */
  const go = (e: React.MouseEvent, to: string, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setMenuOpen(false);
    setActive(id);          // light the target immediately, don't wait for the route
    navigate(to);
  };

  return (
    <>
      <header ref={bar} className={`nav ${scrolled ? 'scrolled' : ''} ${past ? 'is-in' : ''}`} aria-hidden={!past}>
        <div className="nav__inner">
          <a href="/" onClick={(e) => go(e, '/', 'hero')} data-cursor="Home">
            <Logo compact={scrolled} />
          </a>

          <nav className="nav__links">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={n.path}
                className={`nav__link ${active === n.id ? 'active' : ''}`}
                aria-current={path === n.path ? 'page' : undefined}
                onClick={(e) => go(e, n.path, n.id)}
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
          <m.div
            className="mnav"
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          >
            {/* HEADER ROW, IN FLOW. The close button used to be absolutely
                positioned, which is why the panel carried 6rem of top padding
                to clear it — six centimetres of empty navy above the first
                link. In a flex row with the wordmark it takes its own height
                and the panel's padding drops to the safe-area inset. */}
            <div className="mnav__head">
              <Logo compact />
              <button className="mnav__x" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            <div className="mnav__links">
              {NAV.map((n, i) => (
                <m.a
                  key={n.id}
                  href={n.path}
                  className={`mnav__link ${active === n.id ? 'active' : ''}`}
                  aria-current={path === n.path ? 'page' : undefined}
                  onClick={(e) => go(e, n.path, n.id)}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <em>0{i + 1}</em>{n.label}
                </m.a>
              ))}
            </div>
            <div className="mnav__foot">
              <button className="btn btn-primary mnav__cta" onClick={() => { setMenuOpen(false); openQuote(); }}>
                Book Consultation <ArrowUpRight size={16} />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
