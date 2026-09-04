/**
 * THE OFFICIAL ALIPSON BUILDERS MARK.
 *
 * Both files are the supplied artwork, unaltered — the only processing was
 * removing the opaque white canvas it shipped on (it has to be transparent to
 * sit on the dark footer, the dark navbar state and the hero's split gate) and
 * splitting the mark from the lockup for the square slots. Nothing is redrawn,
 * recoloured or reproportioned, and every use below sets HEIGHT ONLY with
 * `width: auto`, so the aspect ratio cannot be squashed by a container.
 *
 *   /brand/alipson-logo.png   831 × 337   full lockup (mark + wordmark)
 *   /brand/alipson-mark.png   216 × 337   mark alone
 *
 * Source of truth: public/images/image.png, left in place untouched.
 */
const LOCKUP = '/brand/alipson-logo.png';
const MARK = '/brand/alipson-mark.png';

/** Mark only — for square-ish slots: the hero's split gate and the intro. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <img
      src={MARK}
      alt=""
      aria-hidden
      width={Math.round(size * (216 / 337))}
      height={size}
      style={{ display: 'block', height: size, width: 'auto' }}
      decoding="async"
    />
  );
}

/** Full lockup. The wordmark is part of the artwork, so there is no separate
 *  text to typeset beside it any more. */
export default function Logo({ compact = false }: { compact?: boolean }) {
  /* The rendered height comes from CSS (`.logo-lockup`), not from an inline
     style, so the navbar and the footer can each size it for their own space —
     the footer has room to run it large enough for "BUILDERS PVT LTD" to be
     readable, the navbar does not. `width`/`height` here are the artwork's
     INTRINSIC pixels: they only supply the ratio, so the box is reserved before
     the file lands and the lockup can never be squashed. */
  return (
    <span className={`logo ${compact ? 'logo--compact' : ''}`}>
      <img
        className="logo-lockup"
        src={LOCKUP}
        alt="Alipson Builders Pvt Ltd"
        width={831}
        height={337}
        decoding="async"
      />
    </span>
  );
}
