import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isCapture } from '../lib/capture';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-scrubbed drone plate behind the whole page.
 *
 * OFF BY DEFAULT. `SRC` is empty because no such file ships — pointing a
 * <video> at a missing path cost a 404 on every single page load and, because
 * `autoPlay` overrides `preload="none"`, the browser went and asked for it
 * eagerly. Drop a file in `public/videos/` and set SRC to switch it back on.
 */
const SRC = '';

export default function DroneBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    /* Held so the cleanup can kill THIS trigger and nothing else. The old code
       called `ScrollTrigger.getAll().forEach(t => t.kill())`, which took the
       hero's pin down with it — every trigger on the page, not just its own. */
    let tween: gsap.core.Tween | null = null;

    const onMeta = () => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
      tween = gsap.to(video, {
        currentTime: video.duration || 1,
        ease: 'none',
        scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 1 },
      });
    };

    video.addEventListener('loadedmetadata', onMeta);
    if (video.readyState >= 1) onMeta();

    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      tween?.scrollTrigger?.kill();
      tween?.kill();
    };
  }, []);

  if (isCapture()) return null;

  return (
    <div className="fixed inset-0 z-[-1] w-full h-full pointer-events-none bg-[#0D1117]" aria-hidden>
      {SRC && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-0"
          src={SRC}
          autoPlay loop muted playsInline preload="none"
        />
      )}
      {/* Flat charcoal veil. This used to carry `backdrop-blur-sm`: a FIXED,
          full-viewport backdrop-filter forces the compositor to re-read
          everything behind it on every frame of every scroll, for the entire
          length of the page — and at z-[-1], behind opaque sections, it had
          nothing visible to blur in the first place. */}
      <div className="absolute inset-0 z-0 bg-black/70" />
    </div>
  );
}
