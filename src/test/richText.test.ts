import { describe, expect, it } from 'vitest';

import { markdownToRichHtml, richHtmlToMarkdown } from '../lib/richText';

describe('richText', () => {
  it('renders an empty fenced code block without requiring content lines', () => {
    expect(markdownToRichHtml('```ts')).toContain(
      '<pre><code data-language="ts" class="language-ts"></code></pre>',
    );
  });

  it('round-trips an empty fenced code block', () => {
    const html =
      '<pre><code data-language="ts" class="language-ts"><br data-editor-placeholder="true"></code></pre>';

    expect(richHtmlToMarkdown(html)).toBe('```ts\n\n```');
  });

  it('renders an empty list item instead of dropping it', () => {
    expect(markdownToRichHtml('- item\n- ')).toContain('<ul><li>item</li><li></li></ul>');
  });
});
