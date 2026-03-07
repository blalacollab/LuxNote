import { useEffect, useRef } from 'react';

import { GRID_MAJOR, GRID_MINOR } from '../lib/constants';
import { worldToScreen } from '../lib/camera';
import { isLineVisible } from '../lib/viewport';
import type {
  CameraState,
  ConnectionRecord,
  NoteRecord,
  ViewportSize,
} from '../lib/types';

interface CanvasStageProps {
  camera: CameraState;
  viewport: ViewportSize;
  notes: Record<string, NoteRecord>;
  connections: Record<string, ConnectionRecord>;
  selectedNoteId: string | null;
  linkingFromId: string | null;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: CameraState,
  viewport: ViewportSize,
): void {
  const worldLeft = camera.x - viewport.width / (2 * camera.zoom);
  const worldRight = camera.x + viewport.width / (2 * camera.zoom);
  const worldTop = camera.y - viewport.height / (2 * camera.zoom);
  const worldBottom = camera.y + viewport.height / (2 * camera.zoom);

  const minorStartX = Math.floor(worldLeft / GRID_MINOR) * GRID_MINOR;
  const minorStartY = Math.floor(worldTop / GRID_MINOR) * GRID_MINOR;
  const majorStartX = Math.floor(worldLeft / GRID_MAJOR) * GRID_MAJOR;
  const majorStartY = Math.floor(worldTop / GRID_MAJOR) * GRID_MAJOR;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(39, 65, 74, 0.16)';
  ctx.beginPath();

  for (let x = minorStartX; x < worldRight + GRID_MINOR; x += GRID_MINOR) {
    const screenX = (x - camera.x) * camera.zoom + viewport.width / 2;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, viewport.height);
  }

  for (let y = minorStartY; y < worldBottom + GRID_MINOR; y += GRID_MINOR) {
    const screenY = (y - camera.y) * camera.zoom + viewport.height / 2;
    ctx.moveTo(0, screenY);
    ctx.lineTo(viewport.width, screenY);
  }

  ctx.stroke();

  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(78, 137, 150, 0.2)';
  ctx.beginPath();

  for (let x = majorStartX; x < worldRight + GRID_MAJOR; x += GRID_MAJOR) {
    const screenX = (x - camera.x) * camera.zoom + viewport.width / 2;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, viewport.height);
  }

  for (let y = majorStartY; y < worldBottom + GRID_MAJOR; y += GRID_MAJOR) {
    const screenY = (y - camera.y) * camera.zoom + viewport.height / 2;
    ctx.moveTo(0, screenY);
    ctx.lineTo(viewport.width, screenY);
  }

  ctx.stroke();

  ctx.restore();
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  camera: CameraState,
  viewport: ViewportSize,
  notes: Record<string, NoteRecord>,
  connections: Record<string, ConnectionRecord>,
  selectedNoteId: string | null,
  linkingFromId: string | null,
): void {
  for (const connection of Object.values(connections)) {
    const from = notes[connection.from];
    const to = notes[connection.to];

    if (!from || !to) {
      continue;
    }

    const start = worldToScreen(
      {
        x: from.x + from.width / 2,
        y: from.y + from.height / 2,
      },
      camera,
      viewport,
    );
    const end = worldToScreen(
      {
        x: to.x + to.width / 2,
        y: to.y + to.height / 2,
      },
      camera,
      viewport,
    );

    if (!isLineVisible(start, end, viewport)) {
      continue;
    }

    const isActive =
      connection.from === selectedNoteId ||
      connection.to === selectedNoteId ||
      connection.from === linkingFromId ||
      connection.to === linkingFromId;

    const cp1x = start.x + (end.x - start.x) * 0.25;
    const cp2x = start.x + (end.x - start.x) * 0.75;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(cp1x, start.y, cp2x, end.y, end.x, end.y);
    ctx.lineWidth = 5;
    ctx.strokeStyle = isActive
      ? 'rgba(95, 200, 221, 0.24)'
      : 'rgba(95, 200, 221, 0.1)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(cp1x, start.y, cp2x, end.y, end.x, end.y);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isActive
      ? 'rgba(231, 253, 255, 0.78)'
      : 'rgba(146, 221, 234, 0.42)';
    ctx.stroke();

    ctx.fillStyle = isActive
      ? 'rgba(231, 253, 255, 0.96)'
      : 'rgba(146, 221, 234, 0.48)';
    ctx.beginPath();
    ctx.arc(start.x, start.y, isActive ? 3.4 : 2.4, 0, Math.PI * 2);
    ctx.arc(end.x, end.y, isActive ? 3.4 : 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function CanvasStage({
  camera,
  viewport,
  notes,
  connections,
  selectedNoteId,
  linkingFromId,
}: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const width = Math.max(1, Math.floor(viewport.width));
    const height = Math.max(1, Math.floor(viewport.height));
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    drawGrid(ctx, camera, { width, height });
    drawConnections(
      ctx,
      camera,
      { width, height },
      notes,
      connections,
      selectedNoteId,
      linkingFromId,
    );
  }, [camera, viewport, notes, connections, selectedNoteId, linkingFromId]);

  return <canvas ref={canvasRef} className="canvas-stage" />;
}
