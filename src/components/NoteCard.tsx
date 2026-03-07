import { useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { toPreviewText } from '../lib/markdown';
import type { CameraState, NoteMotion, NoteRecord, Vec2, ViewportSize } from '../lib/types';
import { useCanvasStore } from '../store/canvasStore';
import styles from './NoteCard.module.css';

interface NoteCardProps {
  camera: CameraState;
  viewport: ViewportSize;
  note: NoteRecord;
  isDragging: boolean;
  isSelected: boolean;
  isLinkSource: boolean;
  linkingFromId: string | null;
  spacePressed: boolean;
  toWorld: (clientX: number, clientY: number) => Vec2;
  isSystem?: boolean;
}

interface DragSession {
  pointerId: number;
  lastWorld: Vec2;
  lastTime: number;
  velocity: NoteMotion;
  moved: boolean;
}

function clampVelocity(value: number): number {
  return Math.max(-1.2, Math.min(1.2, value));
}

function shouldStopMotion(motion: NoteMotion): boolean {
  return Math.abs(motion.vx) < 0.02 && Math.abs(motion.vy) < 0.02;
}

export function NoteCard({
  camera,
  viewport,
  note,
  isDragging,
  isSelected,
  isLinkSource,
  linkingFromId,
  spacePressed,
  toWorld,
  isSystem = false,
}: NoteCardProps) {
  const dragRef = useRef<DragSession | null>(null);
  const suppressOpenRef = useRef(false);
  const preview = useMemo(() => toPreviewText(note.body).slice(0, 160), [note.body]);
  const compact = camera.zoom < 0.72;
  const x = (note.x - camera.x) * camera.zoom + viewport.width / 2;
  const y = (note.y - camera.y) * camera.zoom + viewport.height / 2;

  const selectNote = useCanvasStore((state) => state.selectNote);
  const bringToFront = useCanvasStore((state) => state.bringToFront);
  const moveNoteBy = useCanvasStore((state) => state.moveNoteBy);
  const setDraggingNoteId = useCanvasStore((state) => state.setDraggingNoteId);
  const setNoteMotion = useCanvasStore((state) => state.setNoteMotion);
  const beginLink = useCanvasStore((state) => state.beginLink);
  const cancelLink = useCanvasStore((state) => state.cancelLink);
  const completeLink = useCanvasStore((state) => state.completeLink);
  const deleteNote = useCanvasStore((state) => state.deleteNote);
  const openNoteDialog = useCanvasStore((state) => state.openNoteDialog);
  const openSettingsDialog = useCanvasStore((state) => state.openSettingsDialog);

  const finishDrag = (pointerId: number) => {
    const session = dragRef.current;

    if (!session || session.pointerId !== pointerId) {
      return;
    }

    dragRef.current = null;
    suppressOpenRef.current = session.moved;
    setDraggingNoteId(null);
    setNoteMotion(note.id, shouldStopMotion(session.velocity) ? null : session.velocity);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (spacePressed || event.button !== 0 || isSystem) {
      return;
    }

    if (linkingFromId) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const world = toWorld(event.clientX, event.clientY);
    dragRef.current = {
      pointerId: event.pointerId,
      lastWorld: world,
      lastTime: event.timeStamp,
      velocity: {
        vx: 0,
        vy: 0,
      },
      moved: false,
    };
    bringToFront(note.id);
    selectNote(note.id);
    setDraggingNoteId(note.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const world = toWorld(event.clientX, event.clientY);
    const delta = {
      x: world.x - session.lastWorld.x,
      y: world.y - session.lastWorld.y,
    };
    const dt = Math.max(event.timeStamp - session.lastTime, 8);

    moveNoteBy(note.id, delta);
    session.velocity = {
      vx: clampVelocity(delta.x / dt),
      vy: clampVelocity(delta.y / dt),
    };
    if (Math.abs(delta.x) > 1 || Math.abs(delta.y) > 1) {
      session.moved = true;
    }
    session.lastWorld = world;
    session.lastTime = event.timeStamp;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    finishDrag(event.pointerId);
  };

  const handleLostPointerCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    finishDrag(event.pointerId);
  };

  const handleCardClick = () => {
    if (linkingFromId) {
      if (linkingFromId === note.id) {
        cancelLink();
        selectNote(note.id);
      } else {
        completeLink(note.id);
      }
      return;
    }

    if (suppressOpenRef.current) {
      suppressOpenRef.current = false;
      selectNote(note.id);
      return;
    }

    if (isSystem) {
      openSettingsDialog();
      return;
    }

    selectNote(note.id);
    openNoteDialog(note.id);
  };

  const className = [
    styles.card,
    compact ? styles.compact : '',
    isSelected ? styles.selected : '',
    isDragging ? styles.dragging : '',
    isLinkSource ? styles.linkSource : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      data-note-card="true"
      className={className}
      style={{
        transform: `translate3d(${x}px, ${y}px, 0) scale(${camera.zoom})`,
        zIndex: note.z + 10,
      }}
      onClick={handleCardClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handleLostPointerCapture}
    >
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <p className={styles.eyebrow}>{isSystem ? 'Hidden Entry' : 'Field Note'}</p>
          <h3 className={styles.title}>{note.title}</h3>
        </div>
        {!isSystem ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Create link from note"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (linkingFromId && linkingFromId !== note.id) {
                  completeLink(note.id);
                  return;
                }

                if (isLinkSource) {
                  cancelLink();
                  return;
                }

                beginLink(note.id);
              }}
            >
              {isLinkSource ? '•' : '⤳'}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Delete note"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                deleteNote(note.id);
              }}
            >
              ×
            </button>
          </div>
        ) : null}
      </header>

      <div className={styles.body}>
        {!isSystem ? (
          <div className={styles.meta}>
            <span>{Math.round(note.x)}</span>
            <span>/</span>
            <span>{Math.round(note.y)}</span>
          </div>
        ) : (
          <div className={styles.meta}>
            <span>Press Enter</span>
            <span>/</span>
            <span>Open Manual</span>
          </div>
        )}
        <p className={styles.snippet}>{preview || 'Empty note'}</p>
        <footer className={styles.footer}>
          <span className={styles.pulse} />
          <span>
            {isSystem
              ? 'Settings / Help'
              : new Date(note.updatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
          </span>
        </footer>
      </div>
    </article>
  );
}
