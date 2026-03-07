import {
  DEFAULT_CAMERA,
  DEFAULT_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
} from './constants';
import type { CameraState, Vec2, ViewportSize } from './types';

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(
  point: Vec2,
  camera: CameraState = DEFAULT_CAMERA,
  viewport: ViewportSize = DEFAULT_VIEWPORT,
): Vec2 {
  return {
    x: camera.x + (point.x - viewport.width / 2) / camera.zoom,
    y: camera.y + (point.y - viewport.height / 2) / camera.zoom,
  };
}

export function worldToScreen(
  point: Vec2,
  camera: CameraState = DEFAULT_CAMERA,
  viewport: ViewportSize = DEFAULT_VIEWPORT,
): Vec2 {
  return {
    x: (point.x - camera.x) * camera.zoom + viewport.width / 2,
    y: (point.y - camera.y) * camera.zoom + viewport.height / 2,
  };
}

export function zoomAt(
  camera: CameraState,
  nextZoom: number,
  anchorScreen: Vec2,
  viewport: ViewportSize,
): CameraState {
  const zoom = clampZoom(nextZoom);
  const anchorWorld = screenToWorld(anchorScreen, camera, viewport);

  return {
    x: anchorWorld.x - (anchorScreen.x - viewport.width / 2) / zoom,
    y: anchorWorld.y - (anchorScreen.y - viewport.height / 2) / zoom,
    zoom,
  };
}

export function panByScreenDelta(
  camera: CameraState,
  delta: Vec2,
): CameraState {
  return {
    ...camera,
    x: camera.x - delta.x / camera.zoom,
    y: camera.y - delta.y / camera.zoom,
  };
}

export function lerp(current: number, target: number, amount: number): number {
  return current + (target - current) * amount;
}
