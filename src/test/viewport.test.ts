import { describe, expect, it } from 'vitest';

import { NOTE_HEIGHT, NOTE_WIDTH } from '../lib/constants';
import { computeVisibleNoteIds } from '../lib/viewport';

describe('computeVisibleNoteIds', () => {
  it('returns only notes intersecting the viewport bounds', () => {
    const notes = {
      alpha: {
        id: 'alpha',
        title: '',
        body: '',
        x: -120,
        y: -90,
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
        z: 1,
        createdAt: 0,
        updatedAt: 0,
      },
      beta: {
        id: 'beta',
        title: '',
        body: '',
        x: 1800,
        y: 1800,
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
        z: 2,
        createdAt: 0,
        updatedAt: 0,
      },
    };

    const visible = computeVisibleNoteIds(
      notes,
      { x: 0, y: 0, zoom: 1 },
      { width: 1280, height: 720 },
    );

    expect(visible).toEqual(['alpha']);
  });
});
