import ReactMarkdown from 'react-markdown';

import type { ConnectionRecord, NoteRecord } from '../lib/types';
import { useCanvasStore } from '../store/canvasStore';
import styles from './InspectorPanel.module.css';

interface InspectorPanelProps {
  selectedNote: NoteRecord | null;
  linkingFromId: string | null;
  connections: Record<string, ConnectionRecord>;
}

export function InspectorPanel({
  selectedNote,
  linkingFromId,
  connections,
}: InspectorPanelProps) {
  const updateNote = useCanvasStore((state) => state.updateNote);
  const requestDeleteSelectedNote = useCanvasStore((state) => state.requestDeleteSelectedNote);
  const beginLink = useCanvasStore((state) => state.beginLink);
  const cancelLink = useCanvasStore((state) => state.cancelLink);
  const focusNote = useCanvasStore((state) => state.focusNote);

  if (!selectedNote) {
    return (
      <aside className={styles.panel}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Inspector</p>
          <h2 className={styles.title}>Canvas Control</h2>
        </div>
        <div className={styles.body}>
          <div className={styles.placeholder}>
            <p>
              <strong>Select a note</strong> to edit title and Markdown body, frame it
              in view, or start a connection.
            </p>
            <p>
              The viewport keeps only nearby cards mounted, while Pixi handles the
              grid and link rendering underneath.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const noteConnections = Object.values(connections).filter(
    (connection) =>
      connection.from === selectedNote.id || connection.to === selectedNote.id,
  );

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Inspector</p>
        <h2 className={styles.title}>{selectedNote.title || 'Untitled note'}</h2>
      </div>
      <div className={styles.body}>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => focusNote(selectedNote.id)}
          >
            Frame Note
          </button>
          {linkingFromId === selectedNote.id ? (
            <button
              type="button"
              className={`${styles.button} ${styles.buttonAccent}`}
              onClick={cancelLink}
            >
              Cancel Link
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.button} ${styles.buttonAccent}`}
              onClick={() => beginLink(selectedNote.id)}
            >
              Start Link
            </button>
          )}
          <button
            type="button"
            className={styles.button}
            onClick={requestDeleteSelectedNote}
          >
            Delete
          </button>
        </div>

        {linkingFromId === selectedNote.id ? (
          <p className={styles.hint}>Link mode enabled. Click another card to toggle a connection.</p>
        ) : null}

        <label className={styles.label}>
          Title
          <input
            className={styles.input}
            value={selectedNote.title}
            onChange={(event) =>
              updateNote(selectedNote.id, { title: event.target.value })
            }
            placeholder="Untitled note"
          />
        </label>

        <div className={styles.split}>
          <label className={styles.label}>
            Markdown
            <textarea
              className={styles.textarea}
              value={selectedNote.body}
              onChange={(event) =>
                updateNote(selectedNote.id, { body: event.target.value })
              }
              placeholder="Write details, plans, or specs in Markdown."
            />
          </label>

          <section className={styles.preview}>
            <ReactMarkdown>{selectedNote.body || '*Nothing to preview yet.*'}</ReactMarkdown>
          </section>
        </div>

        <p className={styles.hint}>{noteConnections.length} active connection(s)</p>
      </div>
    </aside>
  );
}
