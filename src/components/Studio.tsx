import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, Download } from 'lucide-react';
import Reveal from './ui/Reveal';
import RevealText from './ui/RevealText';
import Magnetic from './ui/Magnetic';
import AmbientCanvas from './AmbientCanvas';
import { HIGHLIGHTS } from '../data/site';
import { MEDIA } from '../lib/media';
import { useUI } from '../context/UIContext';

export default function Studio() {
  const visualRef = useRef<HTMLDivElement>(null);
  const { openQuote, openBrochure } = useUI();
  const { scrollYProgress } = useScroll({ target: visualRef, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);

  return (
    <section id="studio" className="section bg-alt grain">
      <AmbientCanvas variant="blueprint" />
      <div className="container studio__grid">
        <div className="studio__visual" ref={visualRef}>
          <Reveal dir="scale">
            <div className="studio__frame" style={{ overflow: 'hidden' }}>
              <motion.img
                src={MEDIA.team}
                alt="The Alipson Builders studio team reviewing architectural plans on site"
                style={{ y: imgY, scale: 1.12 }}
                loading="lazy"
              />
            </div>
          </Reveal>
          <Reveal dir="up" delay={0.2}>
            <div className="studio__badge glass">
              <b>15+</b>
              <span>Years of<br />Excellence</span>
            </div>
          </Reveal>
        </div>

        <div className="studio__details">
          <Reveal><span className="eyebrow">The Studio</span></Reveal>
          <RevealText
            className="title"
            lines={[<>Architecture with</>, <>a sense of <em>permanence.</em></>]}
          />
          <Reveal delay={0.1}>
            <p className="studio__quote">
              "We believe architecture has the power to inspire, shape cultures and{' '}
              <span>build lasting legacies.</span>"
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="studio__body">
              For over fifteen years, Alipson Builders has turned bold visions into
              enduring landmarks. We are architects, structural engineers and luxury
              homebuilders devoted to premium craftsmanship, absolute transparency and
              design that stands the test of time.
            </p>
          </Reveal>

          <div className="studio__highlights">
            {HIGHLIGHTS.map((h, i) => (
              <Reveal key={h.title} delay={0.1 + i * 0.08}>
                <div className="studio__hl">
                  <div className="studio__hl-icon"><h.icon size={20} /></div>
                  <div>
                    <h4>{h.title}</h4>
                    <p>{h.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15}>
            <div className="btn-group">
              <Magnetic strength={0.25}>
                <button className="btn btn-primary" onClick={openQuote}>
                  Start a Project <ArrowUpRight size={16} />
                </button>
              </Magnetic>
              <button className="btn btn-ghost" onClick={openBrochure}>
                <Download size={15} /> Brochure
              </button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
