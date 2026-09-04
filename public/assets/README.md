# Hero video (opt-in)

`timelapse.mp4` is **not in the repo**. Drop it here and open the site with
`?video` to use the scrubbed-video hero instead of the 3D scene.

Without the file, `?video` falls back to the normal 3D hero — the element's
`error` event trips and the mode reverts. So the flag is safe on a URL today.

## What the file should be

- **H.264 MP4**, `-movflags +faststart` so the header is at the front.
- **Dense keyframes.** This is the one that matters: scrubbing seeks constantly,
  and a seek can only land on a keyframe. A normal 2-second GOP makes scrubbing
  feel notchy. Encode with a keyframe every 5–10 frames:
  `ffmpeg -i src.mov -c:v libx264 -crf 22 -g 6 -keyint_min 6 -sc_threshold 0 \
     -pix_fmt yuv420p -movflags +faststart -an public/assets/timelapse.mp4`
- **No audio** (`-an`) — it is never played, and the track is dead weight.
- **~1600px wide** is plenty; the hero is letterboxed and cover-fit.
- Keep it under ~8 MB if you can. Dense keyframes inflate the file, so trade
  resolution for keyframe density rather than the other way round.

A phone-sized second encode is worth adding later if the desktop file is heavy;
the loader would pick it the same way `HERO_FRAMES_SMALL` does.
