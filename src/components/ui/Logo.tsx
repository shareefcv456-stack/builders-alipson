/**
 * Alipson mark — a single sharp crimson glyph fusing the four brand concepts:
 * the apex reads as an upward Arrow / Rocket nose and a Roof; the two legs +
 * crossbar form the letter "A". White inner core = the rocket taking off.
 */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block' }} aria-hidden>
      <defs>
        <linearGradient id="lg-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8615b" />
          <stop offset="0.5" stopColor="#d32f2f" />
          <stop offset="1" stopColor="#9a0007" />
        </linearGradient>
      </defs>
      {/* A silhouette = roof + upward arrow */}
      <path d="M50 8 L92 90 L71 90 L50 48 L29 90 L8 90 Z" fill="url(#lg-brand)" />
      {/* A crossbar */}
      <path d="M36 68 L64 68 L59.5 58 L40.5 58 Z" fill="url(#lg-brand)" />
      {/* rocket / arrow core taking off */}
      <path d="M50 25 L59 60 L50 52 L41 60 Z" fill="#f8f8f6" />
    </svg>
  );
}

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <LogoMark size={compact ? 30 : 36} />
      <span className="logo-text">
        <span className="logo-name">ALIPSON</span>
        <span className="logo-sub">B U I L D E R S</span>
      </span>
    </span>
  );
}
