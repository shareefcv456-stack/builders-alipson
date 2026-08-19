import { Facebook, Instagram, Youtube, ArrowUpRight, Phone, Mail, MapPin } from 'lucide-react';
import Logo from './ui/Logo';
import { NAV, CONTACT } from '../data/site';
import { scrollToId } from '../hooks/useLenis';

export default function Footer() {
  return (
    <footer className="footer grain" id="footer">

      {/* Top row — Contact · Quick Links · Map */}
      <div className="container footer__top grid grid-cols-1 md:grid-cols-3 gap-8" id="location">
        <div className="footer__col footer__col--contact">
          <Logo />
          <h4>Visit &amp; Contact</h4>
          <a className="footer__contact-line" href={CONTACT.phoneHref}><Phone size={14} /> <span>{CONTACT.phone}</span></a>
          <a className="footer__contact-line" href={`mailto:${CONTACT.email}`}><Mail size={14} /> <span>{CONTACT.email}</span></a>
          <p className="footer__contact-line footer__contact-addr"><MapPin size={14} /> <span>{CONTACT.address}</span></p>
          <div className="footer__social">
            <a href="#" aria-label="Facebook"><Facebook size={17} /></a>
            <a href="#" aria-label="Instagram"><Instagram size={17} /></a>
            <a href="#" aria-label="YouTube"><Youtube size={17} /></a>
          </div>
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

        <div className="footer__col footer__col--map">
          <div className="footer__map glass">
            <a
              className="footer__map-open"
              href="https://www.google.com/maps/search/?api=1&query=Ambalappadi%2C%20Wandoor%2C%20Kerala%20679328"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Maps <ArrowUpRight size={14} />
            </a>
            <iframe
              src={CONTACT.mapEmbed}
              title="Alipson Builders location — Ambalappadi, Wandoor, Kerala 679328"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
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
