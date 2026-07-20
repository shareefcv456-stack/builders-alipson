import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider } from './context/UIContext';
import { useLenis } from './hooks/useLenis';

import Loader from './components/Loader';
import Cursor from './components/Cursor';
import Navbar from './components/Navbar';
import FloatingActions from './components/FloatingActions';
import Hero from './components/Hero';
import Ribbon from './components/Ribbon';
import Studio from './components/Studio';
import Founder from './components/Founder';
import Services from './components/Services';
import Projects from './components/Projects';
import WhyUs from './components/WhyUs';
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
  const [loaded, setLoaded] = useState(
    () => typeof window !== 'undefined' && window.location.search.includes('noloader')
  );
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  useLenis();

  useEffect(() => {
    document.body.style.overflow = loaded ? '' : 'hidden';
  }, [loaded]);

  // Deep-link: scroll to #section on first load once content is revealed.
  useEffect(() => {
    if (!loaded) return;
    const id = window.location.hash.replace('#', '');
    if (!id) return;
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 120);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    <ThemeProvider>
      <UIProvider value={{ openQuote: () => setQuoteOpen(true), openBrochure: () => setBrochureOpen(true), openVideo: () => setVideoOpen(true) }}>
        <AnimatePresence>{!loaded && <Loader onDone={() => setLoaded(true)} />}</AnimatePresence>

        <Cursor />
        <Navbar />
        <FloatingActions />

        <main>
          <Hero />
          <Ribbon />
          <Studio />
          <Founder />
          <Services />
          <Projects />
          <WhyUs />
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
