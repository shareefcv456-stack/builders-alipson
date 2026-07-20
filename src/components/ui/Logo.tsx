export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block' }} aria-hidden>
      <defs>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4dd8f" />
          <stop offset="0.5" stopColor="#d4af37" />
          <stop offset="1" stopColor="#a8842a" />
        </linearGradient>
      </defs>
      <path d="M50,14 L18,82 L37,82 L50,50 L63,82 L82,82 Z" fill="url(#lg-gold)" />
      <path d="M50,50 L59,67 L50,84 L41,67 Z" fill="#fff6dd" />
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
