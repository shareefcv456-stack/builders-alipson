import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Play } from 'lucide-react';
import Lenis from 'lenis';
import { LogoMark } from './ui/Logo';
import { scrollToId } from '../hooks/useLenis';
import { useUI } from '../context/UIContext';
import { isCapture } from '../lib/capture';
import HeroWireframe, { type WireHandle } from './HeroWireframe';
import { HERO_FRAMES } from '../lib/media';

gsap.registerPlugin(ScrollTrigger);

const N = HERO_FRAMES.length;
/* Scroll map. Gate parts → the drawing assembles over a darkened plate → the
   drawing dissolves as the photographic film takes over and scrubs to the end. */
const GATE_END = 0.12;    // doors finished parting
const WIRE_DRAWN = 0.28;  // line drawing complete, holds
const WIRE_END = 0.34;    // drawing fully dissolved
const FILM_START = 0.30;  // construction film starts advancing
/** Easing toward the scroll target — lower is smoother/heavier. */
const EASE = 0.14;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (a: number, b: number, v: number) => clamp01((v - a) / (b - a));

export default function StoryScroll() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wire = useRef<WireHandle>(null);
  const plate = useRef<HTMLDivElement>(null);
  const target = useRef(0);   // where scroll wants the playhead
  const cur = useRef(-1);     // where it actually is (eased toward target)
  const { openVideo } = useUI();
  const still = isCapture() || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /**
   * Scroll-driven frame-sequence player.
   *
   * One <canvas>, not N stacked <img> — the DOM cost of a 500+ frame sequence
   * is what kills this technique, so frames live in a plain array and only the
   * two straddling the playhead are ever drawn. Scroll sets a TARGET playhead;
   * a rAF loop eases the real playhead toward it, so the film keeps rolling for
   * a beat after the wheel stops instead of snapping. Scrolling up runs it
   * backwards for free — the playhead is just a number.
   *
   * Sub-frame blending (frame i drawn under frame i+1 at the fractional alpha)
   * is what turns a sparse sequence into continuous motion. With a dense
   * sequence it is a no-op; with a sparse one it is the whole trick.
   */
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d', { alpha: false });
    if (!ctx) return;

    // ---- decode every frame up front; they are the film ---------------------
    const imgs: HTMLImageElement[] = HERO_FRAMES.map((src) => {
      const im = new Image();
      im.decoding = 'async';
      im.src = src;
      return im;
    });

    let w = 0, h = 0, raf = 0, visible = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cur.current = -1;            // force a redraw at the new size
    };

    /** Cover-fit, biased low so the horizon sits where the CSS crop had it. */
    const paint = (im: HTMLImageElement, alpha: number) => {
      if (!im.complete || !im.naturalWidth) return;
      const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
      const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      ctx.globalAlpha = alpha;
      ctx.drawImage(im, (w - dw) / 2, (h - dh) * 0.62, dw, dh);
      ctx.globalAlpha = 1;
    };

    const draw = (raw: number) => {
      // One eased playhead drives all three layers, so they can never drift.
      const wireAlpha = 1 - span(WIRE_DRAWN, WIRE_END, raw);
      wire.current?.draw(span(GATE_END, WIRE_DRAWN, raw), wireAlpha);
      if (plate.current) plate.current.style.opacity = String(wireAlpha * 0.82);

      const p = span(FILM_START, 1, raw);
      const f = p * (N - 1);
      const i = Math.min(N - 1, Math.floor(f));
      const frac = f - i;
      ctx.fillStyle = '#0b0d13';
      ctx.fillRect(0, 0, w, h);
      paint(imgs[i], 1);
      if (frac > 0 && i + 1 < N) paint(imgs[i + 1], frac);
      // Slow push-in across the whole film, on the compositor.
      cv.style.transform = `scale(${1.07 - 0.07 * p})`;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const t = target.current;
      if (cur.current < 0) cur.current = t;
      else cur.current += (t - cur.current) * EASE;
      if (Math.abs(t - cur.current) < 0.0002) cur.current = t;
      draw(cur.current);
    };

    resize();
    window.addEventListener('resize', resize);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(cv);

    if (still) {
      target.current = 1;
      const last = imgs[N - 1];
      if (last.complete) draw(1); else last.onload = () => draw(1);
    } else {
      // Repaint as each frame lands so the opening shot is never a blank plate.
      imgs.forEach((im) => { im.onload = () => { cur.current = -1; }; });
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      io.disconnect();
    };
  }, [still]);

  useEffect(() => {
    if (still || !root.current) return;

    const lenis = (window as unknown as { lenis?: Lenis }).lenis;
    const onScroll = () => ScrollTrigger.update();
    lenis?.on('scroll', onScroll);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: 1,
          onUpdate: (self) => { target.current = self.progress; },
        },
      });
      // A scrubbed timeline maps its OWN duration across the whole scroll, so
      // this empty tween fixes the length at 6 — keeping the gate a quick
      // opening beat (first ~12% of scroll) rather than stretching it over the
      // section. Remove the spacer and the doors take 60% of the scroll to part.
      tl.to({}, { duration: 6 }, 0)
        // The doors part left/right and the brand mark fades with them.
        .to('.story__gate-l', { xPercent: -104, ease: 'power2.inOut', duration: 0.7 }, 0)
        .to('.story__gate-r', { xPercent: 104, ease: 'power2.inOut', duration: 0.7 }, 0)
        .to('.story__gate-brand', { autoAlpha: 0, scale: 0.9, ease: 'power1.in', duration: 0.55 }, 0)
        // Headline and CTAs resolve in behind the opening doors.
        .fromTo('.story__finale-copy', { autoAlpha: 0, yPercent: 18 }, { autoAlpha: 1, yPercent: 0, ease: 'power2.out', duration: 0.8 }, 0.35);
    }, root);

    const t = window.setTimeout(() => ScrollTrigger.refresh(), 350);
    return () => {
      window.clearTimeout(t);
      lenis?.off('scroll', onScroll);
      ctx.revert();
    };
  }, [still]);

  return (
    <section id="hero" className={`story ${still ? 'story--static' : ''}`} ref={root} aria-label="Alipson Builders — a project from excavation to handover">
      <div className="story__stage">
        {/* Scroll-scrubbed construction film */}
        <canvas
          ref={canvas}
          className="story__canvas"
          role="img"
          aria-label="A single Alipson project filmed from empty site through excavation, structure and facade to the finished, illuminated building"
        />
        <div className="story__plate" ref={plate} />
        <HeroWireframe ref={wire} className="story__wire" />
        <div className="story__grade" />

        {/* Headline + CTAs — the only overlay */}
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

        {/* Split gate — parts left/right on the first beat of scroll */}
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
