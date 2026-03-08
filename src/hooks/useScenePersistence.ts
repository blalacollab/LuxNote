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
  const isTestMode = import.meta.env.MODE === 'test';

  useEffect(() => {
    if (isTestMode) {
      return;
    }

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
  }, [hydrate, isTestMode]);

  useEffect(() => {
    if (isTestMode) {
      return;
    }

    let timer = 0;
    const markSaving = () => useCanvasStore.getState().setSaveStatus('saving');

    const scheduleSave = () => {
      const state = useCanvasStore.getState();

      if (!state.isHydrated) {
        return;
      }

      markSaving();
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const latestState = useCanvasStore.getState();

        if (!latestState.isHydrated) {
          return;
        }

        try {
          await saveScene(buildSnapshot(latestState));
          useCanvasStore.getState().setSaveStatus('saved');
        } catch {
          useCanvasStore.getState().setSaveStatus('error');
        }
      }, SAVE_DEBOUNCE_MS);
    };

    const flushSnapshot = () => {
      const state = useCanvasStore.getState();

      if (!state.isHydrated) {
        return;
      }

      try {
        writeSceneToLocalStorage(buildSnapshot(state));
        useCanvasStore.getState().setSaveStatus('saved');
      } catch {
        useCanvasStore.getState().setSaveStatus('error');
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSnapshot();
      }
    };

    const unsubscribeHydration = useCanvasStore.subscribe(
      (state) => state.isHydrated,
      (isHydrated) => {
        if (!isHydrated) {
          window.clearTimeout(timer);
          return;
        }

        scheduleSave();
      },
    );
    const unsubscribeCamera = useCanvasStore.subscribe(
      (state) => state.camera,
      scheduleSave,
    );
    const unsubscribeNotes = useCanvasStore.subscribe(
      (state) => state.notes,
      scheduleSave,
    );
    const unsubscribeConnections = useCanvasStore.subscribe(
      (state) => state.connections,
      scheduleSave,
    );
    const unsubscribePreferences = useCanvasStore.subscribe(
      (state) => state.preferences,
      scheduleSave,
    );

    window.addEventListener('pagehide', flushSnapshot);
    window.addEventListener('beforeunload', flushSnapshot);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeHydration();
      unsubscribeCamera();
      unsubscribeNotes();
      unsubscribeConnections();
      unsubscribePreferences();
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', flushSnapshot);
      window.removeEventListener('beforeunload', flushSnapshot);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTestMode]);
}
