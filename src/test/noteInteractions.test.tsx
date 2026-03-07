import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

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

function setCollapsedSelection(target: Node, offset?: number) {
  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();

  if (target.nodeType === Node.TEXT_NODE) {
    range.setStart(target, offset ?? target.textContent?.length ?? 0);
  } else {
    range.selectNodeContents(target);
    range.collapse(offset === 0);
  }

  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
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

  it('mounts the fullscreen editor without link controls', async () => {
    const state = useCanvasStore.getState();
    const note = Object.values(state.notes).sort((left, right) => left.z - right.z)[0];

    render(<StoreBackedDialog noteId={note.id} />);

    expect(
      screen.queryByRole('button', { name: /start link/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /cancel link/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(
      await screen.findByRole('textbox', { name: /note editor/i }),
    ).toBeInTheDocument();
  });

  it('writes editor changes back to the markdown body in the store', async () => {
    const user = userEvent.setup();
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
    await user.click(editor);
    await user.type(editor, 'Plan #research');

    await waitFor(() => {
      expect(useCanvasStore.getState().notes[note.id]?.body).toContain('Plan');
    });
  });

  it('creates new notes with empty default content', () => {
    const store = useCanvasStore.getState();
    const id = store.createNote();
    const note = useCanvasStore.getState().notes[id];

    expect(note?.title).toBe('');
    expect(note?.body).toBe('');
  });

  it('removes a pristine blank draft note when its dialog closes', () => {
    const store = useCanvasStore.getState();
    const id = store.createNote();

    store.openNoteDialog(id);
    store.closeDialog();

    expect(useCanvasStore.getState().notes[id]).toBeUndefined();
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

  it('normalizes an empty editor into paragraph blocks before and after paste', async () => {
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
    expect(editor.querySelector('p')).not.toBeNull();

    const paragraph = editor.querySelector('p');
    expect(paragraph).not.toBeNull();

    if (!paragraph) {
      throw new Error('Expected an editable paragraph scaffold.');
    }

    setCollapsedSelection(paragraph, 0);
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) =>
          type === 'text/plain' ? '/Users/solux/OpenSource/outline' : '',
      },
    });

    await waitFor(() => {
      expect(useCanvasStore.getState().notes[note.id]?.body).toBe(
        '/Users/solux/OpenSource/outline',
      );
    });

    expect(editor.querySelector('p')).not.toBeNull();
    expect(editor.textContent).toContain('/Users/solux/OpenSource/outline');
  });

  it('keeps pasted text inside blockquotes wrapped in editable paragraphs', async () => {
    const state = useCanvasStore.getState();
    const baseNote = Object.values(state.notes)[0];
    const note = {
      ...baseNote,
      body: '> ',
    };

    useCanvasStore.setState((current) => ({
      notes: {
        ...current.notes,
        [note.id]: note,
      },
    }));

    render(<StoreBackedDialog noteId={note.id} />);

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    const quoteParagraph = editor.querySelector('blockquote p');
    expect(quoteParagraph).not.toBeNull();

    if (!quoteParagraph) {
      throw new Error('Expected an editable paragraph inside the blockquote.');
    }

    setCollapsedSelection(quoteParagraph, 0);
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) =>
          type === 'text/plain' ? '/Users/solux/OpenSource/outline' : '',
      },
    });

    await waitFor(() => {
      expect(useCanvasStore.getState().notes[note.id]?.body).toContain(
        '> /Users/solux/OpenSource/outline',
      );
    });

    expect(editor.querySelector('blockquote p')).not.toBeNull();
  });

  it('creates a single follow-up paragraph when pressing enter on an image block', async () => {
    const state = useCanvasStore.getState();
    const baseNote = Object.values(state.notes)[0];
    const note = {
      ...baseNote,
      body: '![Hero](https://example.com/hero.png)',
    };

    useCanvasStore.setState((current) => ({
      notes: {
        ...current.notes,
        [note.id]: note,
      },
    }));

    render(<StoreBackedDialog noteId={note.id} />);

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    const imageParagraph = editor.querySelector('p');

    expect(imageParagraph?.querySelector('img')).not.toBeNull();

    if (!imageParagraph) {
      throw new Error('Expected an image paragraph.');
    }

    setCollapsedSelection(imageParagraph, 0);
    fireEvent.keyDown(editor, { key: 'Enter' });

    const paragraphs = Array.from(editor.children).filter(
      (child) => child instanceof HTMLElement && child.tagName === 'P',
    );

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelector('img')).not.toBeNull();
  });

  it('turns triple backticks into a code block immediately on enter', async () => {
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
    const paragraph = editor.querySelector('p');

    if (!paragraph) {
      throw new Error('Expected an initial paragraph scaffold.');
    }

    paragraph.textContent = '```ts';
    const textNode = paragraph.firstChild;

    if (!textNode) {
      throw new Error('Expected a fence text node.');
    }

    setCollapsedSelection(textNode, textNode.textContent?.length ?? 0);
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(editor.querySelector('pre code[data-language="ts"]')).not.toBeNull();

    await waitFor(() => {
      expect(useCanvasStore.getState().notes[note.id]?.body).toBe('```ts\n\n```');
    });
  });

  it('exits an empty list item into a normal paragraph on enter', async () => {
    const state = useCanvasStore.getState();
    const baseNote = Object.values(state.notes)[0];
    const note = {
      ...baseNote,
      body: '- item\n- ',
    };

    useCanvasStore.setState((current) => ({
      notes: {
        ...current.notes,
        [note.id]: note,
      },
    }));

    render(<StoreBackedDialog noteId={note.id} />);

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    const items = editor.querySelectorAll('li');
    const emptyItem = items.item(1);

    if (!emptyItem) {
      throw new Error('Expected an empty list item.');
    }

    setCollapsedSelection(emptyItem, 0);
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(editor.querySelectorAll('li')).toHaveLength(1);
    expect(editor.lastElementChild?.tagName).toBe('P');

    await waitFor(() => {
      expect(useCanvasStore.getState().notes[note.id]?.body).toBe('- item');
    });
  });

  it('exits an empty code block into a normal paragraph on enter', async () => {
    const state = useCanvasStore.getState();
    const baseNote = Object.values(state.notes)[0];
    const note = {
      ...baseNote,
      body: '```ts\n\n```',
    };

    useCanvasStore.setState((current) => ({
      notes: {
        ...current.notes,
        [note.id]: note,
      },
    }));

    render(<StoreBackedDialog noteId={note.id} />);

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    const code = editor.querySelector('pre code');

    if (!code) {
      throw new Error('Expected an empty code block.');
    }

    setCollapsedSelection(code, 0);
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(editor.querySelector('pre')).toBeNull();
    expect(editor.querySelector('p')).not.toBeNull();

    await waitFor(() => {
      expect(useCanvasStore.getState().notes[note.id]?.body).toBe('');
    });
  });

  it('does not pan the canvas when wheeling inside the fullscreen editor', async () => {
    const state = useCanvasStore.getState();
    const note = Object.values(state.notes)[0];

    useCanvasStore.setState({
      activeDialog: {
        type: 'note',
        noteId: note.id,
      },
      selectedNoteId: note.id,
    });

    const before = { ...useCanvasStore.getState().camera };

    render(<App />);

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    fireEvent.wheel(editor, { deltaY: 180 });

    expect(useCanvasStore.getState().camera).toEqual(before);
  });

  it('shows a limited tag summary on note cards', () => {
    const state = useCanvasStore.getState();
    const note = {
      ...Object.values(state.notes)[0],
      body: 'Work on #research #ux #roadmap',
    };

    render(
      <NoteCard
        camera={state.camera}
        viewport={DEFAULT_VIEWPORT}
        note={note}
        isDragging={false}
        isSelected={false}
        isLinkSource={false}
        linkingFromId={null}
        spacePressed={false}
        toWorld={() => ({ x: 0, y: 0 })}
      />,
    );

    expect(screen.getByText('#research')).toBeInTheDocument();
    expect(screen.getByText('#ux')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});
