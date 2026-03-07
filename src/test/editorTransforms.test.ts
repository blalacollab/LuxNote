import { describe, expect, it } from 'vitest';

import {
  exitCodeBlockOnEmptyPre,
  exitListOnEmptyItem,
  insertParagraphAfterBlock,
  exitBlockquoteOnEmptyParagraph,
  transformMarkdownShortcutBlock,
} from '../lib/editorTransforms';

describe('editorTransforms', () => {
  it('replaces only the current block when converting markdown shortcuts', () => {
    const root = document.createElement('div');
    const first = document.createElement('p');
    const second = document.createElement('p');

    first.textContent = 'alpha';
    second.textContent = '#';
    root.append(first, second);

    const transformed = transformMarkdownShortcutBlock(second, 'h1');

    expect(root.firstElementChild?.tagName).toBe('P');
    expect(root.lastElementChild?.tagName).toBe('H1');
    expect(transformed?.tagName).toBe('H1');
  });

  it('exits a trailing empty blockquote paragraph by inserting a paragraph after the quote', () => {
    const root = document.createElement('div');
    const quote = document.createElement('blockquote');
    const first = document.createElement('p');
    const second = document.createElement('p');

    first.textContent = 'quoted';
    second.append(document.createElement('br'));
    quote.append(first, second);
    root.append(quote);

    const nextParagraph = exitBlockquoteOnEmptyParagraph(second);

    expect(nextParagraph?.tagName).toBe('P');
    expect(root.children[0]).toBe(quote);
    expect(root.children[1]).toBe(nextParagraph ?? null);
    expect(quote.children).toHaveLength(1);
    expect(quote.textContent).toContain('quoted');
  });

  it('does not exit blockquote from a non-empty paragraph', () => {
    const quote = document.createElement('blockquote');
    const paragraph = document.createElement('p');

    paragraph.textContent = 'still writing';
    quote.append(paragraph);

    expect(exitBlockquoteOnEmptyParagraph(paragraph)).toBeNull();
  });

  it('inserts a single paragraph after an atomic block', () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    const image = document.createElement('img');

    paragraph.append(image);
    root.append(paragraph);

    const nextParagraph = insertParagraphAfterBlock(paragraph);

    expect(nextParagraph?.tagName).toBe('P');
    expect(root.children).toHaveLength(2);
    expect(root.children[1]).toBe(nextParagraph ?? null);
  });

  it('transforms fence shorthand into an editable code block', () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');

    paragraph.textContent = '```ts';
    root.append(paragraph);

    const transformed = transformMarkdownShortcutBlock(paragraph, 'codeFence', {
      language: 'ts',
    });

    expect(root.firstElementChild?.tagName).toBe('PRE');
    expect(root.querySelector('code')?.getAttribute('data-language')).toBe('ts');
    expect(transformed?.tagName).toBe('CODE');
  });

  it('exits a trailing empty list item by inserting a paragraph after the list', () => {
    const root = document.createElement('div');
    const list = document.createElement('ul');
    const first = document.createElement('li');
    const second = document.createElement('li');

    first.textContent = 'alpha';
    second.append(document.createElement('br'));
    list.append(first, second);
    root.append(list);

    const nextParagraph = exitListOnEmptyItem(second);

    expect(nextParagraph?.tagName).toBe('P');
    expect(root.children[0]).toBe(list);
    expect(root.children[1]).toBe(nextParagraph ?? null);
    expect(list.children).toHaveLength(1);
    expect(list.textContent).toContain('alpha');
  });

  it('does not exit a non-empty list item', () => {
    const list = document.createElement('ul');
    const item = document.createElement('li');

    item.textContent = 'still writing';
    list.append(item);

    expect(exitListOnEmptyItem(item)).toBeNull();
  });

  it('exits an empty code block by inserting a paragraph after it', () => {
    const root = document.createElement('div');
    const pre = document.createElement('pre');
    const code = document.createElement('code');

    code.append(document.createElement('br'));
    pre.append(code);
    root.append(pre);

    const nextParagraph = exitCodeBlockOnEmptyPre(pre);

    expect(nextParagraph?.tagName).toBe('P');
    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toBe(nextParagraph ?? null);
  });

  it('does not exit a non-empty code block', () => {
    const pre = document.createElement('pre');
    const code = document.createElement('code');

    code.textContent = 'const value = 1;';
    pre.append(code);

    expect(exitCodeBlockOnEmptyPre(pre)).toBeNull();
  });
});
