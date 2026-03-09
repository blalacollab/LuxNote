import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { outlineEmbeds } from '../lib/outlineEmbeds';
import { OutlineNoteEditor } from '../components/OutlineNoteEditor';
import {
  getLastOutlineEditorProps,
  getLastPresetOptions,
  resetOutlineEditorMock,
} from './outlineEditorMock';

describe('OutlineNoteEditor', () => {
  beforeEach(() => {
    resetOutlineEditorMock();
  });

  it('wires the local editor module preset and host adapter', async () => {
    const handleChange = vi.fn();

    render(
      <OutlineNoteEditor
        editorKey="note-1"
        value="# Draft"
        defaultValue="# Draft"
        onChange={handleChange}
      />,
    );

    await screen.findByRole('textbox', { name: /note editor/i });

    const props = getLastOutlineEditorProps() as Record<string, unknown>;
    expect(props).toBeTruthy();
    expect(props.dictionary).toBeTruthy();
    expect(props.embeds).toBe(outlineEmbeds);
    expect(typeof props.uploadFile).toBe('function');
    expect(typeof props.hostAdapter).toBe('object');
    expect(getLastPresetOptions()).toEqual({
      enableFindAndReplace: true,
      enableDiagrams: true,
    });
  });

  it('forwards onChange, onBlur, and onClickLink', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleBlur = vi.fn();
    const handleLink = vi.fn();

    render(
      <OutlineNoteEditor
        editorKey="note-2"
        value=""
        defaultValue=""
        onChange={handleChange}
        onBlur={handleBlur}
        onClickLink={handleLink}
      />,
    );

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    await user.click(editor);
    await user.type(editor, 'abc');
    await user.tab();
    await user.click(screen.getByRole('button', { name: /open link/i }));

    expect(handleChange).toHaveBeenCalled();
    expect(handleBlur).toHaveBeenCalled();
    expect(handleLink).toHaveBeenCalledWith('https://example.com');
  });

  it('ignores mount-time empty changes for non-empty initial content until the user interacts', async () => {
    const handleChange = vi.fn();

    render(
      <OutlineNoteEditor
        editorKey="note-3"
        value="# Seed"
        defaultValue="# Seed"
        onChange={handleChange}
      />,
    );

    await screen.findByRole('textbox', { name: /note editor/i });

    const props = getLastOutlineEditorProps() as Record<string, any>;
    props.onChange(() => '');

    expect(handleChange).not.toHaveBeenCalled();

    props.onFocus?.();
    props.onChange(() => '');

    expect(handleChange).not.toHaveBeenCalled();
  });

  it('registers a live markdown getter that reflects the latest editor content', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleRegisterValueGetter = vi.fn();

    render(
      <OutlineNoteEditor
        editorKey="note-4"
        value=""
        defaultValue=""
        onChange={handleChange}
        onRegisterValueGetter={handleRegisterValueGetter}
      />,
    );

    const editor = await screen.findByRole('textbox', { name: /note editor/i });
    await user.click(editor);
    await user.type(editor, 'Persist me');

    const getter = handleRegisterValueGetter.mock.calls.at(-1)?.[0] as
      | (() => string)
      | undefined;

    expect(getter?.()).toBe('Persist me');
  });

  it('keeps getter value at initial content until the user interacts', async () => {
    const handleRegisterValueGetter = vi.fn();

    render(
      <OutlineNoteEditor
        editorKey="note-5"
        value=""
        defaultValue=""
        onChange={vi.fn()}
        onRegisterValueGetter={handleRegisterValueGetter}
      />,
    );

    await screen.findByRole('textbox', { name: /note editor/i });

    const props = getLastOutlineEditorProps() as Record<string, any>;
    props.onChange(() => '\u200B');

    const getter = handleRegisterValueGetter.mock.calls.at(-1)?.[0] as
      | (() => string)
      | undefined;

    expect(getter?.()).toBe('');
  });
});
