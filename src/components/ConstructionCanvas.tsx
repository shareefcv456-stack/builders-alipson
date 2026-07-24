import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Scroll-driven LINE-ART construction reveal, rendered on a TRANSPARENT <canvas>
 * so the deep-purple particle network shows through behind it.
 *
 * `setProgress(0..1)` maps scroll position to the build, completing across
 * exactly THREE scroll increments:
 *   Increment 1  (0 – 1/3)  ground, podium + the full structural frame rises,
 *                           with diagonal cross-bracing
 *   Increment 2  (1/3 – 2/3) floor slabs level-by-level, tiered setback frame,
 *                           tower crane assist
 *   Increment 3  (2/3 – 1)  facade mullion grid, lit windows, stepped crown,
 *                           antenna mast, entrance + podium detailing
 * At progress === 1 the entire, richly-detailed tower is drawn — nothing is
 * left partial. An internal RAF adds ambient life (crane sway, blinking tip
 * light, beacon); reduced-motion paints one complete static frame.
 */
export type ConstructionHandle = { setProgress: (p: number) => void };

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// Ink + accent for the line work — bright enough to stay crisp on purple.
const INK = 'rgba(238, 232, 248, ALPHA)';
const ACCENT = 'rgba(230, 90, 96, ALPHA)';      // crimson-soft, brand accent
const col = (base: string, a: number) => base.replace('ALPHA', a.toFixed(3));

const N_FLOORS = 11;          // main shaft floors
const BAYS = 4;               // structural bays across the shaft

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
      let W = 0, H = 0, ground = 0, raf = 0, visible = true;

      const resize = () => {
        W = canvas.clientWidth; H = canvas.clientHeight; ground = H * 0.85;
        canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      // ---- responsive geometry ----------------------------------------------
      const geo = () => {
        const bw = Math.min(W * 0.28, 300);
        const cx = W * 0.5;
        const bx = cx - bw / 2;
        const bh = Math.min(H * 0.62, N_FLOORS * 52);
        const fh = bh / N_FLOORS;
        const top = ground - bh;
        const colGap = bw / BAYS;
        // widened podium at the base
        const podW = bw * 1.7, podH = fh * 1.6, podX = cx - podW / 2;
        return { bw, bx, cx, bh, fh, top, colGap, podW, podH, podX };
      };

      // horizontal half-width of the shaft at floor i (tiered setbacks near top)
      const bandHalf = (i: number, bw: number) => {
        if (i >= N_FLOORS - 1) return bw * 0.28;   // slender crown floor
        if (i >= N_FLOORS - 3) return bw * 0.38;   // upper setback
        return bw * 0.5;                           // full shaft
      };

      // Draw a straight segment revealed 0..t along its own length.
      const seg = (x1: number, y1: number, x2: number, y2: number, t: number, style: string, w: number) => {
        if (t <= 0.001) return;
        ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, t), lerp(y1, y2, t)); ctx.stroke();
      };

      // ---- ground plane ------------------------------------------------------
      const drawGround = (p: number) => {
        seg(W * 0.05, ground, W * 0.95, ground, smooth(0, 0.04, p), col(INK, 0.5), 1.4);
        seg(W * 0.05, ground + 4, W * 0.95, ground + 4, smooth(0.02, 0.08, p), col(ACCENT, 0.75), 1.6);
        // ground tick marks (survey grid)
        const gt = smooth(0.02, 0.12, p);
        if (gt > 0) {
          ctx.strokeStyle = col(INK, 0.16 * gt); ctx.lineWidth = 1;
          for (let x = W * 0.08; x < W * 0.93; x += 46) {
            ctx.beginPath(); ctx.moveTo(x, ground + 2); ctx.lineTo(x + 10, ground + 12); ctx.stroke();
          }
        }
      };

      // ---- INCREMENT 1 — structural frame + bracing -------------------------
      const drawFrame = (p: number) => {
        const { bw, cx, top, fh, colGap, podW, podH, podX } = geo();
        const bx = cx - bw / 2;

        // podium footprint
        const pod = smooth(0.03, 0.12, p);
        if (pod > 0) {
          ctx.strokeStyle = col(INK, 0.6); ctx.lineWidth = 1.6;
          ctx.strokeRect(podX, ground - podH, podW * (pod > 0.5 ? 1 : pod * 2), podH);
          seg(podX, ground - podH, podX + podW, ground - podH, pod, col(INK, 0.7), 1.6);
        }

        // main vertical columns rise from podium up (0.08 → 0.32)
        for (let c = 0; c <= BAYS; c++) {
          const x = bx + c * colGap;
          const edge = c === 0 || c === BAYS;
          const t = smooth(0.08 + c * 0.01, 0.32, p);
          seg(x, ground - podH * 0.2, x, top, t, col(INK, edge ? 0.85 : 0.4), edge ? 2.4 : 1.1);
        }
        // top cap beam closes the frame
        seg(bx, top, bx + bw, top, smooth(0.28, 0.34, p), col(INK, 0.85), 2.2);

        // diagonal cross-bracing in outer bays (X pattern), rising in pairs
        const brace = smooth(0.16, 0.33, p);
        if (brace > 0) {
          ctx.strokeStyle = col(ACCENT, 0.28 * brace); ctx.lineWidth = 1;
          for (let i = 0; i < N_FLOORS; i += 2) {
            const yb = ground - i * fh, yt = ground - Math.min(i + 2, N_FLOORS) * fh;
            [[bx, bx + colGap], [bx + bw - colGap, bx + bw]].forEach(([l, r]) => {
              const tb = clamp((brace * N_FLOORS - i) * 0.5);
              seg(l, yb, r, yt, tb, col(ACCENT, 0.3 * brace), 1);
              seg(r, yb, l, yt, tb, col(ACCENT, 0.3 * brace), 1);
            });
          }
        }
      };

      // ---- INCREMENT 2 — floor slabs + setback frame ------------------------
      const drawFloors = (p: number) => {
        const { bw, cx, fh } = geo();
        for (let i = 1; i < N_FLOORS; i++) {
          const y = ground - i * fh;
          const hw = bandHalf(i, bw);
          const s = 0.34 + (i / N_FLOORS) * 0.26;      // stagger bottom → top
          const t = smooth(s, s + 0.05, p);
          seg(cx - hw, y, cx + hw, y, t, col(INK, 0.5), 1.3);
        }
        // sky-lobby accent band mid-height
        const midY = ground - Math.round(N_FLOORS * 0.55) * fh;
        seg(cx - bandHalf(6, bw), midY, cx + bandHalf(6, bw), midY, smooth(0.52, 0.6, p), col(ACCENT, 0.7), 1.8);

        // outline the tiered setback silhouette as floors reach the top
        const setb = smooth(0.55, 0.66, p);
        if (setb > 0) {
          for (let i = N_FLOORS - 3; i < N_FLOORS; i++) {
            const y = ground - i * fh, hw = bandHalf(i, bw);
            seg(cx - hw, y, cx - hw, y + fh, setb, col(INK, 0.6), 1.4);
            seg(cx + hw, y, cx + hw, y + fh, setb, col(INK, 0.6), 1.4);
          }
        }
      };

      // ---- INCREMENT 3 — facade grid, windows, crown, entrance --------------
      const drawFacade = (p: number) => {
        const { bw, cx, top, fh, colGap } = geo();
        const bx = cx - bw / 2;

        // vertical mullions across the shaft (2 sub-mullions per bay = fine grid)
        const mul = smooth(0.66, 0.82, p);
        if (mul > 0) {
          const step = colGap / 2;
          for (let x = bx + step; x < bx + bw; x += step) {
            const bottom = ground;
            const topY = top;
            seg(x, bottom, x, topY, mul, col(INK, 0.22), 0.9);
          }
        }

        // window panes light up floor-by-floor (warm) in the final third
        const glow = smooth(0.72, 1, p);
        if (glow > 0) {
          const panes = BAYS * 2;
          const paneW = bw / panes;
          for (let i = 0; i < N_FLOORS; i++) {
            const hw = bandHalf(i, bw);
            const y0 = ground - (i + 1) * fh + 4, wh = fh - 8;
            for (let c = 0; c < panes; c++) {
              const px = bx + c * paneW + 3;
              if (px < cx - hw || px + paneW > cx + hw) continue;   // respect setbacks
              const on = Math.sin(i * 2.3 + c * 1.7) * 0.5 + 0.5;
              const litT = clamp((glow * N_FLOORS - i) * 0.9);
              if (litT <= 0 || on < 0.36) continue;
              ctx.fillStyle = `rgba(255, 206, 140, ${litT * (0.12 + 0.16 * on)})`;
              ctx.fillRect(px, y0, paneW - 6, wh);
              ctx.strokeStyle = col(INK, 0.16 * litT); ctx.lineWidth = 0.7;
              ctx.strokeRect(px, y0, paneW - 6, wh);
            }
          }
        }

        // stepped crown parapet
        const crown = smooth(0.82, 0.94, p);
        if (crown > 0) {
          const hw = bandHalf(N_FLOORS - 1, bw);
          seg(cx - hw - 6, top - 8, cx + hw + 6, top - 8, crown, col(INK, 0.85), 2);
          seg(cx - hw - 6, top - 8, cx - hw - 6, top, crown, col(INK, 0.7), 1.4);
          seg(cx + hw + 6, top - 8, cx + hw + 6, top, crown, col(INK, 0.7), 1.4);
          // parapet teeth
          ctx.strokeStyle = col(INK, 0.5 * crown); ctx.lineWidth = 1;
          for (let x = cx - hw; x < cx + hw; x += 12) {
            ctx.beginPath(); ctx.moveTo(x, top - 8); ctx.lineTo(x, top - 14); ctx.stroke();
          }
        }

        // antenna mast + beacon
        const mast = smooth(0.9, 1, p);
        seg(cx, top - 8, cx, top - 8 - fh * 1.4, mast, col(ACCENT, 0.9), 2);
        // mast cross bars
        if (mast > 0.4) {
          ctx.strokeStyle = col(INK, 0.5 * mast); ctx.lineWidth = 1;
          for (let k = 1; k <= 3; k++) {
            const my = top - 8 - fh * 1.4 * (k / 4), mw = 6 * k;
            ctx.beginPath(); ctx.moveTo(cx - mw, my); ctx.lineTo(cx + mw, my); ctx.stroke();
          }
        }

        // entrance — canopy, double doors, steps at the podium
        const ent = smooth(0.86, 1, p);
        if (ent > 0) {
          const ew = colGap * 1.5, ex = cx - ew / 2, eh = fh * 1.1;
          ctx.strokeStyle = col(INK, 0.8); ctx.lineWidth = 1.4;
          ctx.strokeRect(ex, ground - eh, ew * ent, eh);
          seg(cx, ground - eh, cx, ground, ent, col(INK, 0.55), 1);
          seg(ex - 12, ground - eh, ex + ew + 12, ground - eh, ent, col(ACCENT, 0.7), 1.6);   // canopy
          // steps
          ctx.strokeStyle = col(INK, 0.4 * ent); ctx.lineWidth = 1;
          for (let s = 1; s <= 3; s++) {
            const sy = ground + s * 3, sw = ew / 2 + s * 8;
            ctx.beginPath(); ctx.moveTo(cx - sw, sy); ctx.lineTo(cx + sw, sy); ctx.stroke();
          }
        }
      };

      // ---- tower crane (line art) — assists, fades at completion ------------
      const drawCrane = (t: number, p: number) => {
        const rise = smooth(0.05, 0.6, p);
        const fade = 1 - smooth(0.9, 1, p);        // gone once the tower is finished
        if (fade <= 0.01 || rise <= 0.01) return;
        const { bw, cx, top } = geo();
        const mx = cx + bw * 0.5 + 60;
        const mastTop = lerp(ground, top - 46, rise);
        ctx.save(); ctx.globalAlpha = fade;
        ctx.strokeStyle = col(INK, 0.5); ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(mx, ground); ctx.lineTo(mx, mastTop); ctx.stroke();
        ctx.lineWidth = 0.8;
        for (let y = mastTop; y < ground; y += 22) {
          ctx.beginPath(); ctx.moveTo(mx - 4, y); ctx.lineTo(mx + 4, y + 11);
          ctx.moveTo(mx + 4, y); ctx.lineTo(mx - 4, y + 11); ctx.stroke();
        }
        const ang = Math.sin(t * 0.5) * 0.12;
        ctx.save(); ctx.translate(mx, mastTop); ctx.rotate(ang);
        ctx.lineWidth = 2; ctx.strokeStyle = col(INK, 0.5);
        ctx.beginPath(); ctx.moveTo(66, 0); ctx.lineTo(-150, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(66, 0); ctx.lineTo(-70, 0); ctx.stroke();
        const hx = -80 - 30 * (Math.sin(t * 0.5) * 0.5 + 0.5);
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, 30 + 8 * Math.sin(t * 0.9)); ctx.stroke();
        ctx.restore();
        const blink = 0.5 + 0.5 * Math.sin(t * 3);
        ctx.fillStyle = col(ACCENT, (0.4 + blink * 0.6) * fade);
        ctx.beginPath(); ctx.arc(mx, mastTop - 3, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };

      const frame = (t: number) => {
        const p = progress.current;
        ctx.clearRect(0, 0, W, H);          // transparent — particles show through
        drawGround(p);
        drawCrane(t, p);
        drawFrame(p);
        drawFloors(p);
        drawFacade(p);
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

      if (reduce) { progress.current = 1; frame(2); } else { raf = requestAnimationFrame(loop); }

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
