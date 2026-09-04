import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, CheckCircle2, ArrowUpRight } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import { CONTACT } from '../data/site';

type Errors = Partial<Record<'name' | 'email' | 'phone' | 'message', string>>;

const validate = (v: Record<string, string>): Errors => {
  const e: Errors = {};
  if (!v.name || v.name.trim().length < 2) e.name = 'Please enter your name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email || '')) e.email = 'Enter a valid email';
  if (!/^[+\d][\d\s-]{7,}$/.test(v.phone || '')) e.phone = 'Enter a valid phone number';
  if (!v.message || v.message.trim().length < 10) e.message = 'Tell us a little more (10+ chars)';
  return e;
};

export default function Contact() {
  const [values, setValues] = useState<Record<string, string>>({ name: '', email: '', phone: '', message: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = { ...values, [k]: e.target.value };
    setValues(next);
    if (touched[k]) setErrors(validate(next));
  };
  const blur = (k: string) => () => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors(validate(values));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    setTouched({ name: true, email: true, phone: true, message: true });
    if (Object.keys(errs).length) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 1100);
  };

  const field = (k: 'name' | 'email' | 'phone' | 'message', label: string, type = 'text') => (
    <div className={`field ${errors[k] && touched[k] ? 'field--error' : ''}`}>
      {k === 'message' ? (
        <textarea id={`c-${k}`} placeholder=" " value={values[k]} onChange={set(k)} onBlur={blur(k)} />
      ) : (
        <input id={`c-${k}`} type={type} placeholder=" " value={values[k]} onChange={set(k)} onBlur={blur(k)} />
      )}
      <label htmlFor={`c-${k}`}>{label}</label>
      {errors[k] && touched[k] && <div className="field-msg">{errors[k]}</div>}
    </div>
  );

  return (
    <section id="contact" className="section grain">
      <div className="container contact__grid">
        <div className="contact__info">
          <Reveal><span className="eyebrow">Contact</span></Reveal>
          <RevealText className="title" lines={[<>Let's start</>, <>the <em>conversation.</em></>]} />
          <Reveal delay={0.1}>
            <div className="contact__list">
              <a className="contact__item" href={CONTACT.phoneHref}>
                <div className="contact__ic"><Phone size={20} /></div>
                <div><h4>Call the studio</h4><p>{CONTACT.phone}</p></div>
              </a>
              <a className="contact__item" href={`mailto:${CONTACT.email}`}>
                <div className="contact__ic"><Mail size={20} /></div>
                <div><h4>Email us</h4><p>{CONTACT.email}</p></div>
              </a>
              <div className="contact__item">
                <div className="contact__ic"><MapPin size={20} /></div>
                <div><h4>Visit</h4><p>{CONTACT.address}</p></div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            {/* The map renders directly — no click-to-load gate. It is still
                the ONLY map on the page and it still carries `loading="lazy"`,
                so the iframe is not fetched until it is near the viewport. */}
            <div className="contact__map">
              <iframe
                src={CONTACT.mapEmbed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Alipson Builders — ${CONTACT.address}`}
                allowFullScreen
              />
            </div>
          </Reveal>
        </div>

        <Reveal dir="left" delay={0.1}>
          <div className="contact__form glass">
            {sent ? (
              <div style={{ padding: '2rem 0', textAlign: 'center' }}>
                <div className="success-note" style={{ justifyContent: 'center' }}>
                  <CheckCircle2 size={22} />
                  <span>Thank you — your enquiry is in. Our team will reach out within 24 hours.</span>
                </div>
              </div>
            ) : (
              <>
                <h3>Request a free quote</h3>
                <p>Share your vision and our consultants respond within one business day.</p>
                <form onSubmit={submit} noValidate>
                  {field('name', 'Full name')}
                  {field('email', 'Email address', 'email')}
                  {field('phone', 'Phone number', 'tel')}
                  {field('message', 'Tell us about your project')}
                  <motion.button
                    type="submit"
                    className="btn btn-primary form-submit"
                    disabled={sending}
                    whileTap={{ scale: 0.98 }}
                  >
                    {sending ? 'Sending…' : <>Send enquiry <ArrowUpRight size={16} /></>}
                  </motion.button>
                </form>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
