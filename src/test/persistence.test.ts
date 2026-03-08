import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LOCAL_STORAGE_KEY } from '../lib/constants';
import { loadScene, saveScene } from '../lib/persistence';
import type { PersistedScene } from '../lib/types';

function createScene(body: string, updatedAt: number): PersistedScene {
  return {
    version: 1,
    camera: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    notes: {
      'note-1': {
        id: 'note-1',
        title: 'Draft',
        body,
        x: 0,
        y: 0,
        width: 320,
        height: 220,
        z: 1,
        createdAt: updatedAt,
        updatedAt,
      },
    },
    connections: {},
    preferences: {
      hudVisible: true,
    },
  };
}

function createIndexedDbMock(initialScene: PersistedScene | null = null) {
  let storedScene = initialScene;
  let hasStore = false;

  return {
    open() {
      const request: Record<string, any> = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };

      queueMicrotask(() => {
        const transactionFactory = (mode: 'readonly' | 'readwrite') => {
          const tx: Record<string, any> = {
            oncomplete: null,
            onerror: null,
            objectStore() {
              return {
                put(scene: PersistedScene) {
                  storedScene = scene;
                  queueMicrotask(() => {
                    tx.oncomplete?.();
                  });
                },
                get() {
                  const getRequest: Record<string, any> = {
                    result: null,
                    error: null,
                    onsuccess: null,
                    onerror: null,
                  };

                  queueMicrotask(() => {
                    getRequest.result = storedScene;
                    getRequest.onsuccess?.();
                  });

                  return getRequest;
                },
              };
            },
          };

          if (mode === 'readonly') {
            queueMicrotask(() => {
              tx.oncomplete?.();
            });
          }

          return tx;
        };

        const db = {
          objectStoreNames: {
            contains: () => hasStore,
          },
          createObjectStore() {
            hasStore = true;
            return {};
          },
          transaction(_store: string, mode: 'readonly' | 'readwrite') {
            return transactionFactory(mode);
          },
          close() {},
        };

        request.result = db;

        if (!hasStore) {
          request.onupgradeneeded?.();
        }

        request.onsuccess?.();
      });

      return request;
    },
  };
}

describe('persistence', () => {
  const originalIndexedDb = globalThis.indexedDB;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: originalIndexedDb,
    });
  });

  it('writes localStorage immediately even when indexedDB is available', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: createIndexedDbMock(),
    });

    const scene = createScene('Persist now', 200);

    await saveScene(scene);

    expect(localStorage.getItem(LOCAL_STORAGE_KEY)).toBe(JSON.stringify(scene));
  });

  it('prefers fresher localStorage data over stale indexedDB data', async () => {
    const indexedScene = createScene('Old indexed body', 100);
    const localScene = createScene('Fresh local body', 250);

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: createIndexedDbMock(indexedScene),
    });

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localScene));

    await expect(loadScene()).resolves.toEqual(localScene);
  });
});
