import { useEffect, useRef } from 'react';

/**
 * Deep-purple particle-network background (#201025 → near-black).
 * A field of drifting nodes joined by fading links when they come close —
 * the cinematic backdrop that sits UNDER the intro villa, the hero line-art
 * building and all foreground copy. Pauses when off-screen (IntersectionObserver)
 * and honours reduced-motion by painting a single static frame.
 */
export default function ParticleNetwork({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, raf = 0, visible = true;

    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    let nodes: Node[] = [];

    const seed = (n: number): Node[] =>
      Array.from({ length: n }, (_, i) => {
        // deterministic spread so positions stay stable across resizes
        const a = Math.sin(i * 12.9898) * 43758.5453;
        const b = Math.sin(i * 78.233) * 43758.5453;
        const rx = a - Math.floor(a);
        const ry = b - Math.floor(b);
        return {
          x: rx * W,
          y: ry * H,
          vx: (rx - 0.5) * 0.22,
          vy: (ry - 0.5) * 0.22,
          r: 0.8 + ry * 1.6,
        };
      });

    const resize = () => {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const density = Math.round((W * H) / 16000);
      const count = Math.max(46, Math.min(120, density));
      nodes = seed(count);
    };

    const paintBg = () => {
      // deep-purple vertical wash + a soft radial core glow
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#201025');
      g.addColorStop(0.55, '#160a1c');
      g.addColorStop(1, '#08040c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      const rg = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.6);
      rg.addColorStop(0, 'rgba(96, 42, 120, 0.28)');
      rg.addColorStop(1, 'rgba(96, 42, 120, 0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    };

    const LINK = 132;      // link radius
    const frame = () => {
      paintBg();

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
      }

      // links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const a = (1 - Math.sqrt(d2) / LINK) * 0.5;
            ctx.strokeStyle = `rgba(178, 130, 214, ${a})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        ctx.fillStyle = 'rgba(214, 180, 240, 0.85)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      if (visible) frame();
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(canvas);

    if (reduce) { frame(); } else { raf = requestAnimationFrame(loop); }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      io.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
