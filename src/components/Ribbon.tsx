import { STATS, type Stat } from '../data/site';
import { useCountUp } from '../hooks/useCountUp';

function Cell({ stat }: { stat: Stat }) {
  const { value, ref } = useCountUp(stat.value);
  return (
    <div className="ribbon__cell">
      <div className="ribbon__num">
        <span ref={ref}>{value.toLocaleString()}</span>
        <em>{stat.suffix}</em>
      </div>
      <div className="ribbon__label">{stat.label}</div>
    </div>
  );
}

export default function Ribbon() {
  return (
    <section className="ribbon">
      <div className="ribbon__grid container" style={{ paddingInline: 0 }}>
        {STATS.map((s) => (
          <Cell key={s.label} stat={s} />
        ))}
      </div>
    </section>
  );
}
