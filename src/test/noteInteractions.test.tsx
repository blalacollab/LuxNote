import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_VIEWPORT } from '../lib/constants';
import { createDefaultScene } from '../lib/seed';
import { CanvasDialog } from '../components/CanvasDialog';
import { NoteCard } from '../components/NoteCard';
import { resetCanvasStore, useCanvasStore } from '../store/canvasStore';

describe('note interactions', () => {
  beforeEach(() => {
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

  it('does not expose link controls inside the fullscreen note dialog', () => {
    const state = useCanvasStore.getState();
    const note = Object.values(state.notes).sort((left, right) => left.z - right.z)[0];

    render(
      <CanvasDialog
        dialog={{ type: 'note', noteId: note.id }}
        note={note}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /start link/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /cancel link/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /bold/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Note editor')).toBeInTheDocument();
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });
});
