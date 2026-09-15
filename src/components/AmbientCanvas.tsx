import { useEffect, useRef } from 'react';

/**
 * Subtle, scroll/ambient construction backgrounds for the body sections.
 * Very low-contrast so overlay text stays readable. Theme-aware (reads
 * data-theme each frame), pauses when off-screen, and honours reduced-motion
 * by drawing a single still frame.
 *
 *  blueprint — self-drawing elevation lines + faint grid   (The Studio)
 *  cranes    — slow tower cranes + drifting dust           (Projects)
 *  assembly  — steel beams sliding into place + pour lines (Services)
 *  dusk      — completed landmark, twinkling warm windows  (Founder/Contact)
 */
type Variant = 'blueprint' | 'cranes' | 'assembly' | 'dusk';

export default function AmbientCanvas({ variant, className }: { variant: Variant; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* DPR 1 EVERYWHERE. The canvas is the size of its SECTION, not the
       viewport — Projects alone is ~1440x4500 CSS px — cleared and repainted
       continuously. At dpr 2 that is 4x the fragments for line-work drawn at
       16% opacity under a 62% white mask. Nobody can see the difference; the
       GPU can. */
    const dpr = 1;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* HALF RATE EVERYWHERE. SPEED is already 0.6 — this is a calm ambient
       watermark, not motion anyone tracks — so 30fps looks identical and hands
       every other frame back to the scroll. Time is read from the clock, not
       accumulated per frame, so the animation runs at the same WALL SPEED at
       either rate; only the sampling changes. */
    const minFrameMs = 1000 / 30;
    let W = 0, H = 0, raf = 0, visible = true, lastDraw = 0;

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      /* Mobile browsers fire resize every time the URL bar collapses. Writing
         canvas.width reallocates the backing store and clears it, so bailing
         when nothing changed is the difference between a no-op and a full
         re-raster mid-scroll. */
      if (w === W && h === H) return;
      W = w; H = h;
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // These render behind WHITE sections, so the line-work is charcoal ink —
    // it reads as a faint architectural watermark. (It was light ink back when
    // the sections carried a #0D1117 overlay; that overlay is gone.)
    const ink = (a: number) => `rgba(26,29,32,${a})`;
    const crimson = (a: number) => `rgba(211, 16, 24,${a})`;
    // Cinematic slow-down: ease the global clock so motion stays subtle & calm
    // (keeps every drawing routine untouched — only the tempo changes).
    const SPEED = 0.6;

    // ---- blueprint: grid + a building elevation that draws itself ----------
    const elevation = [
      [0.28, 0.9], [0.28, 0.4], [0.38, 0.28], [0.5, 0.34], [0.5, 0.9],
      [0.5, 0.5], [0.72, 0.5], [0.72, 0.9], [0.72, 0.32], [0.62, 0.32],
    ];
    let elevLen = 0;
    const drawBlueprint = (t: number) => {
      ctx.strokeStyle = ink(0.05); ctx.lineWidth = 1;
      const step = 46;
      for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      const pts = elevation.map(([px, py]) => [px * W, py * H] as const);
      if (!elevLen) for (let i = 1; i < pts.length; i++) elevLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const prog = (t % 9) / 9; // 9s draw cycle
      ctx.strokeStyle = crimson(0.5); ctx.lineWidth = 1.4;
      ctx.setLineDash([elevLen]); ctx.lineDashOffset = elevLen * (1 - prog);
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke(); ctx.setLineDash([]);
      // dimension ticks
      ctx.fillStyle = crimson(0.35);
      for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill(); }
    };

    // ---- cranes: slow tower cranes + drifting dust -------------------------
    const dust = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.6, d: 0.2 + Math.random() * 0.5 }));
    const crane = (cx: number, baseY: number, mastH: number, jib: number, phase: number, t: number) => {
      ctx.strokeStyle = ink(0.14); ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(cx, baseY - mastH); ctx.stroke();
      ctx.save(); ctx.translate(cx, baseY - mastH); ctx.rotate(Math.sin(t * 0.12 + phase) * 0.14);
      ctx.beginPath(); ctx.moveTo(-jib * 0.4, 0); ctx.lineTo(jib, 0); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18); ctx.lineTo(jib * 0.7, 0); ctx.moveTo(0, -18); ctx.lineTo(-jib * 0.4, 0); ctx.stroke();
      const hx = jib * (0.5 + 0.15 * Math.sin(t * 0.3 + phase));
      ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, 26 + 8 * Math.sin(t * 0.4)); ctx.stroke();
      ctx.restore();
    };
    const drawCranes = (t: number) => {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      const sh = 0.02 + 0.02 * (0.5 + 0.5 * Math.sin(t * 0.15));
      g.addColorStop(0, crimson(sh)); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, crimson(sh * 0.6));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      crane(W * 0.22, H * 0.98, H * 0.66, Math.min(200, W * 0.24), 0, t);
      crane(W * 0.78, H * 0.98, H * 0.52, Math.min(150, W * 0.18), 2.1, t);
      ctx.fillStyle = ink(0.16);
      for (const p of dust) {
        p.y -= p.d * 0.0006; if (p.y < 0) p.y = 1;
        p.x += Math.sin(t * 0.2 + p.y * 8) * 0.0004;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.s, 0, Math.PI * 2); ctx.fill();
      }
    };

    // ---- assembly: steel beams sliding in + pour line ----------------------
    const drawAssembly = (t: number) => {
      const rows = 5;
      for (let i = 0; i < rows; i++) {
        const cycle = (t * 0.35 + i * 0.6) % rows;
        const settle = Math.min(1, cycle); // 0..1 slide-in
        const y = H * (0.2 + i * 0.14);
        const fromLeft = i % 2 === 0;
        const bw = W * 0.34;
        const rest = fromLeft ? W * 0.12 : W * 0.54;
        const startX = fromLeft ? -bw : W;
        const x = startX + (rest - startX) * (settle * settle * (3 - 2 * settle));
        ctx.fillStyle = ink(0.06);
        ctx.fillRect(x, y, bw, 6);
        ctx.fillStyle = crimson(0.18 * settle);
        ctx.fillRect(x, y, bw, 2);
      }
      // slow "pour" shimmer column
      const px = W * (0.5 + 0.28 * Math.sin(t * 0.18));
      const pg = ctx.createLinearGradient(px, 0, px, H);
      pg.addColorStop(0, crimson(0.0)); pg.addColorStop(0.5, crimson(0.08)); pg.addColorStop(1, crimson(0.0));
      ctx.fillStyle = pg; ctx.fillRect(px - 30, 0, 60, H);
    };

    // ---- dusk: completed landmark with twinkling warm windows --------------
    const drawDusk = (t: number) => {
      const g = ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, 'rgba(200,90,40,0.10)'); g.addColorStop(0.5, 'rgba(120,40,40,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const towers = [[0.2, 0.4, 0.24], [0.42, 0.55, 0.16], [0.62, 0.35, 0.2], [0.8, 0.5, 0.18]] as const;
      for (const [bx, bh, bw] of towers) {
        const x = bx * W, w = bw * Math.min(W, 520) * 0.5, h = bh * H, top = H - h;
        ctx.fillStyle = ink(0.10); ctx.fillRect(x, top, w, h);
        for (let wy = top + 12; wy < H - 8; wy += 18) {
          for (let wx = x + 6; wx < x + w - 6; wx += 14) {
            const tw = Math.sin(wx * 0.6 + wy * 0.3 + t * 1.2);
            if (tw > 0.2) { ctx.fillStyle = `rgba(255,200,120,${0.12 + 0.18 * tw})`; ctx.fillRect(wx, wy, 7, 9); }
          }
        }
      }
    };

    const DRAW: Record<Variant, (t: number) => void> = {
      blueprint: drawBlueprint, cranes: drawCranes, assembly: drawAssembly, dusk: drawDusk,
    };

    const frame = (t: number) => { ctx.clearRect(0, 0, W, H); DRAW[variant](t); };
    /* THE LOOP STOPS WHEN THE CANVAS LEAVES THE SCREEN — it does not merely skip
       the draw. The old version scheduled a callback every frame for the life of
       the page and returned early inside it, so two of these (Services and
       Projects) were still waking the main thread 120 times a second while the
       visitor read the footer. */
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastDraw < minFrameMs) return;
      lastDraw = now;
      frame(now * 0.001 * SPEED);
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    /* NOTHING IS ALLOCATED UNTIL THE SECTION IS ABOUT TO BE SEEN. The backing
       store is section-sized (Projects is ~1440x4500) and used to be allocated,
       and the loop started, the moment the section MOUNTED — a viewport early,
       in the same frames the section's photos decode. That is the hitch measured
       entering #work. Now it is sized and started in an idle slot once the canvas
       is within 300px, and never at all where the stylesheet hides it (phones). */
    let ready = false, pendingInit = false;
    const init = () => {
      pendingInit = false;
      if (ready || !visible) return;
      ready = true;
      resize();
      window.addEventListener('resize', resize, { passive: true });
      if (reduce) frame(1.5); else start();
    };
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (!ready) {
        if (visible && !pendingInit) {
          pendingInit = true;
          if (ric) ric(init, { timeout: 400 }); else window.setTimeout(init, 60);
        }
        return;
      }
      if (reduce) return;
      if (visible) start(); else stop();
    }, { threshold: 0, rootMargin: '300px 0px' });
    io.observe(canvas);

    return () => { ready = true; stop(); window.removeEventListener('resize', resize); io.disconnect(); };
  }, [variant]);

  return (
    <>
      <canvas ref={ref} className={`ambient-bg ${className || ''}`} aria-hidden />
      <div className="ambient-mask" aria-hidden />
    </>
  );
}
