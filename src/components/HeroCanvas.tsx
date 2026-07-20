import { useEffect, useRef } from 'react';
import { isCapture } from '../lib/capture';

/**
 * Cinematic construction scene rendered on <canvas> — an animated stand-in for
 * a background video: sunset sky, city skyline with flickering lit windows,
 * tower cranes with slowly swinging jibs, glowing weld sparks and rising embers.
 * Honours prefers-reduced-motion (and capture mode) by drawing a single frame.
 */

type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number };
type Ember = { x: number; y: number; vy: number; drift: number; size: number; alpha: number };
type Weld = { x: number; y: number; life: number };
type Crane = { x: number; y: number; jib: number; cjib: number; phase: number; speed: number };
type Win = { x: number; y: number; on: number; seed: number };
type Building = { x: number; w: number; h: number; wins: Win[] };

export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const still = isCapture() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0, h = 0, horizon = 0;
    let buildings: Building[] = [];
    let cranes: Crane[] = [];
    let embers: Ember[] = [];
    let sparks: Spark[] = [];
    let welds: Weld[] = [];
    let raf = 0;
    let weldTimer = 40;

    const spawnEmber = (anywhere = false): Ember => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : horizon + Math.random() * 30,
      vy: -(0.15 + Math.random() * 0.45),
      drift: (Math.random() - 0.5) * 0.3,
      size: 0.6 + Math.random() * 1.9,
      alpha: 0.08 + Math.random() * 0.5,
    });

    const build = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      horizon = h * 0.72;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      buildings = [];
      let x = -20;
      while (x < w + 40) {
        const bw = 28 + Math.random() * 74;
        const bh = 50 + Math.random() * Math.min(280, h * 0.44);
        const wins: Win[] = [];
        for (let wy = horizon - bh + 12; wy < horizon - 10; wy += 15) {
          for (let wx = x + 7; wx < x + bw - 7; wx += 13) {
            if (Math.random() < 0.55) wins.push({ x: wx, y: wy, on: Math.random() < 0.5 ? 1 : 0, seed: Math.random() * 6 });
          }
        }
        buildings.push({ x, w: bw, h: bh, wins });
        x += bw + 5 + Math.random() * 12;
      }

      cranes = [
        { x: w * 0.63, y: horizon - h * 0.52, jib: Math.min(230, w * 0.25), cjib: 74, phase: 0, speed: 0.05 },
        { x: w * 0.2, y: horizon - h * 0.36, jib: Math.min(150, w * 0.18), cjib: 54, phase: 2.2, speed: -0.038 },
      ];

      embers = Array.from({ length: still ? 0 : 36 }, () => spawnEmber(true));
    };

    const drawSky = (t: number) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.3);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#090b0f');
      g.addColorStop(0.4, '#1a1620');
      g.addColorStop(0.58, `rgb(${96 + pulse * 22}, 54, 42)`);
      g.addColorStop(0.71, `rgb(226, ${128 + pulse * 22}, 66)`);
      g.addColorStop(0.86, '#130f0c');
      g.addColorStop(1, '#0b0d0f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const drawSun = (t: number) => {
      const sx = w * 0.72, sy = h * 0.62;
      const r = h * 0.17 * (1 + 0.06 * Math.sin(t * 0.6));
      const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.6);
      rg.addColorStop(0, 'rgba(255, 214, 150, 0.9)');
      rg.addColorStop(0.32, 'rgba(240, 168, 88, 0.45)');
      rg.addColorStop(1, 'rgba(240, 168, 88, 0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    };

    const drawBuildings = (t: number) => {
      for (const b of buildings) {
        ctx.fillStyle = '#080a0d';
        ctx.fillRect(b.x, horizon - b.h, b.w, b.h + (h - horizon));
        for (const win of b.wins) {
          const lit = win.on ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.6 + win.seed)) : 0.05;
          ctx.fillStyle = `rgba(224, 178, 92, ${0.06 + lit * 0.5})`;
          ctx.fillRect(win.x, win.y, 4, 6);
        }
      }
    };

    const drawCrane = (c: Crane, t: number) => {
      ctx.strokeStyle = 'rgba(7, 8, 11, 0.96)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      // mast
      ctx.beginPath();
      ctx.moveTo(c.x, horizon);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      // lattice
      ctx.lineWidth = 1;
      for (let y = c.y; y < horizon; y += 22) {
        ctx.beginPath();
        ctx.moveTo(c.x - 4, y);
        ctx.lineTo(c.x + 4, y + 11);
        ctx.moveTo(c.x + 4, y);
        ctx.lineTo(c.x - 4, y + 11);
        ctx.stroke();
      }
      // rotating jib
      const ang = Math.sin(t * c.speed + c.phase) * 0.42;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ang);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-c.cjib, 0);
      ctx.lineTo(c.jib, 0);
      ctx.stroke();
      // apex mast + tie bars
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -26);
      ctx.lineTo(c.jib * 0.55, 0);
      ctx.moveTo(0, -26);
      ctx.lineTo(-c.cjib, 0);
      ctx.stroke();
      // counterweight
      ctx.fillStyle = 'rgba(7, 8, 11, 0.96)';
      ctx.fillRect(-c.cjib - 7, -5, 13, 15);
      // trolley + hook line
      const hookX = c.jib * (0.55 + 0.12 * Math.sin(t * 0.4 + c.phase));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hookX, 0);
      ctx.lineTo(hookX, 34 + 10 * Math.sin(t * 0.5));
      ctx.stroke();
      ctx.restore();
      // blinking tip light
      const blink = 0.5 + 0.5 * Math.sin(t * 2.4 + c.phase);
      ctx.fillStyle = `rgba(255, 90, 70, ${0.4 + blink * 0.6})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 26, 2.4, 0, Math.PI * 2);
      ctx.fill();
    };

    const spawnWeld = () => {
      const b = buildings[Math.floor(Math.random() * buildings.length)];
      if (!b) return;
      const wx = b.x + b.w * (0.2 + Math.random() * 0.6);
      const wy = horizon - b.h + Math.random() * 24;
      welds.push({ x: wx, y: wy, life: 1 });
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.4 + Math.random() * 2.4;
        sparks.push({ x: wx, y: wy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 1, max: 0.5 + Math.random() * 0.7, size: 0.6 + Math.random() * 1.5 });
      }
    };

    const drawWeldsAndSparks = (dt: number) => {
      ctx.globalCompositeOperation = 'screen';
      for (let i = welds.length - 1; i >= 0; i--) {
        const wd = welds[i];
        wd.life -= dt * 3.5;
        if (wd.life <= 0) { welds.splice(i, 1); continue; }
        const r = 22 * wd.life;
        const rg = ctx.createRadialGradient(wd.x, wd.y, 0, wd.x, wd.y, r);
        rg.addColorStop(0, `rgba(255, 244, 210, ${0.9 * wd.life})`);
        rg.addColorStop(0.4, `rgba(240, 200, 120, ${0.5 * wd.life})`);
        rg.addColorStop(1, 'rgba(240, 200, 120, 0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(wd.x, wd.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt / s.max;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        s.vy += dt * 3.4; // gravity
        s.x += s.vx;
        s.y += s.vy;
        ctx.fillStyle = `rgba(255, ${210 + Math.random() * 40}, 150, ${s.life})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    const drawEmbers = () => {
      ctx.globalCompositeOperation = 'screen';
      for (const e of embers) {
        e.y += e.vy;
        e.x += e.drift;
        if (e.y < -10) { Object.assign(e, spawnEmber(false)); e.y = h + 6; }
        ctx.fillStyle = `rgba(232, 190, 110, ${e.alpha})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    const scene = (t: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);
      drawSky(t);
      drawSun(t);
      drawBuildings(t);
      for (const c of cranes) drawCrane(c, t);
      drawEmbers();
      drawWeldsAndSparks(dt);
    };

    let prev = 0;
    const loop = (ts: number) => {
      const t = ts * 0.001;
      const dt = Math.min(0.05, prev ? t - prev : 0.016);
      prev = t;
      if (--weldTimer <= 0) { spawnWeld(); weldTimer = 80 + Math.random() * 120; }
      scene(t, dt);
      raf = requestAnimationFrame(loop);
    };

    build();
    if (still) {
      // draw a composed static frame (with a couple of weld glows for warmth)
      spawnWeld();
      scene(2.2, 0.016);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => { build(); };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} className="hero__canvas" aria-hidden />;
}
