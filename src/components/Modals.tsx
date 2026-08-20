import { useState } from 'react';
import { CheckCircle2, ArrowUpRight, Download } from 'lucide-react';
import Modal from './ui/Modal';

function SimpleForm({
  fields,
  cta,
  onDone,
}: {
  fields: { k: string; label: string; type?: string }[];
  cta: React.ReactNode;
  onDone: () => void;
}) {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div className="success-note">
        <CheckCircle2 size={22} />
        <span>Received! Our team will be in touch shortly.</span>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
        setTimeout(onDone, 2200);
      }}
    >
      {fields.map((f) => (
        <div className="field" key={f.k}>
          <input id={`m-${f.k}`} type={f.type || 'text'} placeholder=" " required />
          <label htmlFor={`m-${f.k}`}>{f.label}</label>
        </div>
      ))}
      <button type="submit" className="btn btn-primary form-submit">{cta}</button>
    </form>
  );
}

export function QuoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose}>
      <h3>Book a consultation</h3>
      <p>Share your details and our consultants will reach out with a free estimate.</p>
      <SimpleForm
        onDone={onClose}
        cta={<>Request consultation <ArrowUpRight size={16} /></>}
        fields={[
          { k: 'name', label: 'Full name' },
          { k: 'phone', label: 'Phone number', type: 'tel' },
          { k: 'email', label: 'Email address', type: 'email' },
        ]}
      />
    </Modal>
  );
}

/* Theater-style lightbox — plays the brand story film from YouTube.
   The iframe mounts only while `open` so it never plays in the background. */
const STORY_ID = 'LJ0zferSLP8';

export function VideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="video-modal">
        {open && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${STORY_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title="Together, We Build The Extraordinary — Alipson Builders"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        )}
      </div>
      <div className="video-modal__cap">
        <h3>Together, We Build The Extraordinary</h3>
        <p>The story of Alipson Builders — engineering, craftsmanship and the people who make it real.</p>
      </div>
    </Modal>
  );
}

export function BrochureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose}>
      <h3>Download brochure</h3>
      <p>Enter your details to receive our 2026 portfolio and pricing catalogue.</p>
      <SimpleForm
        onDone={onClose}
        cta={<>Get the brochure <Download size={15} /></>}
        fields={[
          { k: 'name', label: 'Full name' },
          { k: 'email', label: 'Email address', type: 'email' },
        ]}
      />
    </Modal>
  );
}

/* Default export so App can pull all three behind ONE dynamic import. They
   share this module already, so splitting them into three chunks would only add
   round trips — and any one of them opening means the others are a click away. */
export default function Modals({
  quoteOpen, onQuoteClose,
  brochureOpen, onBrochureClose,
  videoOpen, onVideoClose,
}: {
  quoteOpen: boolean; onQuoteClose: () => void;
  brochureOpen: boolean; onBrochureClose: () => void;
  videoOpen: boolean; onVideoClose: () => void;
}) {
  return (
    <>
      <QuoteModal open={quoteOpen} onClose={onQuoteClose} />
      <BrochureModal open={brochureOpen} onClose={onBrochureClose} />
      <VideoModal open={videoOpen} onClose={onVideoClose} />
    </>
  );
}
