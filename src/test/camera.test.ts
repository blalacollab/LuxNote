import { describe, expect, it } from 'vitest';

import { zoomAt } from '../lib/camera';

describe('zoomAt', () => {
  it('keeps the anchor point stable while zooming', () => {
    const camera = {
      x: 120,
      y: -80,
      zoom: 1,
    };
    const viewport = {
      width: 1280,
      height: 720,
    };
    const anchor = {
      x: 930,
      y: 250,
    };

    const next = zoomAt(camera, 1.6, anchor, viewport);
    const beforeWorldX = camera.x + (anchor.x - viewport.width / 2) / camera.zoom;
    const beforeWorldY = camera.y + (anchor.y - viewport.height / 2) / camera.zoom;
    const afterWorldX = next.x + (anchor.x - viewport.width / 2) / next.zoom;
    const afterWorldY = next.y + (anchor.y - viewport.height / 2) / next.zoom;

    expect(afterWorldX).toBeCloseTo(beforeWorldX, 5);
    expect(afterWorldY).toBeCloseTo(beforeWorldY, 5);
  });
});
