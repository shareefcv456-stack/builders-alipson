import { Quote } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import { FOUNDER } from '../data/site';
import { media } from '../lib/media';

export default function Founder() {
  return (
    <section id="founder" className="section bg-alt grain">
      <div className="container">
        <div className="founder__grid">
          <Reveal>
            <div className="founder__visual">
              <div className="founder__frame">
                <img src={media('team')} alt="The leadership team of Alipson Builders" loading="lazy" />
                <div className="founder__caption glass">
                  <b>{FOUNDER.name}</b>
                  <span>{FOUNDER.role}</span>
                </div>
              </div>
              <div className="founder__values glass">
                {FOUNDER.values.map((v) => (
                  <div className="founder__value" key={v.v}>
                    <b>{v.k}</b>
                    <span>{v.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="founder__body">
            <Reveal><span className="eyebrow">{FOUNDER.eyebrow}</span></Reveal>
            <RevealText className="title founder__title" lines={[<>{FOUNDER.title}</>, <em>{FOUNDER.titleEm}</em>]} />

            <Reveal dir="up" delay={0.1}>
              <blockquote className="founder__quote">
                <Quote size={26} className="founder__quote-mark" />
                {FOUNDER.quote}
              </blockquote>
            </Reveal>

            {FOUNDER.body.map((p, i) => (
              <Reveal dir="up" delay={0.15 + i * 0.08} key={i}>
                <p className="founder__text">{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
