import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone, ArrowUp } from 'lucide-react';
import { CONTACT } from '../data/site';

function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.02 2C6.55 2 2.1 6.45 2.1 11.92c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.77 1.21h.01c5.46 0 9.91-4.45 9.91-9.92C21.94 6.45 17.49 2 12.02 2z" />
    </svg>
  );
}

export default function FloatingActions() {
  const [showUp, setShowUp] = useState(false);

  useEffect(() => {
    /* Coalesced into one rAF per frame, and the state is only written when the
       answer actually CHANGES. This ran `setShowUp` on every scroll event — a
       profile of a scroll had it as the highest-cost application function on the
       page, above everything in the 3D hero. React bailed out of most of the
       renders, but the handler still ran and still allocated on every event. */
    let raf = 0;
    const measure = () => {
      raf = 0;
      const next = window.scrollY > window.innerHeight;
      setShowUp((cur) => (cur === next ? cur : next));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const toTop = () => {
    const lenis = (window as unknown as { lenis?: { scrollTo: (n: number, o?: object) => void } }).lenis;
    if (lenis) lenis.scrollTo(0, { duration: 1.4 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="floaters">
      <AnimatePresence>
        {showUp && (
          <motion.button
            className="floater floater--up"
            onClick={toTop}
            aria-label="Back to top"
            data-cursor=""
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <ArrowUp size={20} />
          </motion.button>
        )}
      </AnimatePresence>
      <a className="floater floater--call" href={CONTACT.phoneHref} aria-label="Call now" data-cursor="Call">
        <Phone size={20} />
      </a>
      <a
        className="floater floater--wa"
        href={CONTACT.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        data-cursor="Chat"
      >
        <span className="floater-pulse" />
        <WhatsAppIcon size={26} />
      </a>
    </div>
  );
}
