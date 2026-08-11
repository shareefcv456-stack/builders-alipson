import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { gsap } from 'gsap';
import { ArrowUpRight, Play } from 'lucide-react';
import { scrollToId } from '../hooks/useLenis';
import { useUI } from '../context/UIContext';
import { isCapture } from '../lib/capture';
import { HERO_SCENES, HERO_VIDEO, HERO_VIDEO_WEBM, media } from '../lib/media';

const EASE = [0.16, 1, 0.3, 1] as const;

/* One scene holds the screen this long before cross-dissolving to the next. */
const SCENE_MS = 4200;

/* Slide-up + fade for the sub-line, CTAs and trust row (appear after the film starts). */
const riseV = {
  hidden: { opacity: 0, y: 26 },
  show: (d: number) => ({ opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE, delay: d } }),
};

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { openVideo } = useUI();
  const reduce = useReducedMotion();
  const still = isCapture() || !!reduce;

  const [active, setActive] = useState(0);
  const [videoReady, setVideoReady] = useState(false); // true once a real hero film can play
  const [inView, setInView] = useState(true);

  /* Scroll continuity — the hero settles and hands off to the next chapter below. */
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '32%']);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  /* Advance the montage on a slow timer — paused when the hero is off-screen. */
  useEffect(() => {
    if (still || videoReady || !inView) return;
    const t = setInterval(() => setActive((i) => (i + 1) % HERO_SCENES.length), SCENE_MS);
    return () => clearInterval(t);
  }, [still, videoReady, inView]);

  /* GSAP cinematic title reveal — headline lines mask up, then the rest fades in. */
  useEffect(() => {
    if (still) return;
    const ctx = gsap.context(() => {
      gsap.from('.hero__title .hl', {
        yPercent: 116, duration: 1.15, ease: 'power4.out', stagger: 0.14, delay: 0.85,
      });
    }, ref);
    return () => ctx.revert();
  }, [still]);

  /* Only one video ever plays; pause it (and the montage) when scrolled away. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        const v = videoRef.current;
        if (v && videoReady) {
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [videoReady]);

  const scene = HERO_SCENES[active];

  return (
    <section id="hero" className="hero grain" ref={ref}>
      {/* ---- CINEMATIC BACKGROUND ------------------------------------------ */}
      <div className="hero__media">
        {/* Image montage — the construction documentary, chapter by chapter. */}
        <div className="hero__cine" aria-hidden>
          {HERO_SCENES.map((s, i) => (
            <div
              key={i}
              className={`hero__frame ${i === active ? 'is-active' : ''} ${i % 2 ? 'hero__frame--alt' : ''}`}
              style={{ 
                backgroundImage: `url(${media(s.image)})`,
                /* Explicit aspect ratio to prevent CLS when image loads */
                aspectRatio: '16 / 9',
              }}
              data-priority={i === 0 ? 'high' : 'low'}
            />
          ))}
        </div>

        {/* Optional real film: drops in over the montage the moment it can play. */}
        {!still && (
          <video
            ref={videoRef}
            className="hero__video"
            data-ready={videoReady}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster={media('team')}
            onCanPlay={() => setVideoReady(true)}
            onError={() => setVideoReady(false)}
          >
            <source src={HERO_VIDEO_WEBM} type="video/webm" />
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        )}
      </div>

      <div className="hero__scrim" />
      <div className="hero__vignette" />
      <div className="hero__glow" />

      {/* ---- CHAPTER CAPTION (non-interactive scene marker) ---------------- */}
      {!videoReady && (
        <div className="hero__chapter" aria-hidden>
          <span className="hero__chapter-idx">{scene.idx}<i>/08</i></span>
          <div className="hero__chapter-body" key={active}>
            <span className="hero__chapter-title">{scene.title}</span>
            <span className="hero__chapter-cap">{scene.caption}</span>
          </div>
        </div>
      )}

      {/* ---- FOREGROUND CONTENT ------------------------------------------- */}
      <motion.div className="hero__inner" style={{ y: contentY, opacity: fade }}>
        <motion.span
          className="eyebrow hero__eyebrow"
          variants={riseV}
          custom={0.4}
          initial={still ? 'show' : 'hidden'}
          animate="show"
        >
          Alipson Builders × Nunny Recruitment
        </motion.span>

        <h1 className="hero__title">
          <span className="split-line"><span className="hl">TOGETHER, WE BUILD</span></span>
          <span className="split-line"><span className="hl">THE <em>EXTRAORDINARY</em></span></span>
        </h1>

        <motion.p
          className="hero__sub"
          variants={riseV}
          custom={1.5}
          initial={still ? 'show' : 'hidden'}
          animate="show"
        >
          <span>Dream It.</span>
          <span>Build It.</span>
          <span>Own It.</span>
        </motion.p>

        <motion.div
          className="hero__cta"
          variants={riseV}
          custom={1.75}
          initial={still ? 'show' : 'hidden'}
          animate="show"
        >
          <button className="btn btn-primary" onClick={() => scrollToId('work')}>
            Explore Projects <ArrowUpRight size={16} />
          </button>
          <button className="btn btn-watch" onClick={openVideo} aria-label="Watch our story">
            <span className="btn-watch__play"><Play size={13} fill="currentColor" /></span>
            Watch Story
          </button>
        </motion.div>

        <motion.div
          className="hero__trust"
          variants={riseV}
          custom={2}
          initial={still ? 'show' : 'hidden'}
          animate="show"
        >
          <span>Dream It. Build It. Own It. · Construction &amp; Workforce, engineered together.</span>
        </motion.div>
      </motion.div>

      {/* ---- SCENE PROGRESS (passive film scrubber, not a slideshow) ------- */}
      {!videoReady && !still && (
        <div className="hero__progress" aria-hidden>
          {HERO_SCENES.map((_, i) => (
            <span key={i} className={`hero__progress-seg ${i === active ? 'is-active' : ''} ${i < active ? 'is-done' : ''}`}>
              <i style={{ animationDuration: `${SCENE_MS}ms` }} />
            </span>
          ))}
        </div>
      )}

      <motion.div className="hero__scroll" style={{ opacity: fade }} aria-hidden>
        <span>Scroll</span>
        <span className="hero__scroll-line" />
      </motion.div>
    </section>
  );
}
