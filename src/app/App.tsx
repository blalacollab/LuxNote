import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { shallow } from 'zustand/shallow';

import { NOTE_HEIGHT, NOTE_WIDTH } from '../lib/constants';
import { screenToWorld } from '../lib/camera';
import { computeVisibleNoteIds } from '../lib/viewport';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useCanvasHotkeys } from '../hooks/useCanvasHotkeys';
import { useScenePersistence } from '../hooks/useScenePersistence';
import { useViewportSync } from '../hooks/useViewportSync';
import type { NoteRecord, Vec2 } from '../lib/types';
import { useCanvasStore } from '../store/canvasStore';
import { CanvasStage } from '../components/CanvasStage';
import { CanvasDialog } from '../components/CanvasDialog';
import { NoteCard } from '../components/NoteCard';
import styles from './App.module.css';

interface PanSession {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  pendingPoint: { x: number; y: number } | null;
  frameId: number | null;
  hasMoved: boolean;
  clearSelectionOnRelease: boolean;
}

function isBackgroundInteractionTarget(
  target: EventTarget | null,
  currentTarget: HTMLElement,
): boolean {
  if (!(target instanceof HTMLElement)) {
    return target === currentTarget;
  }

  if (target === currentTarget) {
    return true;
  }

  return (
    target.closest('[data-note-card="true"]') === null &&
    target.closest('[data-hud="true"]') === null &&
    target.closest('[data-dialog-surface="true"]') === null
  );
}

function shouldHandleViewportWheel(target: EventTarget | null): boolean {
  const element =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  return !(
    element &&
    element.closest('[data-dialog-surface="true"]')
  );
}

export function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const panSessionRef = useRef<PanSession | null>(null);
  const hudPeekVisibleRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isHudPeekVisible, setIsHudPeekVisible] = useState(false);
  const spacePressed = useCanvasHotkeys();
  useScenePersistence();
  useAnimationLoop();
  useViewportSync(viewportRef);

  const {
    camera,
    viewport,
    notes,
    connections,
    preferences,
    selectedNoteId,
    linkingFromId,
    draggingNoteId,
    activeDialog,
    pendingDeleteNoteId,
    settingsNoteVisible,
    isHydrated,
  } = useCanvasStore(
    (state) => ({
      camera: state.camera,
      viewport: state.viewport,
      notes: state.notes,
      connections: state.connections,
      preferences: state.preferences,
      selectedNoteId: state.selectedNoteId,
      linkingFromId: state.linkingFromId,
      draggingNoteId: state.draggingNoteId,
      activeDialog: state.activeDialog,
      pendingDeleteNoteId: state.pendingDeleteNoteId,
      settingsNoteVisible: state.settingsNoteVisible,
      isHydrated: state.isHydrated,
    }),
    shallow,
  );
  const cancelDeleteRequest = useCanvasStore((state) => state.cancelDeleteRequest);
  const confirmDeleteRequest = useCanvasStore((state) => state.confirmDeleteRequest);

  const visibleIds = useMemo(
    () => computeVisibleNoteIds(notes, camera, viewport),
    [notes, camera, viewport],
  );
  const selectedNote = selectedNoteId ? notes[selectedNoteId] ?? null : null;
  const dialogNote =
    activeDialog?.type === 'note' ? notes[activeDialog.noteId] ?? null : null;
  const pendingDeleteNote = pendingDeleteNoteId
    ? notes[pendingDeleteNoteId] ?? null
    : null;

  const settingsNote = useMemo<NoteRecord | null>(() => {
    if (!settingsNoteVisible) {
      return null;
    }

    return {
      id: '__settings__',
      title: 'Control Archive',
      body: 'Hidden system entry. Open to configure the HUD and view the interaction manual.',
      x: camera.x - NOTE_WIDTH / 2,
      y: camera.y - NOTE_HEIGHT / 2 - 72,
      width: NOTE_WIDTH,
      height: NOTE_HEIGHT,
      z: Number.MAX_SAFE_INTEGER,
      createdAt: 0,
      updatedAt: 0,
    };
  }, [camera.x, camera.y, settingsNoteVisible]);

  const toWorld = (clientX: number, clientY: number): Vec2 => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const localPoint = {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
    const state = useCanvasStore.getState();

    return screenToWorld(localPoint, state.camera, state.viewport);
  };

  const setHudPeekVisible = (visible: boolean) => {
    if (hudPeekVisibleRef.current === visible) {
      return;
    }

    hudPeekVisibleRef.current = visible;
    setIsHudPeekVisible(visible);
  };

  const updateHudPeekVisibility = (clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const nextVisible =
      clientX - rect.left <= 176 &&
      rect.bottom - clientY <= 68;

    setHudPeekVisible(nextVisible);
  };

  const schedulePanFlush = () => {
    const session = panSessionRef.current;

    if (!session || session.frameId !== null) {
      return;
    }

    session.frameId = requestAnimationFrame(() => {
      const current = panSessionRef.current;

      if (!current) {
        return;
      }

      current.frameId = null;

      if (!current.pendingPoint) {
        return;
      }

      const delta = {
        x: current.pendingPoint.x - current.lastX,
        y: current.pendingPoint.y - current.lastY,
      };

      current.lastX = current.pendingPoint.x;
      current.lastY = current.pendingPoint.y;
      current.pendingPoint = null;
      useCanvasStore.getState().panByScreenDelta(delta);

      if (current.pendingPoint) {
        schedulePanFlush();
      }
    });
  };

  const beginPan = (pointerId: number, clientX: number, clientY: number) => {
    panSessionRef.current = {
      pointerId,
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastY: clientY,
      pendingPoint: null,
      frameId: null,
      hasMoved: false,
      clearSelectionOnRelease: false,
    };
  };

  const handleViewportPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 && event.pointerType !== 'touch') {
      return;
    }

    const isBackground = isBackgroundInteractionTarget(
      event.target,
      event.currentTarget,
    );
    const shouldPan =
      event.pointerType === 'touch' ||
      spacePressed ||
      isBackground;

    if (shouldPan) {
      beginPan(event.pointerId, event.clientX, event.clientY);
      if (panSessionRef.current) {
        panSessionRef.current.clearSelectionOnRelease =
          isBackground && !spacePressed;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
  };

  const handleViewportPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    updateHudPeekVisibility(event.clientX, event.clientY);

    const session = panSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    if (!session.hasMoved) {
      const dx = event.clientX - session.startX;
      const dy = event.clientY - session.startY;

      if (Math.sqrt(dx * dx + dy * dy) <= 3) {
        return;
      }

      session.hasMoved = true;
      setIsPanning(true);
    }

    session.pendingPoint = {
      x: event.clientX,
      y: event.clientY,
    };
    schedulePanFlush();
  };

  const finishPan = (pointerId: number) => {
    const session = panSessionRef.current;

    if (!session || session.pointerId !== pointerId) {
      return;
    }

    if (session.frameId !== null) {
      cancelAnimationFrame(session.frameId);
    }

    if (session.clearSelectionOnRelease && !session.hasMoved) {
      const store = useCanvasStore.getState();
      store.selectNote(null);
      store.cancelLink();
    }

    panSessionRef.current = null;
    setIsPanning(false);
  };

  const handleCreateNote = (clientX: number, clientY: number) => {
    const store = useCanvasStore.getState();
    const world = toWorld(clientX, clientY);
    const id = store.createNote({
      x: world.x - NOTE_WIDTH / 2,
      y: world.y - NOTE_HEIGHT / 2,
    });
    store.openNoteDialog(id);
  };

  useEffect(() => {
    const element = viewportRef.current;

    if (!element) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!shouldHandleViewportWheel(event.target)) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);
      event.preventDefault();
      useCanvasStore.getState().animateZoomAt(factor, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className={styles.shell}>
      <div className={styles.viewportWrap}>
        <div
          ref={viewportRef}
          className={[
            styles.viewport,
            spacePressed ? styles.viewportPannable : '',
            isPanning ? styles.viewportPanning : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={(event) => finishPan(event.pointerId)}
          onPointerCancel={(event) => finishPan(event.pointerId)}
          onLostPointerCapture={(event) => finishPan(event.pointerId)}
          onPointerLeave={() => setHudPeekVisible(false)}
          onDoubleClick={(event) => {
            if (
              isBackgroundInteractionTarget(event.target, event.currentTarget)
            ) {
              handleCreateNote(event.clientX, event.clientY);
            }
          }}
        >
          <div className={styles.canvas}>
            <CanvasStage
              camera={camera}
              viewport={viewport}
              notes={notes}
              connections={connections}
              selectedNoteId={selectedNoteId}
              linkingFromId={linkingFromId}
            />
          </div>

          <div className={styles.noteLayer}>
            {visibleIds.map((id) => {
              const note = notes[id];

              return (
                <NoteCard
                  key={note.id}
                  camera={camera}
                  viewport={viewport}
                  note={note}
                  isDragging={draggingNoteId === note.id}
                  isSelected={selectedNoteId === note.id}
                  isLinkSource={linkingFromId === note.id}
                  linkingFromId={linkingFromId}
                  spacePressed={spacePressed}
                  toWorld={toWorld}
                />
              );
            })}

            {settingsNote ? (
              <NoteCard
                key={settingsNote.id}
                camera={camera}
                viewport={viewport}
                note={settingsNote}
                isDragging={false}
                isSelected={activeDialog?.type === 'settings'}
                isLinkSource={false}
                linkingFromId={null}
                spacePressed={spacePressed}
                toWorld={toWorld}
                isSystem
              />
            ) : null}
          </div>

          {preferences.hudVisible ? (
            <div
              data-hud="true"
              className={[
                styles.hud,
                isHudPeekVisible ? styles.hudVisible : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.hudItem}>{camera.zoom.toFixed(2)}x</span>
              <span className={styles.hudItem}>
                X {Math.round(camera.x)} / Y {Math.round(camera.y)}
              </span>
            </div>
          ) : null}

          {linkingFromId ? (
            <div className={styles.linkBanner}>
              Link mode active. Click another card to create or remove a connection.
            </div>
          ) : null}

          {!isHydrated ? (
            <div className={styles.loader}>
              <div className={styles.loaderCard}>
                <h2 className={styles.loaderTitle}>Restoring Local Canvas</h2>
                <p className={styles.loaderText}>
                  Loading notes from IndexedDB, reconnecting the viewport, and
                  restoring your last local scene.
                </p>
              </div>
            </div>
          ) : null}

          <CanvasDialog dialog={activeDialog} note={dialogNote ?? selectedNote} />

          {pendingDeleteNote ? (
            <div
              data-dialog-surface="true"
              className={styles.confirmOverlay}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  cancelDeleteRequest();
                }
              }}
            >
              <section
                className={styles.confirmCard}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`delete-note-title-${pendingDeleteNote.id}`}
              >
                <p className={styles.confirmEyebrow}>Delete Note</p>
                <h2
                  id={`delete-note-title-${pendingDeleteNote.id}`}
                  className={styles.confirmTitle}
                >
                  Delete “{pendingDeleteNote.title || 'Untitled note'}”?
                </h2>
                <p className={styles.confirmText}>
                  This will remove the note and all of its connections from the
                  canvas.
                </p>
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    className={styles.confirmButton}
                    onClick={cancelDeleteRequest}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${styles.confirmButton} ${styles.confirmButtonDanger}`}
                    onClick={confirmDeleteRequest}
                  >
                    Delete note
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
