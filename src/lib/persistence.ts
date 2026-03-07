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

export async function saveScene(scene: PersistedScene): Promise<void> {
  if (canUseIndexedDb()) {
    try {
      await saveToIndexedDb(scene);
      return;
    } catch {
      // Fall through to localStorage.
    }
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scene));
  }
}

export async function loadScene(): Promise<PersistedScene | null> {
  if (canUseIndexedDb()) {
    try {
      const scene = await loadFromIndexedDb();

      if (scene) {
        return scene;
      }
    } catch {
      // Fall through to localStorage.
    }
  }

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
