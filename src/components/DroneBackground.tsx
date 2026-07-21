import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isCapture } from '../lib/capture';

gsap.registerPlugin(ScrollTrigger);

export default function DroneBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Pause the video initially so GSAP can control its progress
    video.pause();

    const onMeta = () => {
      const duration = video.duration || 1; // Fallback to 1s to prevent errors if duration is 0
      
      // Clear previous triggers if re-running
      ScrollTrigger.getAll().forEach((t) => t.kill());

      // Wire video playback to frame-accurate scroll scrubbing
      gsap.to(video, {
        currentTime: duration,
        ease: 'none',
        scrollTrigger: {
          trigger: document.documentElement,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1, // Smooth scrubbing (1 second lag)
        }
      });
    };

    video.addEventListener('loadedmetadata', onMeta);
    if (video.readyState >= 1) {
      onMeta();
    }

    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  if (isCapture()) return null;

  return (
    <div className="fixed inset-0 z-[-1] w-full h-full pointer-events-none bg-[#0D1117]" aria-hidden>
      {/* 1. Background Video Setup */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover z-0"
        src="/videos/drone.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      {/* 2. Deep charcoal overlay so structures + crimson accents stay crisp */}
      <div className="absolute inset-0 z-0 bg-black/70 backdrop-blur-sm" />
    </div>
  );
}
