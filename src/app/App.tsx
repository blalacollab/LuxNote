import { useMemo, useRef, useState } from 'react';
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { shallow } from 'zustand/shallow';

import { screenToWorld } from '../lib/camera';
import { computeVisibleNoteIds } from '../lib/viewport';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useCanvasHotkeys } from '../hooks/useCanvasHotkeys';
import { useScenePersistence } from '../hooks/useScenePersistence';
import { useViewportSync } from '../hooks/useViewportSync';
import type { Vec2 } from '../lib/types';
import { useCanvasStore } from '../store/canvasStore';
import { CanvasStage } from '../components/CanvasStage';
import { InspectorPanel } from '../components/InspectorPanel';
import { NoteCard } from '../components/NoteCard';
import styles from './App.module.css';

function saveStatusLabel(status: string): string {
  switch (status) {
    case 'saving':
      return 'Saving';
    case 'saved':
      return 'Saved';
    case 'error':
      return 'Save Error';
    default:
      return 'Idle';
  }
}

export function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const panSessionRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const spacePressed = useCanvasHotkeys();
  useScenePersistence();
  useAnimationLoop();
  useViewportSync(viewportRef);

  const {
    camera,
    viewport,
    notes,
    connections,
    selectedNoteId,
    linkingFromId,
    draggingNoteId,
    isHydrated,
    saveStatus,
  } = useCanvasStore(
    (state) => ({
      camera: state.camera,
      viewport: state.viewport,
      notes: state.notes,
      connections: state.connections,
      selectedNoteId: state.selectedNoteId,
      linkingFromId: state.linkingFromId,
      draggingNoteId: state.draggingNoteId,
      isHydrated: state.isHydrated,
      saveStatus: state.saveStatus,
    }),
    shallow,
  );

  const visibleIds = useMemo(
    () => computeVisibleNoteIds(notes, camera, viewport),
    [notes, camera, viewport],
  );
  const selectedNote = selectedNoteId ? notes[selectedNoteId] ?? null : null;

  const toWorld = (clientX: number, clientY: number): Vec2 => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const localPoint = {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
    const state = useCanvasStore.getState();

    return screenToWorld(localPoint, state.camera, state.viewport);
  };

  const beginPan = (pointerId: number, clientX: number, clientY: number) => {
    panSessionRef.current = {
      pointerId,
      lastX: clientX,
      lastY: clientY,
    };
    setIsPanning(true);
  };

  const handleViewportPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 && event.pointerType !== 'touch') {
      return;
    }

    const shouldPan = event.pointerType === 'touch' || spacePressed;

    if (shouldPan) {
      beginPan(event.pointerId, event.clientX, event.clientY);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    if (event.target === event.currentTarget) {
      const store = useCanvasStore.getState();
      store.selectNote(null);
      store.cancelLink();
    }
  };

  const handleViewportPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const session = panSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const delta = {
      x: event.clientX - session.lastX,
      y: event.clientY - session.lastY,
    };
    useCanvasStore.getState().panByScreenDelta(delta);
    session.lastX = event.clientX;
    session.lastY = event.clientY;
  };

  const finishPan = (pointerId: number) => {
    const session = panSessionRef.current;

    if (!session || session.pointerId !== pointerId) {
      return;
    }

    panSessionRef.current = null;
    setIsPanning(false);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const factor = Math.exp(-event.deltaY * 0.0015);
    event.preventDefault();
    useCanvasStore.getState().animateZoomAt(factor, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

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
          onWheel={handleWheel}
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

          <header className={styles.bar}>
            <div className={styles.brand}>
              <h1 className={styles.brandTitle}>LuxNote</h1>
              <p className={styles.brandMeta}>Infinite Canvas Notes</p>
            </div>
            <div className={styles.controls}>
              <button
                type="button"
                className={styles.button}
                onClick={() => useCanvasStore.getState().createNote()}
              >
                New Note
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() =>
                  useCanvasStore.getState().animateZoomAt(1.12, {
                    x: viewport.width / 2,
                    y: viewport.height / 2,
                  })
                }
              >
                Zoom In
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() =>
                  useCanvasStore.getState().animateZoomAt(0.88, {
                    x: viewport.width / 2,
                    y: viewport.height / 2,
                  })
                }
              >
                Zoom Out
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => useCanvasStore.getState().resetCamera()}
              >
                Reset View
              </button>
              <span className={styles.chip}>{visibleIds.length}/{Object.keys(notes).length} visible</span>
              <span className={styles.chip}>Zoom {camera.zoom.toFixed(2)}x</span>
              <span className={styles.chip}>{saveStatusLabel(saveStatus)}</span>
            </div>
          </header>

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
          </div>

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
        </div>
      </div>

      <InspectorPanel
        selectedNote={selectedNote}
        linkingFromId={linkingFromId}
        connections={connections}
      />
    </div>
  );
}
