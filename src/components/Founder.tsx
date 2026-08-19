import { Facebook, Instagram, MessageCircle } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import AmbientCanvas from './AmbientCanvas';
import { FOUNDER, CONTACT } from '../data/site';
import { media } from '../lib/media';

export default function Founder() {
  return (
    <section id="founder" className="section grain">
      <AmbientCanvas variant="dusk" className="z-10" />

      <div className="container relative z-20">
        <div className="founder__panel">
          <Reveal dir="scale" className="founder__media">
            <figure className="founder__portrait">
              <img src={media('founder')} alt={`${FOUNDER.name} — ${FOUNDER.role}`} loading="lazy" />
            </figure>
          </Reveal>

          <div className="founder__editorial">
            <Reveal><span className="founder__brand">{FOUNDER.eyebrow}</span></Reveal>
            <Reveal delay={0.05}><span className="founder__rule" aria-hidden="true" /></Reveal>

            <RevealText className="founder__name" lines={[FOUNDER.name]} />

            <Reveal dir="up" delay={0.1}>
              <p className="founder__caption">Founder &amp; Managing Director</p>
            </Reveal>

            <Reveal dir="up" delay={0.15}>
              <blockquote className="founder__quote">{FOUNDER.quote}</blockquote>
            </Reveal>

            {FOUNDER.body.map((p, i) => (
              <Reveal dir="up" delay={0.2 + i * 0.06} key={i}>
                <p className="founder__text">{p}</p>
              </Reveal>
            ))}

            <Reveal dir="up" delay={0.3}>
              {/* ponytail: signature is the display face in italic, not a scan.
                  Swap in an <img> of the real signature when there is one. */}
              <div className="founder__sign">
                <span className="founder__sign-mark">{FOUNDER.name}</span>
                <small>{FOUNDER.role}</small>
              </div>
            </Reveal>

            <Reveal dir="up" delay={0.35}>
              <div className="founder__social">
                <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={17} /></a>
                <a href="#" aria-label="Facebook"><Facebook size={17} /></a>
                <a href="#" aria-label="Instagram"><Instagram size={17} /></a>

                <ul className="founder__values">
                  {FOUNDER.values.map((v) => (
                    <li className="founder__value" key={v.v}>
                      <b>{v.k}</b>
                      <span>{v.v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
