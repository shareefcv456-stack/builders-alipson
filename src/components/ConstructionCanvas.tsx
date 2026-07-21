import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Scroll-driven construction cycle rendered on <canvas>.
 * `setProgress(0..1)` maps scroll position to the build state:
 *   A 0–25%  groundwork + machinery + piling
 *   B 25–60% steel frame rising level-by-level, concrete slabs
 *   C 60–90% glass facade, windows lighting, landscaping
 *   D 90–100% finished luxury landmark glowing at evening
 * An internal RAF adds ambient life (crane sway, machinery, embers); the scene
 * pauses when off-screen and honours reduced-motion by drawing a single frame.
 */
export type ConstructionHandle = { setProgress: (p: number) => void };

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
type RGB = [number, number, number];
const mix = (c1: RGB, c2: RGB, t: number): string =>
  `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;

const N_FLOORS = 6;

const ConstructionCanvas = forwardRef<ConstructionHandle, { className?: string }>(
  function ConstructionCanvas({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const progress = useRef(0);

    useImperativeHandle(ref, () => ({ setProgress: (p) => { progress.current = clamp(p); } }), []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let W = 0, H = 0, ground = 0;
      let raf = 0;
      let visible = true;

      const resize = () => {
        W = canvas.clientWidth; H = canvas.clientHeight; ground = H * 0.82;
        canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      // ---- scene pieces -------------------------------------------------
      const drawSky = (p: number) => {
        const warm = smooth(0.6, 1, p); // evening warmth grows late
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, mix([18, 22, 32], [12, 10, 16], warm));
        g.addColorStop(0.55, mix([32, 38, 50], [40, 26, 30], warm));
        g.addColorStop(1, mix([46, 52, 64], [70, 40, 34], warm));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        // sun / evening glow — descends and warms as the build completes
        const sx = W * 0.76, sy = lerp(H * 0.26, H * 0.6, warm);
        const r = H * (0.16 + 0.1 * warm);
        const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.4);
        rg.addColorStop(0, `rgba(255,${Math.round(lerp(233, 190, warm))},${Math.round(lerp(180, 120, warm))},${0.35 + 0.4 * warm})`);
        rg.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sx, sy, r * 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      };

      const drawSkyline = () => {
        // faint background city for depth
        ctx.fillStyle = 'rgba(10,12,18,0.55)';
        let x = -20;
        let seed = 1;
        while (x < W + 20) {
          const rnd = (Math.sin(seed) * 0.5 + 0.5); seed += 1.7;
          const bw = 30 + rnd * 60;
          const bh = 40 + ((Math.sin(seed * 2.1) * 0.5 + 0.5)) * H * 0.22;
          ctx.fillRect(x, ground - bh, bw, bh);
          x += bw + 10;
        }
      };

      const drawGround = () => {
        ctx.fillStyle = '#0c0f16';
        ctx.fillRect(0, ground, W, H - ground);
        ctx.strokeStyle = 'rgba(229,57,53,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, ground + 0.5); ctx.lineTo(W, ground + 0.5); ctx.stroke();
      };

      // building metrics
      const geo = () => {
        const bw = Math.min(W * 0.3, 380);
        const bx = W * 0.5 - bw / 2;
        const fh = Math.min((H * 0.52) / N_FLOORS, 74);
        return { bw, bx, fh };
      };

      const drawExcavator = (t: number, alpha: number) => {
        if (alpha <= 0.01) return;
        const { bx } = geo();
        const ex = Math.max(70, bx - 120), ey = ground;
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.fillStyle = '#b9861f';
        ctx.fillRect(ex - 26, ey - 26, 52, 20); // body
        ctx.fillStyle = '#14171f';
        ctx.fillRect(ex - 30, ey - 8, 60, 10); // tracks
        // arm
        const sw = Math.sin(t * 1.4) * 0.3;
        ctx.strokeStyle = '#b9861f'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex + 12, ey - 22);
        const j1x = ex + 12 + Math.cos(-0.9 + sw) * 40, j1y = ey - 22 + Math.sin(-0.9 + sw) * 40;
        ctx.lineTo(j1x, j1y);
        const j2x = j1x + Math.cos(0.4 + sw) * 42, j2y = j1y + Math.sin(0.4 + sw) * 42;
        ctx.lineTo(j2x, j2y);
        ctx.stroke();
        ctx.restore();
      };

      const drawCrane = (t: number, cp: number, alpha: number) => {
        if (alpha <= 0.01) return;
        const { bx, bw, fh } = geo();
        const mx = bx + bw + 46;
        const topY = ground - (fh * N_FLOORS) * clamp(cp * 1.05) - 30;
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#cfd3da'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(mx, ground); ctx.lineTo(mx, topY); ctx.stroke();
        // lattice
        ctx.lineWidth = 1;
        for (let y = topY; y < ground; y += 20) {
          ctx.beginPath(); ctx.moveTo(mx - 4, y); ctx.lineTo(mx + 4, y + 10);
          ctx.moveTo(mx + 4, y); ctx.lineTo(mx - 4, y + 10); ctx.stroke();
        }
        // jib
        const ang = Math.sin(t * 0.5) * 0.16;
        ctx.save(); ctx.translate(mx, topY); ctx.rotate(ang);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-160, 0); ctx.stroke();
        ctx.fillStyle = '#14171f'; ctx.fillRect(-70, -5, 14, 14); // counterweight
        // hook line
        const hx = -110 - 30 * (Math.sin(t * 0.5) * 0.5 + 0.5);
        ctx.strokeStyle = 'rgba(207,211,218,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, 34 + 10 * Math.sin(t * 0.8)); ctx.stroke();
        ctx.restore();
        // blinking tip light
        const blink = 0.5 + 0.5 * Math.sin(t * 3);
        ctx.fillStyle = `rgba(230,60,60,${0.4 + blink * 0.6})`;
        ctx.beginPath(); ctx.arc(mx, topY - 4, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };

      const drawBuilding = (t: number, p: number) => {
        const { bx, bw, fh } = geo();
        const cp = smooth(0.08, 0.9, p);          // construction fraction
        const gp = smooth(0.5, 0.92, p);          // glazing fraction
        const lp = smooth(0.72, 1, p);            // lighting fraction
        const colGap = bw / 3;

        // foundation slab
        if (p > 0.05) {
          ctx.fillStyle = '#191d27';
          ctx.fillRect(bx - 10, ground - 8, bw + 20, 10);
        }

        for (let i = 0; i < N_FLOORS; i++) {
          const fp = clamp(cp * N_FLOORS - i);     // 0..1 this floor's build
          if (fp <= 0) continue;
          const floorBottom = ground - i * fh;
          const colH = fp * fh;

          // steel columns rising (crimson-tinted steel)
          ctx.strokeStyle = mix([120, 60, 62], [229, 57, 53], 0.5);
          ctx.lineWidth = 4; ctx.lineCap = 'round';
          for (let c = 0; c <= 3; c++) {
            const cx = bx + c * colGap;
            ctx.beginPath(); ctx.moveTo(cx, floorBottom); ctx.lineTo(cx, floorBottom - colH); ctx.stroke();
          }
          // floor slab / beam once columns are up
          if (fp >= 0.55) {
            ctx.fillStyle = '#2a2f3a';
            ctx.fillRect(bx - 4, floorBottom - fh - 4, bw + 8, 8);
          }
          // glass facade fills bottom-up during phase C
          const gFloors = gp * N_FLOORS;
          if (i < gFloors) {
            const gAlpha = clamp(gFloors - i) * 0.9;
            const gg = ctx.createLinearGradient(bx, floorBottom - fh, bx + bw, floorBottom);
            gg.addColorStop(0, `rgba(150,180,205,${0.16 * gAlpha})`);
            gg.addColorStop(0.5, `rgba(90,120,150,${0.30 * gAlpha})`);
            gg.addColorStop(1, `rgba(150,180,205,${0.16 * gAlpha})`);
            ctx.fillStyle = gg;
            ctx.fillRect(bx, floorBottom - fh, bw, fh - 2);
            // mullions
            ctx.strokeStyle = `rgba(20,24,32,${0.5 * gAlpha})`; ctx.lineWidth = 1;
            for (let c = 1; c < 3; c++) { const cx = bx + c * colGap; ctx.beginPath(); ctx.moveTo(cx, floorBottom - fh); ctx.lineTo(cx, floorBottom); ctx.stroke(); }
          }
          // warm windows light up late
          if (lp > 0 && i < gFloors) {
            for (let c = 0; c < 3; c++) {
              const on = (Math.sin(i * 3.1 + c * 2.3) * 0.5 + 0.5);
              if (on < 0.4) continue;
              const wx = bx + c * colGap + 6, wy = floorBottom - fh + 8;
              ctx.fillStyle = `rgba(255,200,120,${lp * (0.35 + 0.4 * on)})`;
              ctx.fillRect(wx, wy, colGap - 12, fh - 16);
            }
          }
        }

        // scaffolding during mid construction
        const scaf = smooth(0.15, 0.28, p) * (1 - smooth(0.62, 0.75, p));
        if (scaf > 0.02) {
          ctx.strokeStyle = `rgba(190,150,60,${0.5 * scaf})`; ctx.lineWidth = 1.4;
          const topFloor = clamp(cp * N_FLOORS) ;
          const sh = topFloor * fh;
          [bx - 8, bx + bw + 8].forEach((sx) => {
            ctx.beginPath(); ctx.moveTo(sx, ground); ctx.lineTo(sx, ground - sh); ctx.stroke();
            for (let y = ground; y > ground - sh; y -= fh * 0.5) {
              ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(bx + bw / 2, y); ctx.stroke();
            }
          });
        }

        // welding sparks near the active top floor (phase B)
        const weldA = smooth(0.2, 0.32, p) * (1 - smooth(0.58, 0.7, p));
        if (weldA > 0.05 && !reduce) {
          const topFloor = clamp(cp * N_FLOORS);
          const wy = ground - topFloor * fh;
          const wx = bx + (0.2 + 0.6 * (Math.sin(t * 2.3) * 0.5 + 0.5)) * bw;
          ctx.globalCompositeOperation = 'screen';
          for (let s = 0; s < 6; s++) {
            const a = Math.random() * Math.PI * 2, d = Math.random() * 14;
            ctx.fillStyle = `rgba(255,${200 + Math.random() * 55},150,${weldA})`;
            ctx.beginPath(); ctx.arc(wx + Math.cos(a) * d, wy + Math.sin(a) * d, 1 + Math.random(), 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      };

      const drawLandscape = (p: number) => {
        const a = smooth(0.82, 0.96, p);
        if (a <= 0.01) return;
        const { bx, bw } = geo();
        ctx.save(); ctx.globalAlpha = a;
        // pathway glow
        const pg = ctx.createLinearGradient(0, ground, 0, ground + 40);
        pg.addColorStop(0, 'rgba(255,190,120,0.25)'); pg.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.fillStyle = pg; ctx.fillRect(bx, ground, bw, 30);
        // trees + lamp posts flanking
        const spots = [bx - 40, bx - 18, bx + bw + 18, bx + bw + 40];
        spots.forEach((sxx, i) => {
          if (i % 2 === 0) { // tree
            ctx.fillStyle = '#12261a'; ctx.beginPath(); ctx.arc(sxx, ground - 22, 14, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0e1a12'; ctx.fillRect(sxx - 2, ground - 22, 4, 22);
          } else { // lamp
            ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sxx, ground); ctx.lineTo(sxx, ground - 30); ctx.stroke();
            ctx.fillStyle = 'rgba(255,200,130,0.9)'; ctx.beginPath(); ctx.arc(sxx, ground - 32, 3.5, 0, Math.PI * 2); ctx.fill();
          }
        });
        ctx.restore();
      };

      const frame = (t: number) => {
        const p = progress.current;
        ctx.clearRect(0, 0, W, H);
        drawSky(p);
        drawSkyline();
        drawGround();
        drawExcavator(t, 1 - smooth(0.26, 0.4, p));
        drawBuilding(t, p);
        drawCrane(t, smooth(0.08, 0.9, p), 1 - smooth(0.88, 0.98, p));
        drawLandscape(p);
      };

      const loop = () => {
        const t = performance.now() * 0.001;
        if (visible) frame(t);
        raf = requestAnimationFrame(loop);
      };

      resize();
      window.addEventListener('resize', resize);

      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
      io.observe(canvas);

      if (reduce) { frame(2); } else { raf = requestAnimationFrame(loop); }

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        io.disconnect();
      };
    }, []);

    return <canvas ref={canvasRef} className={className} aria-hidden />;
  }
);

export default ConstructionCanvas;
