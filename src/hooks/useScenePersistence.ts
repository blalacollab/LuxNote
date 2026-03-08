import { useEffect } from 'react';

import { SAVE_DEBOUNCE_MS } from '../lib/constants';
import {
  loadScene,
  saveScene,
  writeSceneToLocalStorage,
} from '../lib/persistence';
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
    const flushSnapshot = () => {
      const state = useCanvasStore.getState();

      if (!state.isHydrated) {
        return;
      }

      try {
        writeSceneToLocalStorage(buildSnapshot(state));
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSnapshot();
      }
    };

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

    window.addEventListener('pagehide', flushSnapshot);
    window.addEventListener('beforeunload', flushSnapshot);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', flushSnapshot);
      window.removeEventListener('beforeunload', flushSnapshot);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
