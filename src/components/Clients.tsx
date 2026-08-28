import { CLIENTS } from '../data/site';

/* ponytail: MONOGRAM MARKS, NOT LOGOS. These are real companies, so shipping a
   hand-drawn approximation of their wordmarks would be passing off artwork as
   their brand. Each entry gets a neutral initial monogram instead — it reads as
   a logo strip and is honest about being a placeholder. Drop real, licensed
   SVGs in here (swap `<Monogram>` for an `<img src>`) when they exist. */
function Monogram({ name }: { name: string }) {
  const initial = name.trim()[0].toUpperCase();
  return (
    <svg className="collab__mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="38" height="38" rx="11" />
      <text x="20" y="20" dominantBaseline="central" textAnchor="middle">{initial}</text>
    </svg>
  );
}

/* The track holds the list TWICE — the `marquee` keyframe translates it -50%,
   so one loop is exactly one copy. Keep the duplication and the keyframe in
   sync (see `@keyframes marquee` in index.css). */
export default function Clients() {
  const loop = [...CLIENTS, ...CLIENTS];
  return (
    <div className="collab">
      <div className="container collab__head">
        <span className="eyebrow eyebrow--center" style={{ width: '100%', justifyContent: 'center' }}>
          Trusted collaborators
        </span>
      </div>
      <div className="marquee">
        <div className="marquee__track">
          {loop.map((c, i) => (
            <span className="collab__item" key={i} aria-hidden={i >= CLIENTS.length}>
              <Monogram name={c} />
              <span className="collab__name">{c}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
