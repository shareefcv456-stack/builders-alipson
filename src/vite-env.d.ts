/// <reference types="vite/client" />

/* n8ao ships JS only — no bundled types. Minimal surface: the post-process
   pass we actually construct, plus the config object we write to. */
declare module 'n8ao' {
  import type { Scene, Camera, Color } from 'three';
  import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
  export class N8AOPass extends Pass {
    constructor(scene: Scene, camera: Camera, width: number, height: number);
    configuration: {
      aoRadius: number;
      distanceFalloff: number;
      intensity: number;
      halfRes: boolean;
      screenSpaceRadius: boolean;
      denoiseIterations: number;
      color: Color;
      gammaCorrection: boolean;
    };
    setSize(w: number, h: number): void;
  }
}
