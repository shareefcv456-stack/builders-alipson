import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

/**
 * The opening beat: an architect's drawing of ONE building that draws itself on
 * as you scroll, then dissolves into the photographic sequence behind it.
 *
 * The geometry is authored here rather than rendered, which is precisely why the
 * camera is locked — there is no camera to drift. A single 3/4 view of one
 * rectangular block: footprint, columns, slabs, roof plane, glazing grid,
 * entrance. Segments carry a `from`/`to` window so the drawing assembles in
 * build order (ground → structure → skin) instead of all at once.
 */
export type WireHandle = { draw: (t: number, alpha: number) => void };

const VW = 1600, VH = 900;
const LEVELS = 5, FH = 66;
/** Ground line. Everything sits above it, clear of the headline block below. */
const GY = 544;

/* Base plan, in view units. N is the near corner facing the viewer. */
const L = { x: 400, y: 486 };   // far left
const N = { x: 800, y: 520 };   // near corner
const R = { x: 1230, y: 480 };  // far right
const B = { x: L.x + (R.x - N.x), y: L.y - (N.y - R.y) };  // back corner
const TOP = LEVELS * FH;

type Seg = { d: string; from: number; to: number; accent?: boolean; thin?: boolean };

const line = (x1: number, y1: number, x2: number, y2: number) =>
  `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
/** Point t (0..1) along an edge, lifted by `up`. */
const on = (a: { x: number; y: number }, b: { x: number; y: number }, t: number, up = 0) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t - up,
});

function buildSegments(): Seg[] {
  const s: Seg[] = [];

  // 1 — site datum: the ground the building will stand on.
  s.push({ d: line(110, GY, 1490, GY), from: 0, to: 0.07, accent: true });
  for (let i = 0; i <= 5; i++) {
    const x = 200 + i * 240;
    s.push({ d: line(x, GY, x - 14, GY + 14), from: 0.02, to: 0.1, accent: true, thin: true });
  }

  // 2 — footprint.
  ([[L, N], [N, R], [R, B], [B, L]] as const).forEach(([a, b], i) =>
    s.push({ d: line(a.x, a.y, b.x, b.y), from: 0.06 + i * 0.015, to: 0.2, accent: true })
  );

  // 3 — columns rising off the footprint.
  for (let i = 0; i <= 4; i++) {
    const p = on(L, N, i / 4);
    s.push({ d: line(p.x, p.y, p.x, p.y - TOP), from: 0.17 + i * 0.014, to: 0.46 });
  }
  for (let i = 1; i <= 4; i++) {
    const p = on(N, R, i / 4);
    s.push({ d: line(p.x, p.y, p.x, p.y - TOP), from: 0.19 + i * 0.014, to: 0.48 });
  }

  // 4 — floor slabs, level by level.
  for (let k = 1; k <= LEVELS; k++) {
    const up = k * FH;
    const t = 0.3 + (k / LEVELS) * 0.22;
    s.push({ d: line(L.x, L.y - up, N.x, N.y - up), from: t, to: t + 0.14 });
    s.push({ d: line(N.x, N.y - up, R.x, R.y - up), from: t + 0.02, to: t + 0.16 });
  }

  // 5 — roof plane closes the volume.
  ([[L, N], [N, R], [R, B], [B, L]] as const).forEach(([a, b], i) =>
    s.push({ d: line(a.x, a.y - TOP, b.x, b.y - TOP), from: 0.56 + i * 0.02, to: 0.76 })
  );

  // 6 — glazing mullions: full-height, not per-pane. The floor lines already
  // supply the horizontals, so the grid reads without 80 one-pixel segments.
  for (let i = 1; i <= 3; i++) {
    const a = on(L, N, i / 4);
    s.push({ d: line(a.x, a.y, a.x, a.y - TOP), from: 0.64 + i * 0.02, to: 0.9, thin: true });
    const b = on(N, R, i / 4);
    s.push({ d: line(b.x, b.y, b.x, b.y - TOP), from: 0.66 + i * 0.02, to: 0.92, thin: true });
  }

  // 7 — entrance canopy and steps at the near corner.
  const e0 = on(N, R, 0.1), e1 = on(N, R, 0.42);
  s.push({ d: line(e0.x, e0.y - 78, e1.x, e1.y - 78), from: 0.8, to: 0.95, accent: true });
  s.push({ d: line(e0.x, e0.y - 78, e0.x, e0.y), from: 0.82, to: 0.96, accent: true });
  s.push({ d: line(e1.x, e1.y - 78, e1.x, e1.y), from: 0.82, to: 0.96, accent: true });
  for (let i = 1; i <= 3; i++) {
    const a = on(N, R, 0.1), b = on(N, R, 0.42);
    s.push({ d: line(a.x - i * 9, a.y + i * 7, b.x + i * 9, b.y + i * 7), from: 0.86, to: 0.99, thin: true });
  }

  // 8 — context: a tree and a distant skyline, for scale.
  s.push({ d: line(250, GY, 250, GY - 84), from: 0.88, to: 1, thin: true });
  s.push({ d: `M250 ${GY - 84} m-30 0 a30 30 0 1 0 60 0 a30 30 0 1 0 -60 0`, from: 0.9, to: 1, thin: true });
  [1330, 1372, 1414].forEach((x, i) => {
    s.push({ d: line(x, GY, x, GY - (104 + i * 40)), from: 0.9, to: 1, thin: true });
  });

  return s;
}

const HeroWireframe = forwardRef<WireHandle, { className?: string }>(function HeroWireframe({ className }, ref) {
  const segs = useMemo(buildSegments, []);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const lens = useRef<number[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const last = useRef(-1);

  useEffect(() => {
    lens.current = paths.current.map((p) => (p ? p.getTotalLength() : 0));
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
      paths.current.forEach((p, i) => {
        if (!p) return;
        const { from, to } = segs[i];
        const local = to === from ? 1 : Math.max(0, Math.min(1, (t - from) / (to - from)));
        const len = lens.current[i] || 0;
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len * (1 - local)}`;
      });
    },
  }), [segs]);

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
      {segs.map((seg, i) => (
        <path
          key={i}
          ref={(el) => { paths.current[i] = el; }}
          d={seg.d}
          fill="none"
          stroke={seg.accent ? 'var(--accent)' : '#e7ecf2'}
          strokeOpacity={seg.thin ? 0.34 : seg.accent ? 0.9 : 0.66}
          strokeWidth={seg.thin ? 1 : seg.accent ? 1.8 : 1.4}
          strokeLinecap="round"
          style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
        />
      ))}
    </svg>
  );
});

export default HeroWireframe;
