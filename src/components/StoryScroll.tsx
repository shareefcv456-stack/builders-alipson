import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Play } from 'lucide-react';
import Lenis from 'lenis';
import { LogoMark } from './ui/Logo';
import { scrollToId } from '../hooks/useLenis';
import { useUI } from '../context/UIContext';
import { isCapture } from '../lib/capture';
import ConstructionCanvas, { type ConstructionHandle } from './ConstructionCanvas';
import ParticleNetwork from './ParticleNetwork';

gsap.registerPlugin(ScrollTrigger);

// The build completes across exactly 3 scroll increments.
const PHASES = [
  { tag: 'Step 1', name: 'Foundation & Frame' },
  { tag: 'Step 2', name: 'Structure Rising' },
  { tag: 'Step 3', name: 'Facade & Finish' },
];

const phaseFor = (p: number) => (p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2);

export default function StoryScroll() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<ConstructionHandle>(null);
  const phaseRef = useRef(0);
  const [phase, setPhase] = useState(0);
  const { openVideo } = useUI();
  const still = isCapture() || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (still) { canvas.current?.setProgress(1); setPhase(2); return; }
    if (!root.current) return;

    const lenis = (window as unknown as { lenis?: Lenis }).lenis;
    const onScroll = () => ScrollTrigger.update();
    lenis?.on('scroll', onScroll);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: 1,
          onUpdate: (self) => {
            canvas.current?.setProgress(self.progress);
            const idx = phaseFor(self.progress);
            if (idx !== phaseRef.current) { phaseRef.current = idx; setPhase(idx); }
          },
        },
      });
      // Phase 1 — the gate splits open, revealing the live construction site.
      tl.to('.story__gate-l', { xPercent: -104, ease: 'power2.inOut', duration: 0.7 }, 0)
        .to('.story__gate-r', { xPercent: 104, ease: 'power2.inOut', duration: 0.7 }, 0)
        .to('.story__gate-brand', { autoAlpha: 0, scale: 0.9, ease: 'power1.in', duration: 0.55 }, 0)
        // Finale — the finished-landmark headline resolves.
        .fromTo('.story__finale-copy', { autoAlpha: 0, yPercent: 24 }, { autoAlpha: 1, yPercent: 0, ease: 'power2.out', duration: 1 }, 4.4);
    }, root);

    const t = window.setTimeout(() => ScrollTrigger.refresh(), 350);
    return () => {
      window.clearTimeout(t);
      lenis?.off('scroll', onScroll);
      ctx.revert();
    };
  }, [still]);

  const ph = PHASES[phase];

  return (
    <section id="hero" className={`story ${still ? 'story--static' : ''}`} ref={root} aria-label="Alipson Builders — from foundation to landmark">
      <div className="story__stage">
        {/* Deep-purple particle network — bottom layer, behind everything */}
        <ParticleNetwork className="story__particles" />
        {/* Scroll-driven line-art construction, transparent over the particles */}
        <ConstructionCanvas ref={canvas} className="story__canvas" />
        <div className="story__grade" />

        {/* Live phase marker */}
        <div className="story__phase" aria-hidden>
          <span className="story__phase-tag">{ph.tag}</span>
          <em className="story__phase-name">{ph.name}</em>
          <span className="story__phase-track"><i style={{ width: `${(phase + 1) * (100 / 3)}%` }} /></span>
        </div>

        {/* Finale — finished landmark */}
        <div className="story__finale-copy">
          <span className="eyebrow story__eyebrow">Alipson Builders Pvt Ltd</span>
          <h1 className="story__headline text-left sm:text-center text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white">
            Building More Than Structures,<br />We Build <em>Trust.</em>
          </h1>
          <div className="story__cta flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button className="btn btn-primary" onClick={() => scrollToId('work')}>
              Explore Projects <ArrowUpRight size={16} />
            </button>
            <button className="btn btn-watch" onClick={openVideo} aria-label="Watch our story">
              <span className="btn-watch__play"><Play size={13} fill="currentColor" /></span>
              Watch Story
            </button>
          </div>
        </div>

        {/* Phase 1 — cinematic split-gate */}
        <div className="story__gate" aria-hidden>
          <div className="story__gate-l" />
          <div className="story__gate-r" />
          <div className="story__gate-brand">
            <LogoMark size={72} />
            <span className="story__gate-name">ALIPSON BUILDERS</span>
            <span className="story__gate-sub">PVT LTD</span>
            <span className="story__gate-hint">Scroll to Enter</span>
          </div>
        </div>
      </div>
    </section>
  );
}
