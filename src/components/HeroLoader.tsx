/**
 * Placeholder shown while the 3D chunk is in flight.
 *
 * Deliberately zero-dependency and pure CSS: it has to render from the initial
 * bundle, so pulling in an animation library here would defeat the point of
 * lazy-loading the scene in the first place.
 */
export default function HeroLoader() {
  return (
    <div className="hero-loader" role="status" aria-live="polite">
      <div className="hero-loader__ring" aria-hidden />
      <span className="hero-loader__label">Preparing the site</span>
      <span className="sr-only">Loading the 3D construction scene</span>
    </div>
  );
}
