import { useEffect } from 'react';

import { useCanvasStore } from '../store/canvasStore';

export function useAnimationLoop(): void {
  useEffect(() => {
    let frameId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(now - last, 32);
      last = now;
      useCanvasStore.getState().stepAnimations(dt);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frameId);
  }, []);
}
