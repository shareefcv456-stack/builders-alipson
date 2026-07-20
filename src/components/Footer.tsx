import { useState } from 'react';
import { Facebook, Instagram, Youtube, ArrowUpRight, ArrowRight, Check } from 'lucide-react';
import Logo from './ui/Logo';
import Magnetic from './ui/Magnetic';
import RevealText from './ui/RevealText';
import { NAV, SERVICES, CONTACT } from '../data/site';
import { scrollToId } from '../hooks/useLenis';
import { useUI } from '../context/UIContext';

export default function Footer() {
  const { openQuote } = useUI();
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="footer grain">
      <div className="container footer__cta">
        <RevealText className="" as="h2" lines={[<>Let's build your</>, <><em>landmark.</em></>]} />
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
          <Magnetic strength={0.3}>
            <button className="btn btn-primary" onClick={openQuote}>
              Book a Consultation <ArrowUpRight size={16} />
            </button>
          </Magnetic>
        </div>
      </div>

      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <Logo />
            <p className="footer__desc">
              A luxury design-build studio crafting residences, villas and commercial
              landmarks across Kerala with uncompromising craftsmanship.
            </p>
            <div className="footer__social">
              <a href="#" aria-label="Facebook"><Facebook size={17} /></a>
              <a href="#" aria-label="Instagram"><Instagram size={17} /></a>
              <a href="#" aria-label="YouTube"><Youtube size={17} /></a>
            </div>
          </div>

          <div className="footer__col">
            <h4>Navigate</h4>
            <ul>
              {NAV.map((n) => (
                <li key={n.id}>
                  <a href={`#${n.id}`} onClick={(e) => { e.preventDefault(); scrollToId(n.id); }}>{n.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer__col">
            <h4>Services</h4>
            <ul>
              {SERVICES.slice(0, 5).map((s) => (
                <li key={s.num}>
                  <a href="#services" onClick={(e) => { e.preventDefault(); scrollToId('services'); }}>{s.title}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer__col">
            <h4>Newsletter</h4>
            <p className="footer__desc" style={{ margin: '0 0 0.5rem' }}>
              Occasional dispatches on new projects and design thinking.
            </p>
            <form
              className="footer__news"
              onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }}
            >
              <input type="email" placeholder="Your email" required aria-label="Email" />
              <button type="submit" aria-label="Subscribe">
                {subscribed ? <Check size={16} /> : <ArrowRight size={16} />}
              </button>
            </form>
            <p className="footer__desc" style={{ margin: '1.2rem 0 0' }}>{CONTACT.address}</p>
          </div>
        </div>
      </div>

      <span className="footer__watermark" aria-hidden>ALIPSON</span>

      <div className="container footer__bottom">
        <p>© {new Date().getFullYear()} Alipson Builders. All rights reserved.</p>
        <div style={{ display: 'flex', gap: '1.8rem' }}>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </div>
    </footer>
  );
}
