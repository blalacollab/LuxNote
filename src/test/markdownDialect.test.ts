import { describe, expect, it } from 'vitest';

import {
  decorateEditorContent,
  extractMarkdownTags,
  normalizeEditorMarkdown,
  prepareMarkdownForEditor,
  toPreviewText,
} from '../lib/markdownDialect';

describe('markdown dialect adapter', () => {
  const roundTripCases = [
    {
      name: 'paragraphs and headings',
      markdown: ['alpha', '', '# Heading', '', 'beta'].join('\n'),
    },
    {
      name: 'inline formatting',
      markdown: 'Use **bold**, *italic*, ~~strike~~, and `inline code`.',
    },
    {
      name: 'links and images',
      markdown: [
        '[Lux](https://example.com)',
        '',
        '![Hero](https://example.com/hero.png)',
      ].join('\n'),
    },
    {
      name: 'quotes and callouts',
      markdown: ['> [!note] Callout', '> Body copy'].join('\n'),
    },
    {
      name: 'lists and task lists',
      markdown: [
        '- alpha',
        '- [x] shipped',
        '1. first',
        '2. second',
      ].join('\n'),
    },
    {
      name: 'fenced code blocks',
      markdown: ['```ts', 'const link = "[[Raw]]";', '```'].join('\n'),
    },
    {
      name: 'tables and separators',
      markdown: [
        '| Name | Role |',
        '| --- | --- |',
        '| Lux | Maker |',
        '',
        '---',
      ].join('\n'),
    },
    {
      name: 'wiki links',
      markdown: 'Link to [[Roadmap|Product Roadmap]] from here.',
    },
    {
      name: 'obsidian tags',
      markdown: 'Track #research and #project/ux in the same note.',
    },
    {
      name: 'unsupported obsidian syntax remains literal',
      markdown: ['![[Embed Card]]', '', '```mermaid', 'graph LR', 'A-->B', '```'].join(
        '\n',
      ),
    },
  ];

  for (const testCase of roundTripCases) {
    it(`round-trips ${testCase.name}`, () => {
      expect(
        normalizeEditorMarkdown(prepareMarkdownForEditor(testCase.markdown)),
      ).toBe(testCase.markdown);
    });
  }

  it('converts wiki links to editor-safe links before loading', () => {
    expect(
      prepareMarkdownForEditor('Read [[Roadmap|Product Roadmap]] today.'),
    ).toBe('Read [Product Roadmap](wiki:Roadmap) today.');
  });

  it('extracts unique obsidian tags and ignores code spans', () => {
    expect(
      extractMarkdownTags(
        [
          'Ship #research and #project/ux',
          'Ignore `#inline`',
          '#research again',
          '```ts',
          'const hidden = "#blocked";',
          '```',
        ].join('\n'),
      ),
    ).toEqual(['research', 'project/ux']);
  });

  it('builds compact preview text without leaking markdown tokens', () => {
    expect(
      toPreviewText(
        [
          '# Heading',
          '',
          '> [!note] Alert',
          '> Track [[Roadmap|Plan]] and #research',
          '',
          '- [x] Ship it',
        ].join('\n'),
      ),
    ).toBe('Heading Alert Track Plan and research Ship it');
  });

  it('decorates wiki links and callouts in the editor dom', () => {
    const root = document.createElement('div');
    root.innerHTML = [
      '<div class="milkdown">',
      '<div class="ProseMirror">',
      '<p><a href="wiki:Roadmap">Roadmap</a></p>',
      '<blockquote><p>[!note] Review pending</p><p>Body</p></blockquote>',
      '</div>',
      '</div>',
    ].join('');

    decorateEditorContent(root);

    const editor = root.querySelector('.ProseMirror');
    const wikiLink = root.querySelector('a[href="wiki:Roadmap"]');
    const callout = root.querySelector('blockquote');

    expect(editor?.getAttribute('aria-label')).toBe('Note editor');
    expect(wikiLink?.getAttribute('data-wiki-link')).toBe('true');
    expect(callout?.getAttribute('data-callout-type')).toBe('note');
    expect(callout?.getAttribute('data-callout-title')).toBe('Review pending');
  });
});
