import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      setPast(window.scrollY >= gateOpenScroll());
      for (const { id } of NAV) {
        const el = document.getElementById(id);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.top <= 160 && r.bottom >= 160) {
            setActive(id);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Deep links and reloads can land mid-page, where the gate is long gone.
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (id: string) => {
    setMenuOpen(false);
    scrollToId(id);
  };

  return (
    <>
      <header className={`nav ${scrolled ? 'scrolled' : ''} ${past ? 'is-in' : ''}`} aria-hidden={!past}>
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
