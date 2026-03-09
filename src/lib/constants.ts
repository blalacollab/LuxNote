import type { CameraState, ViewportSize } from './types';

export const NOTE_WIDTH = 336;
export const NOTE_HEIGHT = 228;
export const MIN_ZOOM = 0.42;
export const MAX_ZOOM = 2.4;
export const DEFAULT_CAMERA: CameraState = {
  x: 0,
  y: 36,
  zoom: 0.9,
};
export const DEFAULT_VIEWPORT: ViewportSize = {
  width: 1280,
  height: 720,
};
export const GRID_MINOR = 48;
export const GRID_MAJOR = 240;
export const SAVE_DEBOUNCE_MS = 240;
export const DB_NAME = 'luxnote';
export const DB_STORE = 'scenes';
export const SCENE_KEY = 'latest';
export const LOCAL_STORAGE_KEY = 'luxnote.scene.v1';
export const YOUTUBE_PROGRESS_LOCAL_STORAGE_KEY = 'luxnote.youtube.progress.v1';
export const VELOCITY_CUTOFF = 0.02;
export const FRAME_TIME = 1000 / 60;
