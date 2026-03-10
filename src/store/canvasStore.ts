import { createWithEqualityFn } from 'zustand/traditional';
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
  CanvasPreferences,
  ConnectionRecord,
  NoteMotion,
  NoteRecord,
  PersistedScene,
  Vec2,
  ViewportSize,
} from '../lib/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type DialogState =
  | {
      type: 'note';
      noteId: string;
    }
  | {
      type: 'settings';
    }
  | null;

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
  preferences: CanvasPreferences;
  selectedNoteId: string | null;
  linkingFromId: string | null;
  draggingNoteId: string | null;
  activeDialog: DialogState;
  pendingDeleteNoteId: string | null;
  noteMotions: Record<string, NoteMotion>;
  zoomAnimation: ZoomAnimation | null;
  nextZ: number;
  saveStatus: SaveStatus;
  isHydrated: boolean;
  pristineDraftNoteIds: Record<string, true>;
  createNote: (position?: Vec2) => string;
  updateNote: (id: string, patch: Partial<Pick<NoteRecord, 'title' | 'body'>>) => void;
  deleteNote: (id: string) => void;
  deleteSelectedNote: () => void;
  requestDeleteNote: (id: string) => void;
  requestDeleteSelectedNote: () => void;
  cancelDeleteRequest: () => void;
  confirmDeleteRequest: () => void;
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
  openNoteDialog: (id: string) => void;
  openSettingsDialog: () => void;
  closeDialog: () => void;
  setHudVisible: (visible: boolean) => void;
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

const INVISIBLE_TEXT_PATTERN =
  /[\s\u00A0\u1680\u180E\u2000-\u200D\u2028\u2029\u202F\u205F\u3000\uFEFF]/g;

function normalizeForBlankCheck(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<\/?p>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(INVISIBLE_TEXT_PATTERN, '');
}

function isBlankText(value: string): boolean {
  return normalizeForBlankCheck(value).length === 0;
}

function isBlankNote(note: Pick<NoteRecord, 'title' | 'body'>): boolean {
  return isBlankText(note.title) && isBlankText(note.body);
}

function removeNoteFromState(state: CanvasStoreState, id: string) {
  if (!state.notes[id]) {
    return state;
  }

  const nextNotes = { ...state.notes };
  const nextConnections = { ...state.connections };
  const nextMotions = { ...state.noteMotions };
  const nextPristineDraftNoteIds = { ...state.pristineDraftNoteIds };

  delete nextNotes[id];
  delete nextMotions[id];
  delete nextPristineDraftNoteIds[id];

  for (const connection of Object.values(state.connections)) {
    if (connection.from === id || connection.to === id) {
      delete nextConnections[connection.id];
    }
  }

  return {
    notes: nextNotes,
    connections: nextConnections,
    activeDialog:
      state.activeDialog?.type === 'note' && state.activeDialog.noteId === id
        ? null
        : state.activeDialog,
    pendingDeleteNoteId:
      state.pendingDeleteNoteId === id ? null : state.pendingDeleteNoteId,
    selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
    linkingFromId: state.linkingFromId === id ? null : state.linkingFromId,
    draggingNoteId: state.draggingNoteId === id ? null : state.draggingNoteId,
    noteMotions: nextMotions,
    pristineDraftNoteIds: nextPristineDraftNoteIds,
  };
}

function sceneToState(scene: PersistedScene): Pick<
  CanvasStoreState,
  'camera' | 'notes' | 'connections' | 'nextZ' | 'preferences'
> {
  return {
    camera: scene.camera,
    notes: scene.notes,
    connections: scene.connections,
    preferences: scene.preferences ?? {
      hudVisible: true,
    },
    nextZ: computeNextZ(scene.notes),
  };
}

function createInitialState(): Omit<
  CanvasStoreState,
  | 'createNote'
  | 'updateNote'
  | 'deleteNote'
  | 'deleteSelectedNote'
  | 'requestDeleteNote'
  | 'requestDeleteSelectedNote'
  | 'cancelDeleteRequest'
  | 'confirmDeleteRequest'
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
  | 'openNoteDialog'
  | 'openSettingsDialog'
  | 'closeDialog'
  | 'setHudVisible'
  | 'setSaveStatus'
  | 'hydrate'
  | 'getSnapshot'
  | 'stepAnimations'
> {
  const scene = createDefaultScene();

  return {
    ...sceneToState(scene),
    viewport: DEFAULT_VIEWPORT,
    preferences: {
      hudVisible: true,
    },
    selectedNoteId: null,
    linkingFromId: null,
    draggingNoteId: null,
    activeDialog: null,
    pendingDeleteNoteId: null,
    noteMotions: {},
    zoomAnimation: null,
    saveStatus: 'idle',
    isHydrated: false,
    pristineDraftNoteIds: {},
  };
}

export function buildSnapshot(state: Pick<
  CanvasStoreState,
  'camera' | 'notes' | 'connections' | 'preferences'
>): PersistedScene {
  return {
    version: 1,
    camera: state.camera,
    notes: state.notes,
    connections: state.connections,
    preferences: state.preferences,
  };
}

export const useCanvasStore = createWithEqualityFn<CanvasStoreState>()(
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
            title: '',
            body: '',
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
        pristineDraftNoteIds: {
          ...current.pristineDraftNoteIds,
          [id]: true,
        },
      }));

      return id;
    },

    updateNote: (id, patch) => {
      set((state) => {
        const note = state.notes[id];

        if (!note) {
          return state;
        }

        const hasTitlePatch = patch.title !== undefined;
        const hasBodyPatch = patch.body !== undefined;

        if (!hasTitlePatch && !hasBodyPatch) {
          return state;
        }

        const nextTitle = hasTitlePatch ? patch.title! : note.title;
        const nextBody = hasBodyPatch ? patch.body! : note.body;
        const noteChanged = nextTitle !== note.title || nextBody !== note.body;

        if (!noteChanged) {
          return state;
        }

        const nextPristineDraftNoteIds = { ...state.pristineDraftNoteIds };
        const wasSemanticallyBlank =
          isBlankText(note.title) && isBlankText(note.body);
        const isSemanticallyBlank =
          isBlankText(nextTitle) && isBlankText(nextBody);

        if (!(wasSemanticallyBlank && isSemanticallyBlank)) {
          delete nextPristineDraftNoteIds[id];
        }

        return {
          notes: {
            ...state.notes,
            [id]: {
              ...note,
              title: nextTitle,
              body: nextBody,
              updatedAt: Date.now(),
            },
          },
          pristineDraftNoteIds: nextPristineDraftNoteIds,
        };
      });
    },

    deleteNote: (id) => {
      set((state) => removeNoteFromState(state, id));
    },

    deleteSelectedNote: () => {
      const id = get().selectedNoteId;

      if (id) {
        get().deleteNote(id);
      }
    },

    requestDeleteNote: (id) => {
      if (!get().notes[id]) {
        return;
      }

      set({
        pendingDeleteNoteId: id,
      });
    },

    requestDeleteSelectedNote: () => {
      const id = get().selectedNoteId;

      if (id) {
        get().requestDeleteNote(id);
      }
    },

    cancelDeleteRequest: () => {
      set({
        pendingDeleteNoteId: null,
      });
    },

    confirmDeleteRequest: () => {
      const id = get().pendingDeleteNoteId;

      if (!id) {
        return;
      }

      set({
        pendingDeleteNoteId: null,
      });
      get().deleteNote(id);
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

    openNoteDialog: (id) => {
      set((state) => {
        if (!state.notes[id]) {
          return state;
        }

        return {
          activeDialog: {
            type: 'note',
            noteId: id,
          },
          linkingFromId: null,
          selectedNoteId: id,
        };
      });
    },

    openSettingsDialog: () => {
      set({
        activeDialog: {
          type: 'settings',
        },
        linkingFromId: null,
      });
    },

    closeDialog: () => {
      set((state) => {
        if (
          state.activeDialog?.type === 'note' &&
          state.pristineDraftNoteIds[state.activeDialog.noteId]
        ) {
          const note = state.notes[state.activeDialog.noteId];

          if (note && isBlankNote(note)) {
            return removeNoteFromState(state, note.id);
          }
        }

        return { activeDialog: null };
      });
    },

    setHudVisible: (visible) => {
      set((state) => ({
        preferences: {
          ...state.preferences,
          hudVisible: visible,
        },
      }));
    },

    setSaveStatus: (status) => {
      set({ saveStatus: status });
    },

    hydrate: (scene) => {
      const state = get();
      const viewport = state.viewport;

      if (!scene) {
        set({
          viewport,
          isHydrated: true,
          saveStatus: 'idle',
        });
        return;
      }

      set({
        ...sceneToState(scene),
        viewport,
        selectedNoteId: null,
        linkingFromId: null,
        draggingNoteId: null,
        activeDialog: null,
        noteMotions: {},
        zoomAnimation: null,
        saveStatus: 'idle',
        isHydrated: true,
        pristineDraftNoteIds: {},
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
    pristineDraftNoteIds: {},
  });
}
