import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { isTypingTarget, useCanvasHotkeys } from '../hooks/useCanvasHotkeys';
import { createDefaultScene } from '../lib/seed';
import { resetCanvasStore, useCanvasStore } from '../store/canvasStore';

function HotkeyHarness() {
  useCanvasHotkeys();
  const noteCount = useCanvasStore((state) => Object.keys(state.notes).length);

  return (
    <div>
      <textarea aria-label="editor" />
      <div aria-label="rich-editor" contentEditable suppressContentEditableWarning>
        <span>draft</span>
      </div>
      <output aria-label="note-count">{noteCount}</output>
    </div>
  );
}

describe('useCanvasHotkeys', () => {
  beforeEach(() => {
    resetCanvasStore(createDefaultScene());
  });

  it('creates a note when pressing Ctrl+N outside editable fields', async () => {
    const user = userEvent.setup();
    render(<HotkeyHarness />);

    expect(screen.getByLabelText('note-count')).toHaveTextContent('3');
    await user.keyboard('{Control>}n{/Control}');
    expect(screen.getByLabelText('note-count')).toHaveTextContent('4');
  });

  it('ignores plain typing while focused in a textarea', async () => {
    const user = userEvent.setup();
    render(<HotkeyHarness />);

    const editor = screen.getByLabelText('editor');
    await user.click(editor);
    await user.keyboard('n');

    expect(screen.getByLabelText('note-count')).toHaveTextContent('3');
  });

  it('treats descendants inside contenteditable editors as typing targets', () => {
    const host = document.createElement('div');
    const child = document.createElement('span');
    const text = document.createTextNode('draft');

    host.setAttribute('contenteditable', 'true');
    child.append(text);
    host.append(child);
    document.body.append(host);

    expect(isTypingTarget(text)).toBe(true);
    expect(isTypingTarget(child)).toBe(true);
  });

  it('does not delete a note when backspace is pressed inside a rich editor', async () => {
    const user = userEvent.setup();
    render(<HotkeyHarness />);

    useCanvasStore.setState({
      selectedNoteId: Object.keys(useCanvasStore.getState().notes)[0] ?? null,
    });

    const richEditor = screen.getByLabelText('rich-editor');
    await user.click(richEditor);
    await user.keyboard('{Backspace}');

    expect(screen.getByLabelText('note-count')).toHaveTextContent('3');
  });
});
