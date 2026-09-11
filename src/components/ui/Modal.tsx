import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'framer-motion';
import { X } from 'lucide-react';
import { useScrollLock, useFocusTrap } from '../../hooks/useScrollLock';

export default function Modal({
  open,
  onClose,
  children,
  wide = false,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /* Lets a caller restyle the panel — the project sheet uses it to dock to the
     bottom edge on a phone. Everything else about the modal (scrim, Escape,
     body scroll-lock, enter/exit) is the same, which is the whole reason this
     is a prop rather than a second component. */
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);

  /* Both shared with the gallery lightbox — see hooks/useScrollLock. The lock
     is refcounted, so the quote modal opening on top of this sheet (the CTA at
     the bottom does exactly that) no longer unlocks the page when the sheet
     underneath closes. */
  useScrollLock(open);
  useFocusTrap(panel, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* PORTALLED TO <body> for the same reason the gallery lightbox is: `.section`
     sets `isolation: isolate`, so a modal rendered from inside one has its
     `z-index: 1000` judged against that section's siblings only — and the fixed
     navbar (z-800) and floating action column (z-940) live in the root context,
     where they painted straight over the panel and ate the clicks on whatever
     sat underneath them, the close button included. From the document root the
     scrim outranks both, wherever a caller happens to mount this. */
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          className="modal-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <m.div
            ref={panel}
            /* The panel scrolls itself when the content is taller than 85vh,
               and Lenis has to be told to keep its hands off it: while stopped
               it cancels every wheel and touchmove EXCEPT inside a
               `data-lenis-prevent` subtree (lenis.mjs checks the composed path
               before it preventDefaults). Without this the lock that stops the
               page would also freeze the sheet. */
            data-lenis-prevent
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            className={`modal ${wide ? 'modal--wide' : ''} ${className}`}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <button className="modal-x" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
