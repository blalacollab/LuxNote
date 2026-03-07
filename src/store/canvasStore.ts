import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import {
  DEFAULT_CAMERA,
  DEFAULT_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
  NOTE_HEIGHT,
  NOTE_WIDTH,
} from '../lib/constants';
import { screenToWorld } from '../lib/camera';
import { makeConnectionId, makeId } from '../lib/ids';
import { stepInertia } from '../lib/physics';
import { createDefaultScene } from '../lib/seed';
import type {
  CameraState,
  ConnectionRecord,
  NoteMotion,
  NoteRecord,
  PersistedScene,
  Vec2,
  ViewportSize,
} from '../lib/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ZoomAnimation {
  targetZoom: number;
  anchorScreen: Vec2;
  anchorWorld: Vec2;
}

interface CanvasStoreState {
  camera: CameraState;
  viewport: ViewportSize;
  notes: Record<string, NoteRecord>;
  connections: Record<string, ConnectionRecord>;
  selectedNoteId: string | null;
  linkingFromId: string | null;
  draggingNoteId: string | null;
  noteMotions: Record<string, NoteMotion>;
  zoomAnimation: ZoomAnimation | null;
  nextZ: number;
  saveStatus: SaveStatus;
  isHydrated: boolean;
  createNote: (position?: Vec2) => string;
  updateNote: (id: string, patch: Partial<Pick<NoteRecord, 'title' | 'body'>>) => void;
  deleteNote: (id: string) => void;
  deleteSelectedNote: () => void;
  selectNote: (id: string | null) => void;
  setViewport: (viewport: ViewportSize) => void;
  bringToFront: (id: string) => void;
  moveNoteBy: (id: string, delta: Vec2) => void;
  setDraggingNoteId: (id: string | null) => void;
  setNoteMotion: (id: string, motion: NoteMotion | null) => void;
  beginLink: (id: string) => void;
  cancelLink: () => void;
  completeLink: (toId: string) => void;
  panByScreenDelta: (delta: Vec2) => void;
  animateZoomAt: (factor: number, anchorScreen: Vec2) => void;
  resetCamera: () => void;
  focusNote: (id: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  hydrate: (scene: PersistedScene | null) => void;
  getSnapshot: () => PersistedScene;
  stepAnimations: (dt: number) => boolean;
}

function computeNextZ(notes: Record<string, NoteRecord>): number {
  return (
    Object.values(notes).reduce((max, note) => Math.max(max, note.z), 0) + 1
  );
}

function sceneToState(scene: PersistedScene): Pick<
  CanvasStoreState,
  'camera' | 'notes' | 'connections' | 'nextZ'
> {
  return {
    camera: scene.camera,
    notes: scene.notes,
    connections: scene.connections,
    nextZ: computeNextZ(scene.notes),
  };
}

function createInitialState(): Omit<
  CanvasStoreState,
  | 'createNote'
  | 'updateNote'
  | 'deleteNote'
  | 'deleteSelectedNote'
  | 'selectNote'
  | 'setViewport'
  | 'bringToFront'
  | 'moveNoteBy'
  | 'setDraggingNoteId'
  | 'setNoteMotion'
  | 'beginLink'
  | 'cancelLink'
  | 'completeLink'
  | 'panByScreenDelta'
  | 'animateZoomAt'
  | 'resetCamera'
  | 'focusNote'
  | 'setSaveStatus'
  | 'hydrate'
  | 'getSnapshot'
  | 'stepAnimations'
> {
  const scene = createDefaultScene();

  return {
    ...sceneToState(scene),
    viewport: DEFAULT_VIEWPORT,
    selectedNoteId: null,
    linkingFromId: null,
    draggingNoteId: null,
    noteMotions: {},
    zoomAnimation: null,
    saveStatus: 'idle',
    isHydrated: false,
  };
}

export function buildSnapshot(state: Pick<
  CanvasStoreState,
  'camera' | 'notes' | 'connections'
>): PersistedScene {
  return {
    version: 1,
    camera: state.camera,
    notes: state.notes,
    connections: state.connections,
  };
}

export const useCanvasStore = create<CanvasStoreState>()(
  subscribeWithSelector((set, get) => ({
    ...createInitialState(),

    createNote: (position) => {
      const id = makeId('note');
      const now = Date.now();
      const state = get();
      const nextZ = state.nextZ + 1;
      const centeredPosition = position ?? {
        x: state.camera.x - NOTE_WIDTH / 2 + ((nextZ % 4) - 1.5) * 22,
        y: state.camera.y - NOTE_HEIGHT / 2 + ((nextZ % 3) - 1) * 18,
      };

      set((current) => ({
        notes: {
          ...current.notes,
          [id]: {
            id,
            title: 'Untitled note',
            body: 'Write in **Markdown**.',
            x: centeredPosition.x,
            y: centeredPosition.y,
            width: NOTE_WIDTH,
            height: NOTE_HEIGHT,
            z: nextZ,
            createdAt: now,
            updatedAt: now,
          },
        },
        selectedNoteId: id,
        nextZ,
      }));

      return id;
    },

    updateNote: (id, patch) => {
      set((state) => {
        const note = state.notes[id];

        if (!note) {
          return state;
        }

        return {
          notes: {
            ...state.notes,
            [id]: {
              ...note,
              ...patch,
              updatedAt: Date.now(),
            },
          },
        };
      });
    },

    deleteNote: (id) => {
      set((state) => {
        if (!state.notes[id]) {
          return state;
        }

        const nextNotes = { ...state.notes };
        const nextConnections = { ...state.connections };
        const nextMotions = { ...state.noteMotions };
        delete nextNotes[id];
        delete nextMotions[id];

        for (const connection of Object.values(state.connections)) {
          if (connection.from === id || connection.to === id) {
            delete nextConnections[connection.id];
          }
        }

        return {
          notes: nextNotes,
          connections: nextConnections,
          selectedNoteId:
            state.selectedNoteId === id ? null : state.selectedNoteId,
          linkingFromId: state.linkingFromId === id ? null : state.linkingFromId,
          draggingNoteId:
            state.draggingNoteId === id ? null : state.draggingNoteId,
          noteMotions: nextMotions,
        };
      });
    },

    deleteSelectedNote: () => {
      const id = get().selectedNoteId;

      if (id) {
        get().deleteNote(id);
      }
    },

    selectNote: (id) => {
      set({ selectedNoteId: id });
    },

    setViewport: (viewport) => {
      set({ viewport });
    },

    bringToFront: (id) => {
      set((state) => {
        const note = state.notes[id];

        if (!note) {
          return state;
        }

        const nextZ = state.nextZ + 1;

        return {
          noteMotions: Object.fromEntries(
            Object.entries(state.noteMotions).filter(
              ([motionId]) => motionId !== id,
            ),
          ),
          notes: {
            ...state.notes,
            [id]: {
              ...note,
              z: nextZ,
              updatedAt: Date.now(),
            },
          },
          nextZ,
        };
      });
    },

    moveNoteBy: (id, delta) => {
      set((state) => {
        const note = state.notes[id];

        if (!note) {
          return state;
        }

        return {
          notes: {
            ...state.notes,
            [id]: {
              ...note,
              x: note.x + delta.x,
              y: note.y + delta.y,
              updatedAt: Date.now(),
            },
          },
          noteMotions: {
            ...state.noteMotions,
            [id]: {
              vx: 0,
              vy: 0,
            },
          },
        };
      });
    },

    setDraggingNoteId: (id) => {
      set({ draggingNoteId: id });
    },

    setNoteMotion: (id, motion) => {
      set((state) => {
        const nextMotions = { ...state.noteMotions };

        if (!motion) {
          delete nextMotions[id];
        } else {
          nextMotions[id] = motion;
        }

        return {
          noteMotions: nextMotions,
        };
      });
    },

    beginLink: (id) => {
      set({
        linkingFromId: id,
        selectedNoteId: id,
      });
    },

    cancelLink: () => {
      set({ linkingFromId: null });
    },

    completeLink: (toId) => {
      set((state) => {
        const fromId = state.linkingFromId;

        if (!fromId || fromId === toId || !state.notes[toId]) {
          return {
            linkingFromId: null,
          };
        }

        const connectionId = makeConnectionId(fromId, toId);
        const nextConnections = { ...state.connections };

        if (nextConnections[connectionId]) {
          delete nextConnections[connectionId];
        } else {
          nextConnections[connectionId] = {
            id: connectionId,
            from: fromId,
            to: toId,
            createdAt: Date.now(),
          };
        }

        return {
          connections: nextConnections,
          linkingFromId: null,
          selectedNoteId: toId,
        };
      });
    },

    panByScreenDelta: (delta) => {
      set((state) => ({
        camera: {
          ...state.camera,
          x: state.camera.x - delta.x / state.camera.zoom,
          y: state.camera.y - delta.y / state.camera.zoom,
        },
        zoomAnimation: null,
      }));
    },

    animateZoomAt: (factor, anchorScreen) => {
      set((state) => {
        const baseZoom = state.zoomAnimation?.targetZoom ?? state.camera.zoom;
        const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, baseZoom * factor));
        const anchorWorld = screenToWorld(
          anchorScreen,
          state.camera,
          state.viewport,
        );

        return {
          zoomAnimation: {
            targetZoom,
            anchorScreen,
            anchorWorld,
          },
        };
      });
    },

    resetCamera: () => {
      set({
        camera: DEFAULT_CAMERA,
        zoomAnimation: null,
      });
    },

    focusNote: (id) => {
      set((state) => {
        const note = state.notes[id];

        if (!note) {
          return state;
        }

        return {
          camera: {
            ...state.camera,
            x: note.x + note.width / 2,
            y: note.y + note.height / 2,
          },
          selectedNoteId: id,
          zoomAnimation: null,
        };
      });
    },

    setSaveStatus: (status) => {
      set({ saveStatus: status });
    },

    hydrate: (scene) => {
      const nextScene = scene ?? createDefaultScene();
      const viewport = get().viewport;

      set({
        ...sceneToState(nextScene),
        viewport,
        selectedNoteId: null,
        linkingFromId: null,
        draggingNoteId: null,
        noteMotions: {},
        zoomAnimation: null,
        saveStatus: 'idle',
        isHydrated: true,
      });
    },

    getSnapshot: () => {
      const state = get();
      return buildSnapshot(state);
    },

    stepAnimations: (dt) => {
      const state = get();
      let changed = false;
      let nextNotes = state.notes;
      let nextMotions = state.noteMotions;
      let nextCamera = state.camera;
      let nextZoomAnimation = state.zoomAnimation;

      if (Object.keys(state.noteMotions).length > 0) {
        nextNotes = { ...state.notes };
        nextMotions = { ...state.noteMotions };

        for (const [id, motion] of Object.entries(state.noteMotions)) {
          const note = state.notes[id];

          if (!note) {
            delete nextMotions[id];
            changed = true;
            continue;
          }

          const result = stepInertia(
            {
              x: note.x,
              y: note.y,
            },
            motion,
            dt,
          );

          nextNotes[id] = {
            ...note,
            x: result.position.x,
            y: result.position.y,
            updatedAt: Date.now(),
          };

          if (result.motion) {
            nextMotions[id] = result.motion;
          } else {
            delete nextMotions[id];
          }

          changed = true;
        }
      }

      if (state.zoomAnimation) {
        const amount = 1 - Math.exp(-dt / 120);
        const zoom =
          state.camera.zoom +
          (state.zoomAnimation.targetZoom - state.camera.zoom) * amount;

        nextCamera = {
          x:
            state.zoomAnimation.anchorWorld.x -
            (state.zoomAnimation.anchorScreen.x - state.viewport.width / 2) / zoom,
          y:
            state.zoomAnimation.anchorWorld.y -
            (state.zoomAnimation.anchorScreen.y - state.viewport.height / 2) /
              zoom,
          zoom,
        };
        changed = true;

        if (Math.abs(zoom - state.zoomAnimation.targetZoom) < 0.0015) {
          nextCamera = {
            x:
              state.zoomAnimation.anchorWorld.x -
              (state.zoomAnimation.anchorScreen.x - state.viewport.width / 2) /
                state.zoomAnimation.targetZoom,
            y:
              state.zoomAnimation.anchorWorld.y -
              (state.zoomAnimation.anchorScreen.y - state.viewport.height / 2) /
                state.zoomAnimation.targetZoom,
            zoom: state.zoomAnimation.targetZoom,
          };
          nextZoomAnimation = null;
        }
      }

      if (!changed) {
        return false;
      }

      set({
        notes: nextNotes,
        noteMotions: nextMotions,
        camera: nextCamera,
        zoomAnimation: nextZoomAnimation,
      });

      return true;
    },
  })),
);

export function resetCanvasStore(scene?: PersistedScene): void {
  useCanvasStore.setState({
    ...createInitialState(),
    ...(scene ? sceneToState(scene) : sceneToState(createDefaultScene())),
    viewport: DEFAULT_VIEWPORT,
    isHydrated: true,
  });
}
