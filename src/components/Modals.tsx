import { useState } from 'react';
import { CheckCircle2, ArrowUpRight, Download } from 'lucide-react';
import Modal from './ui/Modal';
import { MEDIA, HERO_VIDEO, HERO_VIDEO_WEBM } from '../lib/media';

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

export function VideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="video-modal">
        <video controls autoPlay muted loop playsInline poster={MEDIA.heroPoster}>
          <source src={HERO_VIDEO_WEBM} type="video/webm" />
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
      </div>
      <div className="video-modal__cap">
        <h3>Inside Alipson Builders</h3>
        <p>A cinematic walk-through of our landmark residences and living spaces across Kerala.</p>
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
