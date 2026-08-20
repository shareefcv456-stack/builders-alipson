import { Suspense, lazy, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider } from './context/UIContext';
import { useLenis } from './hooks/useLenis';

import CinematicIntro from './components/CinematicIntro';
import DroneBackground from './components/DroneBackground';
import Navbar from './components/Navbar';
import FloatingActions from './components/FloatingActions';
import StoryScroll from './components/StoryScroll';
import Deferred from './components/Deferred';

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

export default function App() {
  /* CinematicIntro plays first on EVERY load and reload: blueprint line-draw →
     "We don't build buildings." → brand mark, with a Skip intro button. It then
     hands off to the scroll-driven gate at scroll 0, so a refresh always starts
     the sequence from the beginning. `?noloader` is the only escape hatch — the
     old mobile bypass is gone, so phones get the intro too. */
  const [loaded, setLoaded] = useState(
    () => typeof window !== 'undefined' && window.location.search.includes('noloader')
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
    const toTop = () => window.scrollTo(0, 0);
    toTop();
    const onShow = () => { if (!window.location.hash) toTop(); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

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
        <AnimatePresence>{!loaded && <CinematicIntro onDone={() => setLoaded(true)} />}</AnimatePresence>

        <DroneBackground />
        <Navbar />
        <FloatingActions />

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
