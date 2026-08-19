import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider } from './context/UIContext';
import { useLenis } from './hooks/useLenis';

import CinematicIntro from './components/CinematicIntro';
import DroneBackground from './components/DroneBackground';
import Navbar from './components/Navbar';
import FloatingActions from './components/FloatingActions';
import StoryScroll from './components/StoryScroll';
import Intro from './components/Intro';
import AlipsonGate from './components/AlipsonGate';
import Studio from './components/Studio';
import Founder from './components/Founder';
import Services from './components/Services';
import Projects from './components/Projects';
import Process from './components/Process';
import Clients from './components/Clients';
import Testimonials from './components/Testimonials';
import Gallery from './components/Gallery';
import Faq from './components/Faq';
import Cta from './components/Cta';
import Contact from './components/Contact';
import Footer from './components/Footer';
import { QuoteModal, BrochureModal, VideoModal } from './components/Modals';

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
          <Intro />
          <AlipsonGate />
          <Studio />
          <Founder />
          <Services />
          <Projects />
          <Process />
          <Clients />
          <Testimonials />
          <Gallery />
          <Faq />
          <Cta />
          <Contact />
        </main>

        <Footer />

        <QuoteModal open={quoteOpen} onClose={() => setQuoteOpen(false)} />
        <BrochureModal open={brochureOpen} onClose={() => setBrochureOpen(false)} />
        <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />
      </UIProvider>
    </ThemeProvider>
  );
}
