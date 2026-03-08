import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('../modules/outline-editor/runtime', async () => import('./outlineEditorMock'));
vi.mock('../modules/outline-editor/styles', () => ({}));

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

const localStorageStore = new Map<string, string>();

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem(key: string) {
      return localStorageStore.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      localStorageStore.set(key, value);
    },
    removeItem(key: string) {
      localStorageStore.delete(key);
    },
    clear() {
      localStorageStore.clear();
    },
  },
});

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value() {},
});

Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
  writable: true,
  value() {},
});

Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
  writable: true,
  value() {},
});

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  writable: true,
  value() {
    return false;
  },
});

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  writable: true,
  value() {
    return {
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fill() {},
      arc() {},
      bezierCurveTo() {},
      clearRect() {},
      drawImage() {},
      scale() {},
      setTransform() {},
      lineWidth: 1,
      strokeStyle: '',
      fillStyle: '',
    };
  },
});
