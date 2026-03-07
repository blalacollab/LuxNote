import { useEffect } from 'react';

import { SAVE_DEBOUNCE_MS } from '../lib/constants';
import { loadScene, saveScene } from '../lib/persistence';
import { buildSnapshot, useCanvasStore } from '../store/canvasStore';

export function useScenePersistence(): void {
  const hydrate = useCanvasStore((state) => state.hydrate);

  useEffect(() => {
    let cancelled = false;

    void loadScene()
      .then((scene) => {
        if (!cancelled) {
          hydrate(scene);
        }
      })
      .catch(() => {
        if (!cancelled) {
          hydrate(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  useEffect(() => {
    let timer = 0;
    const setSaveStatus = useCanvasStore.getState().setSaveStatus;

    const unsubscribe = useCanvasStore.subscribe(
      (state) =>
        state.isHydrated ? JSON.stringify(buildSnapshot(state)) : null,
      (serialized) => {
        if (!serialized) {
          return;
        }

        setSaveStatus('saving');
        window.clearTimeout(timer);
        timer = window.setTimeout(async () => {
          try {
            await saveScene(JSON.parse(serialized));
            useCanvasStore.getState().setSaveStatus('saved');
          } catch {
            useCanvasStore.getState().setSaveStatus('error');
          }
        }, SAVE_DEBOUNCE_MS);
      },
    );

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);
}
