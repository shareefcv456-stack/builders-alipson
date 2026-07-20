import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, Sun, Moon, ArrowUpRight } from 'lucide-react';
import Logo from './ui/Logo';
import Magnetic from './ui/Magnetic';
import { NAV } from '../data/site';
import { scrollToId } from '../hooks/useLenis';
import { useTheme } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { openQuote } = useUI();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
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
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (id: string) => {
    setMenuOpen(false);
    scrollToId(id);
  };

  return (
    <>
      <header className={`nav ${scrolled ? 'scrolled' : ''}`}>
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
            <button className="theme-btn" onClick={toggle} aria-label="Toggle theme" data-cursor="">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'grid' }}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </motion.span>
              </AnimatePresence>
            </button>
            <Magnetic strength={0.35}>
              <button className="btn btn-primary btn-glow" onClick={openQuote}>
                Book Consultation <ArrowUpRight size={16} />
              </button>
            </Magnetic>
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
