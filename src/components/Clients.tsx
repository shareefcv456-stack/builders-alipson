import { CLIENTS } from '../data/site';

export default function Clients() {
  const loop = [...CLIENTS, ...CLIENTS];
  return (
    <div className="section--tight" style={{ paddingBottom: 'clamp(2.5rem, 6vw, 4.5rem)' }}>
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
                /* Was rgba(248,248,246,0.78) — near-white on the white page,
                   i.e. invisible. Solid deep slate: 16.9:1 on white, AAA. */
                color: '#0F172A',
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
