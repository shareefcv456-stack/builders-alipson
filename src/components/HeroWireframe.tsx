import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

/**
 * The drawn half of the construction timeline: an architect's drawing of ONE
 * building that assembles itself as you scroll, over the photographic sequence
 * that is running in step behind it.
 *
 * The geometry is authored here rather than rendered, which is precisely why the
 * camera is locked — there is no camera to drift.
 *
 * `draw(t, alpha)` takes t in 0..1 across the DRAWING's own life (StoryScroll
 * maps scroll onto it). Inside that:
 *
 *   t 0     → P1_T   phase 1 — excavation pit, footprint, glowing red floor-plan
 *                              grid, animated laser dimensions
 *   t P1_T  → P2_T   phase 2 — pad footings, rebar cages, concrete pillars rise
 *   t P2_T  → 1      phase 3 — floor slabs layer upward, curtain-wall frames,
 *                              roof, entrance, context
 *
 * Phases 4 and 5 (facade, interior lighting, landscaping, reveal) are carried by
 * the photography, which by then has scrubbed to its own matching frames — the
 * drawing has dissolved before they start.
 *
 * Segments carry a `from`/`to` window, so build order is data, not code.
 */
export type WireHandle = { draw: (t: number, alpha: number) => void };

const VW = 1600, VH = 900;
const LEVELS = 5, FH = 66;
/** Ground line. Everything sits above it, clear of the headline block below. */
const GY = 544;

/* Phase boundaries in the drawing's own t-space. StoryScroll derives its
   scroll-space boundaries from these, so the two files cannot drift apart.
   The odd-looking thirteenths are deliberate: the drawing occupies scroll
   0.08→0.60, and these are exactly the t values that put the phase edges on the
   spec's 20% and 40% marks. Change one and StoryScroll follows automatically. */
export const P1_T = 3 / 13;   // → 20% scroll: excavation & plan complete
export const P2_T = 8 / 13;   // → 40% scroll: pillars topped out
/** Grid divisions across the plot, each way. */
const GRID = 5;

/* Base plan, in view units. N is the near corner facing the viewer. */
const L = { x: 400, y: 486 };   // far left
const N = { x: 800, y: 520 };   // near corner
const R = { x: 1230, y: 480 };  // far right
const B = { x: L.x + (R.x - N.x), y: L.y - (N.y - R.y) };  // back corner
const TOP = LEVELS * FH;

type Pt = { x: number; y: number };
type Seg = {
  d: string; from: number; to: number;
  accent?: boolean; thin?: boolean;
  /** Sits in the blurred group — the phase-1 plan guides only. */
  glow?: boolean;
  /** Closed quad that fills in as its outline completes: a poured slab. */
  slab?: boolean;
};

const line = (a: number, b: number, c: number, d: number) =>
  `M${a.toFixed(1)} ${b.toFixed(1)} L${c.toFixed(1)} ${d.toFixed(1)}`;
const seg = (a: Pt, b: Pt) => line(a.x, a.y, b.x, b.y);
/** Point t (0..1) along an edge, lifted by `up`. */
const on = (a: Pt, b: Pt, t: number, up = 0): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t - up,
});
const shift = (p: Pt, dx: number, dy: number): Pt => ({ x: p.x + dx, y: p.y + dy });
/** The building's footprint as a closed path, lifted to a floor level. */
const quad = (up: number) =>
  [L, N, R, B].map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${(p.y - up).toFixed(1)}`).join(' ') + ' Z';

/**
 * An architectural dimension line along edge a→b, offset by (ox, oy): witness
 * lines out from each end, the measure line between them, and a slash tick at
 * each end. Drawn in that order so it reads as being *measured*, not stamped.
 */
function dimension(a: Pt, b: Pt, ox: number, oy: number, from: number, to: number): Seg[] {
  const a2 = shift(a, ox, oy), b2 = shift(b, ox, oy);
  const step = (to - from) / 4;
  const tick = (p: Pt): string => line(p.x - 7, p.y + 7, p.x + 7, p.y - 7);
  return [
    { d: seg(a, a2), from, to: from + step * 1.4, accent: true, thin: true, glow: true },
    { d: seg(b, b2), from: from + step * 0.3, to: from + step * 1.7, accent: true, thin: true, glow: true },
    { d: seg(a2, b2), from: from + step * 1.2, to: from + step * 3.4, accent: true, glow: true },
    { d: tick(a2), from: from + step * 3, to, accent: true, thin: true, glow: true },
    { d: tick(b2), from: from + step * 3.2, to, accent: true, thin: true, glow: true },
  ];
}

function buildSegments(): Seg[] {
  const s: Seg[] = [];

  /* ---- PHASE 1 · excavation, plan, laser dimensions --------------------- */

  // Site datum: the ground the building will stand on.
  s.push({ d: line(110, GY, 1490, GY), from: 0, to: 0.03, accent: true });
  for (let i = 0; i <= 5; i++) {
    const x = 200 + i * 240;
    s.push({ d: line(x, GY, x - 14, GY + 14), from: 0.01, to: 0.05, accent: true, thin: true });
  }

  // Excavation: the pit floor, dropped below the plan, with its corner faces.
  // Drawn before the footprint — you dig before you set out.
  const DIG = 26;
  s.push({ d: quad(-DIG), from: 0.04, to: 0.1, thin: true });
  [L, N, R, B].forEach((p, i) =>
    s.push({ d: line(p.x, p.y, p.x, p.y + DIG), from: 0.05 + i * 0.008, to: 0.11, thin: true })
  );

  // Footprint — the plan outline. Stays for the whole build.
  ([[L, N], [N, R], [R, B], [B, L]] as const).forEach(([a, b], i) =>
    s.push({ d: seg(a, b), from: 0.06 + i * 0.008, to: 0.12, accent: true })
  );

  // Floor-plan grid across the plot, both directions.
  for (let i = 1; i < GRID; i++) {
    const u = i / GRID;
    s.push({ d: seg(on(L, N, u), on(B, R, u)), from: 0.1 + i * 0.008, to: 0.19, accent: true, thin: true, glow: true });
    s.push({ d: seg(on(N, R, u), on(L, B, u)), from: 0.12 + i * 0.008, to: 0.19, accent: true, thin: true, glow: true });
  }

  // Laser dimensions on the two near edges — the last beat of phase 1.
  s.push(...dimension(L, N, -30, 34, 0.14, P1_T));
  s.push(...dimension(N, R, 26, 34, 0.17, P1_T));

  /* ---- PHASE 2 · footings, rebar, concrete pillars ---------------------- */

  // Column positions: five along the near-left edge, four along the near-right.
  const cols: Pt[] = [];
  for (let i = 0; i <= 4; i++) cols.push(on(L, N, i / 4));
  for (let i = 1; i <= 4; i++) cols.push(on(N, R, i / 4));

  // Pad footings — a small plan square under each column.
  cols.forEach((p, i) => {
    const w = 17, h = 7;
    s.push({
      d: `M${(p.x - w).toFixed(1)} ${p.y.toFixed(1)} L${p.x.toFixed(1)} ${(p.y - h).toFixed(1)} L${(p.x + w).toFixed(1)} ${p.y.toFixed(1)} L${p.x.toFixed(1)} ${(p.y + h).toFixed(1)} Z`,
      from: 0.24 + i * 0.004, to: 0.31, thin: true,
    });
  });

  // Rebar cages on the near-left row: paired strands plus horizontal ties. They
  // stop short of full height, so the concrete that follows reads as being
  // poured up around steel that is already standing.
  const REBAR = TOP * 0.46;
  cols.slice(0, 5).forEach((p, i) => {
    const t0 = 0.27 + i * 0.012;
    [-6, 6].forEach((dx, k) =>
      s.push({ d: line(p.x + dx, p.y, p.x + dx, p.y - REBAR), from: t0 + k * 0.01, to: t0 + 0.13, thin: true })
    );
    for (let k = 1; k <= 3; k++) {
      const y = p.y - (REBAR * k) / 3.4;
      s.push({ d: line(p.x - 7, y, p.x + 7, y), from: t0 + 0.04 + k * 0.012, to: t0 + 0.15, thin: true });
    }
  });

  // Concrete pillars. Each path starts at its base and runs upward, so the dash
  // reveal IS the pillar rising — no separate transform needed.
  cols.forEach((p, i) =>
    s.push({ d: line(p.x, p.y, p.x, p.y - TOP), from: 0.35 + i * 0.012, to: P2_T + 0.02 })
  );

  /* ---- PHASE 3 · slabs and curtain-wall framework ----------------------- */

  // Floor slabs, poured level by level: the outline draws, then the deck fills.
  for (let k = 1; k <= LEVELS; k++) {
    const t = 0.62 + ((k - 1) / LEVELS) * 0.2;
    s.push({ d: quad(k * FH), from: t, to: t + 0.14, slab: true });
  }

  // Curtain-wall frames: full-height mullions. The slab edges already supply the
  // horizontals, so the grid reads without 80 one-pixel segments.
  for (let i = 1; i <= 3; i++) {
    s.push({ d: seg(on(L, N, i / 4), on(L, N, i / 4, TOP)), from: 0.74 + i * 0.02, to: 0.95, thin: true });
    s.push({ d: seg(on(N, R, i / 4), on(N, R, i / 4, TOP)), from: 0.76 + i * 0.02, to: 0.96, thin: true });
  }

  // Roof plane closes the volume.
  ([[L, N], [N, R], [R, B], [B, L]] as const).forEach(([a, b], i) =>
    s.push({ d: seg(on(a, a, 0, TOP), on(b, b, 0, TOP)), from: 0.85 + i * 0.015, to: 0.97 })
  );

  // Entrance canopy and steps at the near corner.
  const e0 = on(N, R, 0.1), e1 = on(N, R, 0.42);
  s.push({ d: line(e0.x, e0.y - 78, e1.x, e1.y - 78), from: 0.9, to: 0.99, accent: true });
  s.push({ d: line(e0.x, e0.y - 78, e0.x, e0.y), from: 0.91, to: 1, accent: true });
  s.push({ d: line(e1.x, e1.y - 78, e1.x, e1.y), from: 0.91, to: 1, accent: true });
  for (let i = 1; i <= 3; i++) {
    s.push({ d: line(e0.x - i * 9, e0.y + i * 7, e1.x + i * 9, e1.y + i * 7), from: 0.93, to: 1, thin: true });
  }

  // Context: a tree and a distant skyline, for scale.
  s.push({ d: line(250, GY, 250, GY - 84), from: 0.92, to: 1, thin: true });
  s.push({ d: `M250 ${GY - 84} m-30 0 a30 30 0 1 0 60 0 a30 30 0 1 0 -60 0`, from: 0.94, to: 1, thin: true });
  [1330, 1372, 1414].forEach((x, i) => {
    s.push({ d: line(x, GY, x, GY - (104 + i * 40)), from: 0.94, to: 1, thin: true });
  });

  return s;
}

/* A segment whose window is inverted, out of range, or on the wrong side of a
   phase edge silently never draws — it just quietly goes missing from the
   building. One mistyped number is all it takes, so fail loudly in dev. */
if (import.meta.env.DEV) {
  buildSegments().forEach((s, i) => {
    const bad =
      s.from >= s.to ? 'from >= to' :
      s.from < 0 || s.to > 1.0001 ? 'window outside 0..1' :
      // Phase 1 draws the plot and must be finished by P1_T; nothing else may
      // start before it, or the structure rises out of an unsurveyed plot.
      s.glow && s.to > P1_T + 1e-6 ? 'phase-1 guide outruns its phase' :
      !s.glow && s.from > 0 && s.from < P1_T && s.to > P1_T + 1e-6 ? 'segment straddles the phase 1/2 edge' :
      '';
    if (bad) console.error(`[HeroWireframe] seg ${i} (${s.from}→${s.to}): ${bad}`);
  });
}

const HeroWireframe = forwardRef<WireHandle, { className?: string }>(function HeroWireframe({ className }, ref) {
  const segs = useMemo(buildSegments, []);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const lens = useRef<number[]>([]);
  const prev = useRef<number[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const glowG = useRef<SVGGElement>(null);
  const last = useRef(-1);

  useEffect(() => {
    lens.current = paths.current.map((p) => (p ? p.getTotalLength() : 0));
    prev.current = segs.map(() => -1);
  }, [segs]);

  useImperativeHandle(ref, () => ({
    draw(t, alpha) {
      const el = svg.current;
      if (!el) return;
      el.style.opacity = String(alpha);
      if (alpha <= 0.001) { el.style.visibility = 'hidden'; return; }
      el.style.visibility = 'visible';
      if (Math.abs(t - last.current) < 0.0015) return;   // nothing new to draw
      last.current = t;

      // The plan guides hand over to the structure: grid and dimensions fade
      // just after phase 1, and once invisible the group is dropped so its blur
      // stops costing a filter pass for the rest of the scroll.
      const g = glowG.current;
      if (g) {
        const o = 1 - Math.max(0, Math.min(1, (t - P1_T) / 0.2));
        g.style.display = o <= 0.001 ? 'none' : '';
        g.style.opacity = String(o);
      }

      paths.current.forEach((p, i) => {
        if (!p) return;
        const { from, to, slab } = segs[i];
        const local = to === from ? 1 : Math.max(0, Math.min(1, (t - from) / (to - from)));
        // Only ~10 of the ~140 segments are mid-draw at any moment; the rest are
        // pinned at 0 or 1. Skipping them keeps the per-frame style writes flat
        // no matter how much geometry the drawing grows to.
        if (Math.abs(local - prev.current[i]) < 0.001) return;
        prev.current[i] = local;
        const len = lens.current[i] || 0;
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len * (1 - local)}`;
        // Squared, so the deck only reads as poured once its formwork is closed.
        if (slab) p.style.fillOpacity = `${local * local * 0.16}`;
      });
    },
  }), [segs]);

  const path = (s: Seg, i: number) => (
    <path
      key={i}
      ref={(el) => { paths.current[i] = el; }}
      d={s.d}
      fill={s.slab ? '#93a3b8' : 'none'}
      stroke={s.accent ? 'var(--accent)' : '#e7ecf2'}
      strokeOpacity={s.thin ? 0.34 : s.accent ? 0.9 : 0.66}
      strokeWidth={s.thin ? 1 : s.accent ? 1.8 : 1.4}
      strokeLinecap="round"
      style={{ strokeDasharray: 1, strokeDashoffset: 1, fillOpacity: 0 }}
    />
  );

  return (
    <svg
      ref={svg}
      className={className}
      viewBox={`0 0 ${VW} ${VH}`}
      /* `meet`, not `slice` — a cropped wireframe reads as abstract lines
         rather than a building on narrow screens. */
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <filter id="wireGlow" x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g ref={glowG} filter="url(#wireGlow)">
        {segs.map((s, i) => (s.glow ? path(s, i) : null))}
      </g>
      {segs.map((s, i) => (s.glow ? null : path(s, i)))}
    </svg>
  );
});

export default HeroWireframe;
