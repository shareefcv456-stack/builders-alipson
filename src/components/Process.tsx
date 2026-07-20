import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import { PROCESS } from '../data/site';

/**
 * Vertical timeline. Each step fades up as it scrolls into view, and a gold
 * rail fills to track progress — everything stays on screen and readable.
 */
export default function Process() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 60%'] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="process" className="section bg-alt grain">
      <div className="container">
        <div className="section-head section-head--center">
          <Reveal><span className="eyebrow eyebrow--center">The Process</span></Reveal>
          <RevealText className="title" lines={[<>Five acts, <em>one</em> landmark.</>]} />
          <Reveal dir="up" delay={0.1}>
            <p className="lede" style={{ marginInline: 'auto', marginTop: '1.3rem' }}>
              A cinematic, transparent journey from the first site visit to the day we
              hand you the keys.
            </p>
          </Reveal>
        </div>

        <div className="ptimeline" ref={ref}>
          <div className="ptimeline__rail">
            <motion.div className="ptimeline__fill" style={{ scaleY: fill }} />
          </div>

          {PROCESS.map((s) => (
            <Reveal className="ptl" key={s.num} dir="up" delay={0} amount={0.5}>
              <div className="ptl__node"><b>{s.num}</b></div>
              <article className="ptl__body">
                <h3 className="ptl__title">{s.title}</h3>
                <p className="ptl__desc">{s.desc}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
