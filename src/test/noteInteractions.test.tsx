import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../app/App';
import { CanvasDialog } from '../components/CanvasDialog';
import { NoteCard } from '../components/NoteCard';
import { DEFAULT_VIEWPORT } from '../lib/constants';
import { createDefaultScene } from '../lib/seed';
import { resetCanvasStore, useCanvasStore } from '../store/canvasStore';

function StoreBackedDialog({ noteId }: { noteId: string }) {
  const note = useCanvasStore((state) => state.notes[noteId] ?? null);

  return <CanvasDialog dialog={{ type: 'note', noteId }} note={note} />;
}

describe('note interactions', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCanvasStore(createDefaultScene());
  });

  it('completes a link without opening the note dialog while link mode is active', async () => {
    const user = userEvent.setup();
    const state = useCanvasStore.getState();
    const orderedNotes = Object.values(state.notes).sort((left, right) => left.z - right.z);
    const source = orderedNotes[0];
    const target = orderedNotes[2];

    useCanvasStore.setState({
      linkingFromId: source.id,
      selectedNoteId: source.id,
    });

    render(
      <NoteCard
        camera={state.camera}
        viewport={DEFAULT_VIEWPORT}
        note={target}
        isDragging={false}
        isSelected={false}
        isLinkSource={false}
        linkingFromId={source.id}
        spacePressed={false}
        toWorld={() => ({ x: 0, y: 0 })}
      />,
    );

    await user.click(screen.getByText(target.title));

    const nextState = useCanvasStore.getState();
    const connection = Object.values(nextState.connections).find(
      (item) => item.from === source.id && item.to === target.id,
    );

    expect(connection).toBeDefined();
    expect(nextState.activeDialog).toBeNull();
    expect(nextState.linkingFromId).toBeNull();
    expect(nextState.selectedNoteId).toBe(target.id);
  });

  it('mounts the fullscreen editor through the outline-editor wrapper', async () => {
    const state = useCanvasStore.getState();
    const note = Object.values(state.notes).sort((left, right) => left.z - right.z)[0];

    render(<StoreBackedDialog noteId={note.id} />);

    expect(
      screen.queryByRole('button', { name: /start link/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /cancel link/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /note title/i })).toBeInTheDocument();
    expect(
      await screen.findByRole('textbox', { name: /note editor/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('outline-editor-host')).toBeInTheDocument();
  });

  it('writes editor changes back to the markdown body in the store', async () => {
    const state = useCanvasStore.getState();
    const baseNote = Object.values(state.notes)[0];
    const note = {
      ...baseNote,
      body: '',
    };

    useCanvasStore.setState((current) => ({
      notes: {
        ...current.notes,
        [note.id]: note,
      },
    }));

    render(<StoreBackedDialog noteId={note.id} />);

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    fireEvent.focus(editor);
    editor.textContent = 'Plan #research';
    fireEvent.input(editor);

    await waitFor(() => {
      expect(useCanvasStore.getState().notes[note.id]?.body).toContain('Plan #research');
    });
  });

  it('flushes the latest editor draft to storage on pagehide', async () => {
    const state = useCanvasStore.getState();
    const baseNote = Object.values(state.notes)[0];
    const note = {
      ...baseNote,
      body: '',
    };

    useCanvasStore.setState((current) => ({
      notes: {
        ...current.notes,
        [note.id]: note,
      },
    }));

    render(<StoreBackedDialog noteId={note.id} />);

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    fireEvent.focus(editor);
    editor.textContent = 'Persist me';
    fireEvent.input(editor);
    fireEvent(window, new Event('pagehide'));

    const raw = localStorage.getItem('luxnote.scene.v1');
    expect(raw).toBeTruthy();

    const scene = JSON.parse(raw!);
    expect(scene.notes[note.id].body).toContain('Persist me');
  });

  it('does not pan or zoom the canvas when wheeling inside the editor', async () => {
    const note = Object.values(useCanvasStore.getState().notes)[0];

    useCanvasStore.setState({
      activeDialog: {
        type: 'note',
        noteId: note.id,
      },
      selectedNoteId: note.id,
    });

    render(<App />);

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    const before = useCanvasStore.getState().camera;

    fireEvent.wheel(editor, {
      deltaY: 120,
      clientX: 300,
      clientY: 260,
    });

    expect(useCanvasStore.getState().camera).toEqual(before);
  });

  it('removes a pristine blank draft note when its dialog closes', () => {
    const store = useCanvasStore.getState();
    const id = store.createNote();

    store.openNoteDialog(id);
    store.closeDialog();

    expect(useCanvasStore.getState().notes[id]).toBeUndefined();
  });

  it('creates new notes with empty default content', () => {
    const store = useCanvasStore.getState();
    const id = store.createNote();
    const note = useCanvasStore.getState().notes[id];

    expect(note?.title).toBe('');
    expect(note?.body).toBe('');
  });

  it('keeps a touched draft note when closing the dialog even if it becomes blank again', () => {
    const store = useCanvasStore.getState();
    const id = store.createNote();

    store.openNoteDialog(id);
    store.updateNote(id, { body: 'draft' });
    store.updateNote(id, { body: '' });
    store.closeDialog();

    expect(useCanvasStore.getState().notes[id]).toBeDefined();
    expect(useCanvasStore.getState().activeDialog).toBeNull();
  });

  it('opens external links from the editor wrapper without throwing', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    const note = Object.values(useCanvasStore.getState().notes)[0];

    render(<StoreBackedDialog noteId={note.id} />);

    await user.click(screen.getByRole('button', { name: /open link/i }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    );

    openSpy.mockRestore();
  });
});
