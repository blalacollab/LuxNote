import {
  DB_NAME,
  DB_STORE,
  LOCAL_STORAGE_KEY,
  SCENE_KEY,
} from './constants';
import type { PersistedScene } from './types';

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIndexedDb(scene: PersistedScene): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(scene, SCENE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

async function loadFromIndexedDb(): Promise<PersistedScene | null> {
  const db = await openDb();
  const result = await new Promise<PersistedScene | null>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const request = tx.objectStore(DB_STORE).get(SCENE_KEY);
    request.onsuccess = () => resolve((request.result as PersistedScene) ?? null);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return result;
}

function readSceneFromLocalStorage(): PersistedScene | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedScene;
  } catch {
    return null;
  }
}

function getSceneFreshness(scene: PersistedScene | null): number {
  if (!scene) {
    return -1;
  }

  let freshness = 0;

  for (const note of Object.values(scene.notes)) {
    freshness = Math.max(freshness, note.updatedAt, note.createdAt);
  }

  for (const connection of Object.values(scene.connections)) {
    freshness = Math.max(freshness, connection.createdAt);
  }

  return freshness;
}

export function writeSceneToLocalStorage(scene: PersistedScene): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scene));
}

export async function saveScene(scene: PersistedScene): Promise<void> {
  writeSceneToLocalStorage(scene);

  if (canUseIndexedDb()) {
    try {
      await saveToIndexedDb(scene);
      return;
    } catch {
      // Fall through to localStorage.
    }
  }
}

export async function loadScene(): Promise<PersistedScene | null> {
  const localScene = readSceneFromLocalStorage();

  if (canUseIndexedDb()) {
    try {
      const indexedScene = await loadFromIndexedDb();

      if (indexedScene && localScene) {
        return getSceneFreshness(localScene) >= getSceneFreshness(indexedScene)
          ? localScene
          : indexedScene;
      }

      if (indexedScene) {
        return indexedScene;
      }
    } catch {
      // Fall through to localStorage.
    }
  }

  return localScene;
}
