import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCanvasHotkeys } from '../hooks/useCanvasHotkeys';
import { createDefaultScene } from '../lib/seed';
import { resetCanvasStore, useCanvasStore } from '../store/canvasStore';

function HotkeyHarness() {
  useCanvasHotkeys();
  const noteCount = useCanvasStore((state) => Object.keys(state.notes).length);

  return (
    <div>
      <textarea aria-label="editor" />
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
});
