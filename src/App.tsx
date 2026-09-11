import { Suspense, lazy, useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider } from './context/UIContext';
import { useLenis } from './hooks/useLenis';
import { isLite } from './lib/device';

import CinematicIntro from './components/CinematicIntro';
import DroneBackground from './components/DroneBackground';
import Navbar from './components/Navbar';
import FloatingActions from './components/FloatingActions';
import StoryScroll from './components/StoryScroll';
import Deferred from './components/Deferred';
import { usePath, isKnown, currentPath, toTop } from './router';

/* EAGER above, LAZY below. The split is the fold, not taste: the hero pins for
   two to three viewports, so nothing past it can be on screen at first paint.
   Each of these is mounted by <Deferred>, which waits until the section is
   within ~a viewport of the scroll position — so the chunk is fetched on
   approach instead of competing with the hero for the first second of the page.
   Modals are lazy for a different reason: they are never on screen until the
   user opens one. */
const Intro = lazy(() => import('./components/Intro'));
const AlipsonGate = lazy(() => import('./components/AlipsonGate'));
const Studio = lazy(() => import('./components/Studio'));
const Founder = lazy(() => import('./components/Founder'));
const Services = lazy(() => import('./components/Services'));
const Projects = lazy(() => import('./components/Projects'));
const Process = lazy(() => import('./components/Process'));
const Clients = lazy(() => import('./components/Clients'));
const Testimonials = lazy(() => import('./components/Testimonials'));
const Gallery = lazy(() => import('./components/Gallery'));
const Faq = lazy(() => import('./components/Faq'));
const Cta = lazy(() => import('./components/Cta'));
const Contact = lazy(() => import('./components/Contact'));
const Footer = lazy(() => import('./components/Footer'));
const Modals = lazy(() => import('./components/Modals'));

/* The five dedicated pages. Each renders the SAME component the home page
   scrolls past — one implementation, two places it can appear, so a change to
   the Projects section shows up on /projects and on / without being written
   twice. The home page is deliberately NOT in here: it is the whole scroll
   story, hero and all, and it stays exactly as it was. */
const PAGES: Record<string, ReactElement> = {
  '/story': <Studio />,
  '/projects': <Projects />,
  '/services': <Services />,
  '/founder': <Founder />,
  '/contact': <Contact />,
};

export default function App() {
  /* Which page is on screen. Unknown paths fall back to home rather than
     rendering an empty <main> — a mistyped URL lands on the site, not on
     nothing. (A real 404 page would be a design decision, not a routing fix.) */
  const rawPath = usePath();
  const path = isKnown(rawPath) ? rawPath : '/';
  const isHome = path === '/';

  /* CinematicIntro plays first on desktop: blueprint line-draw → "We don't
     build buildings." → brand mark, with a Skip intro button. It then hands off
     to the scroll-driven gate at scroll 0, so a refresh always starts the
     sequence from the beginning.

     PHONES SKIP IT. Six seconds of full-screen framer-motion over an empty
     document is the single largest thing standing between a mobile visitor and
     the page: nothing below it can paint, the body cannot scroll, and every
     one of those frames is animation work on the exact CPU that has the least
     to spare. The scroll-driven gate underneath already opens the site with the
     brand mark, so the phone loses the three copy beats, not the entrance.
     `?noloader` still forces the skip anywhere, for screenshots and QA. */
  /* A DEDICATED PAGE NEVER PLAYS THE INTRO. It is the entrance to the scroll
     story — the blueprint draw hands off to the gate at scroll 0 of the home
     hero, and neither of those exists on /services. Landing there and being
     held behind six seconds of full-screen animation before a page of plain
     sections appears is the worst version of it, so those routes start opened. */
  const [loaded, setLoaded] = useState(
    () => typeof window === 'undefined' ||
      currentPath() !== '/' || window.location.search.includes('noloader') || isLite()
  );
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  useLenis();

  /* On every load, refresh and back/forward restore: stop the browser putting
     the scroll position back and force the top, so the gate starts at frame 0.
     `pageshow` covers the bfcache case, where no effect re-runs and the browser
     would otherwise hand the page back mid-scroll. */
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    toTop();
    const onShow = () => { if (!window.location.hash) toTop(); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  /* A NEW PAGE STARTS AT ITS TOP. Routing from the foot of /projects to
     /contact otherwise opens the new page at the old page's scroll offset —
     halfway down, past its own heading. `path` is in the deps rather than a
     call inside `navigate`, so BACK and FORWARD get the same treatment as a
     click; those go through `popstate`, which never reaches `navigate`. */
  useEffect(() => { toTop(); }, [path]);

  useEffect(() => {
    document.body.style.overflow = loaded ? '' : 'hidden';
  }, [loaded]);

  /* Once the intro clears: an explicit #hash deep-links to that section, and
     the bare base URL is pinned back to the top. The second half matters —
     releasing `body { overflow }` can otherwise surface a scroll position the
     browser latched while the intro was covering the page. */
  useEffect(() => {
    if (!loaded) return;
    const id = window.location.hash.replace('#', '');
    const t = setTimeout(() => {
      if (!id) { window.scrollTo(0, 0); return; }
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 120);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    <ThemeProvider>
      <UIProvider value={{ openQuote: () => setQuoteOpen(true), openBrochure: () => setBrochureOpen(true), openVideo: () => setVideoOpen(true) }}>
        <AnimatePresence>{isHome && !loaded && <CinematicIntro onDone={() => setLoaded(true)} />}</AnimatePresence>

        <DroneBackground />
        <Navbar />
        <FloatingActions />

        {isHome ? (
          <>
            <main>
              {/* Ribbon is rendered INSIDE StoryScroll now — it has to slide up
                  over the still-pinned 3D canvas, which it cannot do from here. */}
              <StoryScroll />
              <Deferred id="intro"><Intro /></Deferred>
              <Deferred id="gateway"><AlipsonGate /></Deferred>
              <Deferred id="studio" minHeight="100dvh"><Studio /></Deferred>
              <Deferred id="founder" minHeight="100dvh"><Founder /></Deferred>
              <Deferred id="services" minHeight="100dvh"><Services /></Deferred>
              <Deferred id="work" minHeight="100dvh"><Projects /></Deferred>
              <Deferred id="process"><Process /></Deferred>
              <Deferred id="clients" minHeight="30dvh"><Clients /></Deferred>
              <Deferred id="voices"><Testimonials /></Deferred>
              <Deferred id="gallery" minHeight="100dvh"><Gallery /></Deferred>
              <Deferred id="journal"><Faq /></Deferred>
              <Deferred id="cta" minHeight="50dvh"><Cta /></Deferred>
              <Deferred id="contact" minHeight="100dvh"><Contact /></Deferred>
            </main>

            <Deferred id="footer" minHeight="80dvh"><Footer /></Deferred>
          </>
        ) : (
          <>
            {/* A DEDICATED PAGE MOUNTS ITS SECTION OUTRIGHT — no <Deferred>.
                That component exists to keep below-the-fold work off the first
                second of the home scroll; here the section IS the page and is on
                screen immediately, so deferring it would only add a placeholder
                frame between the navigation and the content. `.page` supplies
                the top gutter the fixed navbar needs, which on the home page the
                pinned hero provides instead. */}
            <main className="page">
              <Suspense fallback={<div className="deferred-slot" style={{ '--slot-h': '100dvh' } as CSSProperties} aria-hidden />}>
                {PAGES[path]}
              </Suspense>
            </main>
            <Suspense fallback={null}><Footer /></Suspense>
          </>
        )}

        {/* One boundary, one chunk: the three modals share a module, and none of
            them renders anything until its `open` prop is true. */}
        {(quoteOpen || brochureOpen || videoOpen) && (
          <Suspense fallback={null}>
            <Modals
              quoteOpen={quoteOpen} onQuoteClose={() => setQuoteOpen(false)}
              brochureOpen={brochureOpen} onBrochureClose={() => setBrochureOpen(false)}
              videoOpen={videoOpen} onVideoClose={() => setVideoOpen(false)}
            />
          </Suspense>
        )}
      </UIProvider>
    </ThemeProvider>
  );
}
