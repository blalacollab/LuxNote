import { DEFAULT_CAMERA, NOTE_HEIGHT, NOTE_WIDTH } from './constants';
import { makeConnectionId, makeId } from './ids';
import type { ConnectionRecord, NoteRecord, PersistedScene } from './types';

export function createDefaultScene(): PersistedScene {
  const now = Date.now();
  const notes: NoteRecord[] = [
    {
      id: makeId('note'),
      title: 'Launch Pad',
      body: [
        '# Infinite canvas',
        '',
        '- Drag cards to re-layout ideas',
        '- Hold `Space` then drag to pan',
        '- `Ctrl/Cmd + wheel` zooms to cursor',
      ].join('\n'),
      x: -420,
      y: -140,
      width: NOTE_WIDTH,
      height: NOTE_HEIGHT,
      z: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId('note'),
      title: 'Visual Direction',
      body: [
        'Dark graphite background, translucent note shells, layered shadows, and restrained cyan highlights.',
        '',
        'The tone is sci-fi and tactile rather than ornamental.',
      ].join('\n'),
      x: 24,
      y: -40,
      width: NOTE_WIDTH,
      height: NOTE_HEIGHT,
      z: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId('note'),
      title: 'Next Iterations',
      body: [
        '- Realtime collaboration',
        '- Cross-device sync',
        '- Asset attachments',
        '- Canvas export and publishing',
      ].join('\n'),
      x: -120,
      y: 260,
      width: NOTE_WIDTH,
      height: NOTE_HEIGHT,
      z: 3,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const noteMap = Object.fromEntries(notes.map((note) => [note.id, note]));
  const connections: ConnectionRecord[] = [
    {
      id: makeConnectionId(notes[0].id, notes[1].id),
      from: notes[0].id,
      to: notes[1].id,
      createdAt: now,
    },
    {
      id: makeConnectionId(notes[1].id, notes[2].id),
      from: notes[1].id,
      to: notes[2].id,
      createdAt: now,
    },
  ];

  return {
    version: 1,
    camera: DEFAULT_CAMERA,
    notes: noteMap,
    connections: Object.fromEntries(
      connections.map((connection) => [connection.id, connection]),
    ),
  };
}
