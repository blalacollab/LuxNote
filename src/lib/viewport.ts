import type { CameraState, NoteRecord, Vec2, ViewportSize } from './types';

export interface WorldBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function getWorldBounds(
  camera: CameraState,
  viewport: ViewportSize,
  padding = 0,
): WorldBounds {
  const halfWidth = viewport.width / (2 * camera.zoom) + padding;
  const halfHeight = viewport.height / (2 * camera.zoom) + padding;

  return {
    left: camera.x - halfWidth,
    right: camera.x + halfWidth,
    top: camera.y - halfHeight,
    bottom: camera.y + halfHeight,
  };
}

export function isLineVisible(
  start: Vec2,
  end: Vec2,
  viewport: ViewportSize,
  padding = 120,
): boolean {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);

  return !(
    right < -padding ||
    bottom < -padding ||
    left > viewport.width + padding ||
    top > viewport.height + padding
  );
}

export function computeVisibleNoteIds(
  notes: Record<string, NoteRecord>,
  camera: CameraState,
  viewport: ViewportSize,
  padding = 180,
): string[] {
  const bounds = getWorldBounds(camera, viewport, padding / camera.zoom);

  return Object.values(notes)
    .filter((note) => {
      const right = note.x + note.width;
      const bottom = note.y + note.height;

      return !(
        right < bounds.left ||
        note.x > bounds.right ||
        bottom < bounds.top ||
        note.y > bounds.bottom
      );
    })
    .sort((left, right) => left.z - right.z)
    .map((note) => note.id);
}
