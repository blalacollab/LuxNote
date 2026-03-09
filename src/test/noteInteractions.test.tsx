import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

async function renderAppWithSettledEffects() {
  render(<App />);
  await act(async () => {
    await Promise.resolve();
  });
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
    fireEvent.keyDown(editor, { key: 'a', code: 'KeyA' });
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
    fireEvent.keyDown(editor, { key: 'a', code: 'KeyA' });
    editor.textContent = 'Persist me';
    fireEvent.input(editor);
    fireEvent(window, new Event('pagehide'));

    const raw = localStorage.getItem('luxnote.scene.v1');
    expect(raw).toBeTruthy();

    const scene = JSON.parse(raw!);
    expect(scene.notes[note.id].body).toContain('Persist me');
  });

  it('requires confirmation before deleting a note', async () => {
    const note = Object.values(useCanvasStore.getState().notes)[0];
    const beforeCount = Object.keys(useCanvasStore.getState().notes).length;

    await renderAppWithSettledEffects();

    act(() => {
      useCanvasStore.getState().requestDeleteNote(note.id);
    });

    const dialog = screen.getByRole('dialog', { name: `Delete “${note.title || 'Untitled note'}”?` });

    expect(
      within(dialog).getByRole('heading', {
        name: `Delete “${note.title || 'Untitled note'}”?`,
      }),
    ).toBeInTheDocument();
    expect(Object.keys(useCanvasStore.getState().notes)).toHaveLength(beforeCount);

    fireEvent.click(within(screen.getByRole('dialog', { name: `Delete “${note.title || 'Untitled note'}”?` })).getByRole('button', { name: /^delete note$/i }));

    expect(Object.keys(useCanvasStore.getState().notes).length).toBeLessThan(beforeCount);
  });

  it('cancels a pending delete request without removing the note', async () => {
    const note = Object.values(useCanvasStore.getState().notes)[0];
    const beforeCount = Object.keys(useCanvasStore.getState().notes).length;

    await renderAppWithSettledEffects();

    act(() => {
      useCanvasStore.getState().requestDeleteNote(note.id);
    });

    fireEvent.click(within(screen.getByRole('dialog', { name: `Delete “${note.title || 'Untitled note'}”?` })).getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByRole('dialog', { name: `Delete “${note.title || 'Untitled note'}”?` })).not.toBeInTheDocument();
    expect(Object.keys(useCanvasStore.getState().notes)).toHaveLength(beforeCount);
    expect(
      Object.values(useCanvasStore.getState().notes).some(
        (item) => item.title === note.title,
      ),
    ).toBe(true);
    expect(useCanvasStore.getState().pendingDeleteNoteId).toBeNull();
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

    await renderAppWithSettledEffects();

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    const before = useCanvasStore.getState().camera;

    fireEvent.wheel(editor, {
      deltaY: 120,
      clientX: 300,
      clientY: 260,
    });

    expect(useCanvasStore.getState().camera).toEqual(before);
  });

  it('opens settings from the bottom-left status dock', async () => {
    const user = userEvent.setup();

    await renderAppWithSettledEffects();

    await user.click(screen.getByRole('button', { name: /open settings/i }));

    expect(useCanvasStore.getState().activeDialog).toEqual({
      type: 'settings',
    });
    expect(screen.getByRole('heading', { name: /control archive/i })).toBeInTheDocument();
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

  it('drops a pristine draft when changes are only blank-normalization', () => {
    const store = useCanvasStore.getState();
    const id = store.createNote();

    store.openNoteDialog(id);
    store.updateNote(id, { body: '\n' });
    store.closeDialog();

    expect(useCanvasStore.getState().notes[id]).toBeUndefined();
  });

  it('drops a pristine draft when body only contains invisible characters', () => {
    const store = useCanvasStore.getState();
    const id = store.createNote();

    store.openNoteDialog(id);
    store.updateNote(id, { body: '\u200B' });
    store.closeDialog();

    expect(useCanvasStore.getState().notes[id]).toBeUndefined();
  });

  it('does not clear a note body after closing the dialog and clicking blank canvas', async () => {
    const note = Object.values(useCanvasStore.getState().notes)[0];

    useCanvasStore.setState((state) => ({
      notes: {
        ...state.notes,
        [note.id]: {
          ...state.notes[note.id],
          body: 'Keep this body',
        },
      },
      activeDialog: {
        type: 'note',
        noteId: note.id,
      },
      selectedNoteId: note.id,
    }));

    await renderAppWithSettledEffects();

    act(() => {
      useCanvasStore.getState().closeDialog();
    });

    act(() => {
      const store = useCanvasStore.getState();
      store.selectNote(null);
      store.cancelLink();
    });

    expect(useCanvasStore.getState().notes[note.id]?.body).toBe('Keep this body');
  });

  it('opens external links from the editor wrapper without throwing', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    const note = Object.values(useCanvasStore.getState().notes)[0];

    render(<StoreBackedDialog noteId={note.id} />);

    await user.click(await screen.findByRole('button', { name: /open link/i }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    );

    openSpy.mockRestore();
  });
});
