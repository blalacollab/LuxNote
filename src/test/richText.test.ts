import { describe, expect, it } from 'vitest';

import {
  extractMarkdownTags,
  markdownToRichHtml,
  richHtmlToMarkdown,
} from '../lib/richText';

describe('richText conversions', () => {
  it('renders single-line breaks as separate paragraphs', () => {
    expect(markdownToRichHtml('alpha\nbeta')).toBe('<p>alpha</p><p>beta</p>');
  });

  it('converts common markdown blocks into rich html', () => {
    const html = markdownToRichHtml([
      '# Heading',
      '',
      '- [x] Done',
      '1. First',
      '',
      '> Quote',
      '',
      '```ts',
      'const value = 1;',
      '```',
      '',
      '| Name | Role |',
      '| --- | --- |',
      '| Lux | Maker |',
      '',
      '---',
    ].join('\n'));

    expect(html).toContain('<h1>Heading</h1>');
    expect(html).toContain('<ul data-task-list="true">');
    expect(html).toContain('<ol>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<pre><code data-language="ts"');
    expect(html).toContain('<table>');
    expect(html).toContain('<hr />');
  });

  it('round-trips rich html blocks back to markdown', () => {
    const markdown = richHtmlToMarkdown([
      '<h2>Roadmap</h2>',
      '<p>alpha<br>beta</p>',
      '<ul data-task-list="true"><li data-checked="true"><span data-task-box="true"></span>Ship</li></ul>',
      '<pre><code data-language="ts">const value = 1;</code></pre>',
      '<table><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody><tr><td>Lux</td><td>Maker</td></tr></tbody></table>',
    ].join(''));

    expect(markdown).toContain('## Roadmap');
    expect(markdown).toContain('alpha\n\nbeta');
    expect(markdown).toContain('- [x] Ship');
    expect(markdown).toContain('```ts\nconst value = 1;\n```');
    expect(markdown).toContain('| Name | Role |');
  });

  it('extracts unique obsidian-style tags', () => {
    expect(
      extractMarkdownTags([
        '# Title',
        'Work on #research and #project/ux',
        'Ignore `#inline-code`',
        'Repeat #research',
      ].join('\n')),
    ).toEqual(['research', 'project/ux']);
  });
});
