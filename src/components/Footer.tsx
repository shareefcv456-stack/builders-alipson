import { Facebook, Instagram, Youtube, Phone, Mail, MapPin } from 'lucide-react';
import Logo from './ui/Logo';
import { NAV, CONTACT } from '../data/site';
import { scrollToId } from '../hooks/useLenis';

/* No map here. The Google embed lives once, in <Contact>. A second copy was a
   second ~1MB maps bundle on the heaviest part of the scroll for no new
   information — the address and an "Open in Maps" link say the same thing. */
export default function Footer() {
  return (
    <footer className="footer grain" id="footer">

      <div className="container footer__top" id="location">
        <div className="footer__col footer__col--brand">
          <Logo />
          <p className="footer__desc">
            Building landmarks across Kerala since 1998 — residential, commercial
            and turnkey interiors, delivered to the drawing.
          </p>
        </div>

        <div className="footer__col footer__col--links">
          <h4>Quick Links</h4>
          <ul>
            {NAV.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`} onClick={(e) => { e.preventDefault(); scrollToId(n.id); }}>{n.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer__col footer__col--contact">
          <h4>Visit &amp; Contact</h4>
          <a className="footer__contact-line" href={CONTACT.phoneHref}><Phone size={14} /> <span>{CONTACT.phone}</span></a>
          <a className="footer__contact-line" href={`mailto:${CONTACT.email}`}><Mail size={14} /> <span>{CONTACT.email}</span></a>
          <a
            className="footer__contact-line footer__contact-addr"
            href={CONTACT.mapLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={14} /> <span>{CONTACT.address}</span>
          </a>
          <div className="footer__social">
            <a href="#" aria-label="Facebook"><Facebook size={17} /></a>
            <a href="#" aria-label="Instagram"><Instagram size={17} /></a>
            <a href="#" aria-label="YouTube"><Youtube size={17} /></a>
          </div>
        </div>
      </div>

      {/* Bottom bar — copyright and legal links, nothing behind them. */}
      <div className="footer__bottom">
        <div className="container footer__bottom-inner">
          <p>© {new Date().getFullYear()} Alipson Builders Pvt Ltd. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '1.8rem' }}>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms &amp; Conditions</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
