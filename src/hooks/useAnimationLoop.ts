import { useEffect } from 'react';

import { useCanvasStore } from '../store/canvasStore';

export function useAnimationLoop(): void {
  useEffect(() => {
    let frameId: number | null = null;
    let running = false;
    let last = 0;

    const hasActiveAnimations = () => {
      const state = useCanvasStore.getState();
      return (
        state.zoomAnimation !== null || Object.keys(state.noteMotions).length > 0
      );
    };

    const stopLoop = () => {
      running = false;

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const loop = (now: number) => {
      frameId = null;
      const dt = Math.min(now - last, 32);
      last = now;
      useCanvasStore.getState().stepAnimations(dt);

      if (hasActiveAnimations()) {
        frameId = requestAnimationFrame(loop);
        return;
      }

      running = false;
    };

    const startLoop = () => {
      if (running) {
        return;
      }

      running = true;
      last = performance.now();
      frameId = requestAnimationFrame(loop);
    };

    const unsubscribeNoteMotion = useCanvasStore.subscribe(
      (state) => state.noteMotions,
      () => {
        if (hasActiveAnimations()) {
          startLoop();
        }
      },
    );
    const unsubscribeZoomAnimation = useCanvasStore.subscribe(
      (state) => state.zoomAnimation,
      () => {
        if (hasActiveAnimations()) {
          startLoop();
        }
      },
    );

    if (hasActiveAnimations()) {
      startLoop();
    }

    return () => {
      unsubscribeNoteMotion();
      unsubscribeZoomAnimation();
      stopLoop();
    };
  }, []);
}
