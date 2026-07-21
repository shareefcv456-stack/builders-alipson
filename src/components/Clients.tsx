import { CLIENTS } from '../data/site';

export default function Clients() {
  const loop = [...CLIENTS, ...CLIENTS];
  return (
    <div className="section--tight" style={{ paddingBottom: 0 }}>
      <div className="container" style={{ marginBottom: '1.5rem' }}>
        <span className="eyebrow eyebrow--center" style={{ width: '100%', justifyContent: 'center' }}>
          Trusted collaborators
        </span>
      </div>
      <div className="marquee marquee--rev">
        <div className="marquee__track">
          {loop.map((c, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 300,
                fontSize: 'clamp(1.4rem, 2.6vw, 2rem)',
                letterSpacing: '0.01em',
                color: 'rgba(248,248,246,0.78)',
                whiteSpace: 'nowrap',
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
