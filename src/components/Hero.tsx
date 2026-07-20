import { useMemo, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, Home, ShieldCheck, Award } from 'lucide-react';
import Magnetic from './ui/Magnetic';
import { scrollToId } from '../hooks/useLenis';
import HeroCanvas from './HeroCanvas';

const EASE = [0.16, 1, 0.3, 1] as const;

const lineV = {
  hidden: { y: '112%' },
  show: (i: number) => ({ y: '0%', transition: { duration: 1, ease: EASE, delay: 0.3 + i * 0.12 } }),
};

const HERO_BADGES = [
  { icon: Home, text: '100+ Dream Homes Delivered' },
  { icon: ShieldCheck, text: "Kerala's Trusted Builder" },
  { icon: Award, text: '15+ Years of Craftsmanship' },
];

export default function Hero() {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const mediaY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '40%']);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 3,
        dur: 6 + Math.random() * 8,
        delay: Math.random() * 6,
        drift: -20 - Math.random() * 40,
        key: i,
      })),
    []
  );

  return (
    <section id="hero" className="hero grain" ref={ref}>
      <motion.div className="hero__media" style={{ y: mediaY, scale }}>
        <HeroCanvas />
      </motion.div>

      <div className="hero__scrim" />
      <div className="hero__rays" />
      <div className="hero__glow" />

      <div className="hero__particles">
        {particles.map((p) => (
          <motion.span
            key={p.key}
            className="hero__particle"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size }}
            animate={{ y: [0, p.drift, 0], opacity: [0, 0.8, 0] }}
            transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <motion.div className="hero__inner" style={{ y: contentY, opacity: fade }}>
        <motion.span
          className="eyebrow hero__eyebrow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          Kerala · Est. 2010 · Design–Build
        </motion.span>

        <h1 className="hero__title">
          {['Crafting Timeless Architecture &', <>Dream Spaces in <em>Kerala.</em></>].map((line, i) => (
            <span className="split-line" key={i}>
              <motion.span style={{ display: 'block' }} custom={i} variants={lineV} initial="hidden" animate="show">
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          className="hero__sub"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.9 }}
        >
          From bespoke luxury villas to commercial landmarks — Alipson Builders brings precision,
          elegance, and uncompromised quality to every structure.
        </motion.p>

        <motion.div
          className="hero__cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.9 }}
        >
          <Magnetic strength={0.3}>
            <button className="btn btn-primary" onClick={() => scrollToId('work')}>
              View Featured Projects <ArrowUpRight size={16} />
            </button>
          </Magnetic>
          <Magnetic strength={0.3}>
            <button className="btn btn-ghost" onClick={() => scrollToId('founder')}>
              Our Story <ArrowUpRight size={16} />
            </button>
          </Magnetic>
        </motion.div>

        <div className="hero__badges--mobile">
          {HERO_BADGES.slice(0, 2).map((b) => (
            <div className="hero__badge glass" key={b.text}>
              <b.icon size={15} /> <span>{b.text}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Floating interactive glass badges (hover to elevate) */}
      <motion.div
        className="hero__badges"
        style={{ opacity: fade }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.35, duration: 1 }}
      >
        {HERO_BADGES.map((b, i) => (
          <motion.div
            className="hero__badge glass"
            key={b.text}
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5 + i, delay: i * 0.6, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ y: -12, transition: { duration: 0.3 } }}
          >
            <span className="hero__badge-ic"><b.icon size={16} /></span>
            <span>{b.text}</span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="hero__scroll" style={{ opacity: fade }}>
        <div className="hero__mouse"><i /></div>
        <span>Scroll</span>
      </motion.div>
    </section>
  );
}
