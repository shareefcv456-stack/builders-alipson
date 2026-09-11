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
 *   /brand/alipson-logo.webp   355 × 144   full lockup (mark + wordmark)
 *   /brand/alipson-mark.webp    92 × 144   mark alone
 *
 * WEBP, AND SMALLER THAN THE ARTWORK. These shipped as the supplied 831×337 and
 * 216×337 PNGs — 36 KB between them, both above the fold (the navbar lockup and
 * the hero gate's mark), for slots that render at 34-72 CSS px. The largest use
 * anywhere on the page is the footer lockup at 72px tall, so 144px of source is
 * exactly 2x the worst case; everything above that was download the browser
 * threw away when it scaled the image down. No srcset: one file serves the
 * navbar, the mobile menu and the footer, so a second candidate would only
 * change which of them pays — and flat brand art at 2x is indistinguishable
 * from 3x anyway.
 *
 * The artwork is flat brand art, not a photograph — 922 distinct colours, all
 * of them flat fills and their anti-aliasing. So it is stored as a 256-entry
 * palette in a LOSSLESS WebP rather than a lossy one: no generational blur on
 * the wordmark's edges, mean per-channel error against the original of
 * 0.32/255, and roughly a third of the PNG's bytes. Nothing is redrawn,
 * recoloured or reproportioned; the ratio is the original's to four decimals.
 *
 * DO NOT DELETE THE PNGs. They stay in public/brand/ as the master artwork, and
 * `lib/procTex.ts` still loads the full-resolution lockup as the texture for the
 * site signage in the 3D hero — that one wants every pixel, and it is behind the
 * lazy three.js chunk, so it is not on anybody's critical path.
 * Regenerate these two with Pillow: resize to height 144 (LANCZOS),
 * quantize(256, FASTOCTREE), save as WEBP lossless.
 *
 * Source of truth: public/images/image.png, left in place untouched.
 */
const LOCKUP = '/brand/alipson-logo.webp';
const MARK = '/brand/alipson-mark.webp';

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
