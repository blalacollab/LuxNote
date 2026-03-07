import { Application, Container, Graphics } from 'pixi.js';
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
  graphics: Graphics,
  camera: CameraState,
  viewport: ViewportSize,
): void {
  graphics.clear();

  const worldLeft = camera.x - viewport.width / (2 * camera.zoom);
  const worldRight = camera.x + viewport.width / (2 * camera.zoom);
  const worldTop = camera.y - viewport.height / (2 * camera.zoom);
  const worldBottom = camera.y + viewport.height / (2 * camera.zoom);

  const minorStartX = Math.floor(worldLeft / GRID_MINOR) * GRID_MINOR;
  const minorStartY = Math.floor(worldTop / GRID_MINOR) * GRID_MINOR;
  const majorStartX = Math.floor(worldLeft / GRID_MAJOR) * GRID_MAJOR;
  const majorStartY = Math.floor(worldTop / GRID_MAJOR) * GRID_MAJOR;

  graphics.lineStyle(1, 0x27414a, 0.12);

  for (let x = minorStartX; x < worldRight + GRID_MINOR; x += GRID_MINOR) {
    const screenX = (x - camera.x) * camera.zoom + viewport.width / 2;
    graphics.moveTo(screenX, 0);
    graphics.lineTo(screenX, viewport.height);
  }

  for (let y = minorStartY; y < worldBottom + GRID_MINOR; y += GRID_MINOR) {
    const screenY = (y - camera.y) * camera.zoom + viewport.height / 2;
    graphics.moveTo(0, screenY);
    graphics.lineTo(viewport.width, screenY);
  }

  graphics.lineStyle(1.5, 0x4e8996, 0.16);

  for (let x = majorStartX; x < worldRight + GRID_MAJOR; x += GRID_MAJOR) {
    const screenX = (x - camera.x) * camera.zoom + viewport.width / 2;
    graphics.moveTo(screenX, 0);
    graphics.lineTo(screenX, viewport.height);
  }

  for (let y = majorStartY; y < worldBottom + GRID_MAJOR; y += GRID_MAJOR) {
    const screenY = (y - camera.y) * camera.zoom + viewport.height / 2;
    graphics.moveTo(0, screenY);
    graphics.lineTo(viewport.width, screenY);
  }

  graphics.lineStyle(2, 0x91f1ff, 0.18);
  graphics.moveTo(viewport.width / 2, 0);
  graphics.lineTo(viewport.width / 2, viewport.height);
  graphics.moveTo(0, viewport.height / 2);
  graphics.lineTo(viewport.width, viewport.height / 2);
}

function drawConnections(
  graphics: Graphics,
  camera: CameraState,
  viewport: ViewportSize,
  notes: Record<string, NoteRecord>,
  connections: Record<string, ConnectionRecord>,
  selectedNoteId: string | null,
  linkingFromId: string | null,
): void {
  graphics.clear();

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

    graphics.lineStyle(5, 0x5fc8dd, isActive ? 0.22 : 0.1);
    graphics.moveTo(start.x, start.y);
    graphics.bezierCurveTo(
      start.x + (end.x - start.x) * 0.25,
      start.y,
      start.x + (end.x - start.x) * 0.75,
      end.y,
      end.x,
      end.y,
    );

    graphics.lineStyle(1.4, isActive ? 0xe7fdff : 0x92ddea, isActive ? 0.74 : 0.38);
    graphics.moveTo(start.x, start.y);
    graphics.bezierCurveTo(
      start.x + (end.x - start.x) * 0.25,
      start.y,
      start.x + (end.x - start.x) * 0.75,
      end.y,
      end.x,
      end.y,
    );

    graphics.beginFill(isActive ? 0xe7fdff : 0x92ddea, isActive ? 0.9 : 0.42);
    graphics.drawCircle(start.x, start.y, isActive ? 3.4 : 2.4);
    graphics.drawCircle(end.x, end.y, isActive ? 3.4 : 2.4);
    graphics.endFill();
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
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const lineRef = useRef<Graphics | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const app = new Application({
      view: canvas,
      antialias: true,
      autoDensity: true,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
    });
    const stage = new Container();
    const grid = new Graphics();
    const lines = new Graphics();
    stage.addChild(grid, lines);
    app.stage.addChild(stage);
    app.renderer.resize(viewport.width || 1, viewport.height || 1);

    appRef.current = app;
    gridRef.current = grid;
    lineRef.current = lines;

    return () => {
      app.destroy(true, { children: true });
      appRef.current = null;
      gridRef.current = null;
      lineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;

    if (!app) {
      return;
    }

    app.renderer.resize(Math.max(viewport.width, 1), Math.max(viewport.height, 1));
  }, [viewport.height, viewport.width]);

  useEffect(() => {
    const grid = gridRef.current;
    const lines = lineRef.current;

    if (!grid || !lines) {
      return;
    }

    drawGrid(grid, camera, viewport);
    drawConnections(
      lines,
      camera,
      viewport,
      notes,
      connections,
      selectedNoteId,
      linkingFromId,
    );
  }, [camera, viewport, notes, connections, selectedNoteId, linkingFromId]);

  return <canvas ref={canvasRef} className="canvas-stage" />;
}
