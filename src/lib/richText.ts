function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(markdown: string): string {
  let html = escapeHtml(markdown);
  const stash: string[] = [];

  const tokenise = (pattern: RegExp, render: (...args: string[]) => string) => {
    html = html.replace(pattern, (...args) => {
      const value = render(...(args.slice(1, -2) as string[]));
      const token = stash.push(value) - 1;
      return `@@INLINE_${token}@@`;
    });
  };

  tokenise(/`([^`]+)`/g, (code) => `<code>${code}</code>`);
  tokenise(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (alt, src) =>
      `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" />`,
  );
  tokenise(
    /\[\[([^\]]+)\]\]/g,
    (label) =>
      `<a href="wiki:${encodeURIComponent(label)}" data-wiki-link="true">${label}</a>`,
  );
  tokenise(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (label, href) =>
      `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${label}</a>`,
  );

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  html = html.replace(/==([^=]+)==/g, '<mark>$1</mark>');

  return html.replace(/@@INLINE_(\d+)@@/g, (_, index: string) => {
    return stash[Number(index)] ?? '';
  });
}

function flushParagraph(buffer: string[], blocks: string[]): void {
  if (buffer.length === 0) {
    return;
  }

  blocks.push(
    buffer
      .map((line) => `<p>${renderInline(line)}</p>`)
      .join(''),
  );
  buffer.length = 0;
}

interface ListItemRecord {
  checked: boolean | null;
  content: string;
}

function flushUnorderedList(items: ListItemRecord[], blocks: string[]): void {
  if (items.length === 0) {
    return;
  }

  const taskList = items.some((item) => item.checked !== null);
  blocks.push(
    `<ul${taskList ? ' data-task-list="true"' : ''}>${items
      .map((item) => {
        if (item.checked === null) {
          return `<li>${renderInline(item.content)}</li>`;
        }

        return `<li data-checked="${item.checked ? 'true' : 'false'}"><span data-task-box="true"></span>${renderInline(item.content)}</li>`;
      })
      .join('')}</ul>`,
  );
  items.length = 0;
}

function flushOrderedList(items: string[], blocks: string[]): void {
  if (items.length === 0) {
    return;
  }

  blocks.push(
    `<ol>${items
      .map((item) => `<li>${renderInline(item)}</li>`)
      .join('')}</ol>`,
  );
  items.length = 0;
}

function flushQuote(lines: string[], blocks: string[]): void {
  if (lines.length === 0) {
    return;
  }

  const paragraphs = lines.join('\n').split(/\n{2,}/);
  blocks.push(
    `<blockquote>${paragraphs
      .map((paragraph) =>
        paragraph
          .split('\n')
          .filter(Boolean)
          .map((line) => `<p>${renderInline(line)}</p>`)
          .join(''),
      )
      .join('')}</blockquote>`,
  );
  lines.length = 0;
}

function flushCodeBlock(
  lines: string[],
  blocks: string[],
  language: string,
): void {
  if (lines.length === 0) {
    return;
  }

  const languageAttribute = language
    ? ` data-language="${escapeAttribute(language)}"`
    : '';
  const languageClass = language
    ? ` class="language-${escapeAttribute(language)}"`
    : '';

  blocks.push(
    `<pre><code${languageAttribute}${languageClass}>${escapeHtml(
      lines.join('\n'),
    )}</code></pre>`,
  );
  lines.length = 0;
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function flushTable(lines: string[], blocks: string[]): void {
  if (lines.length < 2) {
    for (const line of lines) {
      blocks.push(`<p>${renderInline(line)}</p>`);
    }
    lines.length = 0;
    return;
  }

  const [headerLine, , ...bodyLines] = lines;
  const headers = parseTableRow(headerLine);
  const rows = bodyLines.map(parseTableRow);

  blocks.push(
    `<table><thead><tr>${headers
      .map((cell) => `<th>${renderInline(cell)}</th>`)
      .join('')}</tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td>${renderInline(cell)}</td>`)
            .join('')}</tr>`,
      )
      .join('')}</tbody></table>`,
  );
  lines.length = 0;
}

function flushAll(
  paragraphBuffer: string[],
  unorderedListBuffer: ListItemRecord[],
  orderedListBuffer: string[],
  quoteBuffer: string[],
  tableBuffer: string[],
  blocks: string[],
): void {
  flushParagraph(paragraphBuffer, blocks);
  flushUnorderedList(unorderedListBuffer, blocks);
  flushOrderedList(orderedListBuffer, blocks);
  flushQuote(quoteBuffer, blocks);
  flushTable(tableBuffer, blocks);
}

export function markdownToRichHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  const paragraphBuffer: string[] = [];
  const unorderedListBuffer: ListItemRecord[] = [];
  const orderedListBuffer: string[] = [];
  const quoteBuffer: string[] = [];
  const codeBlockBuffer: string[] = [];
  const tableBuffer: string[] = [];
  let inCodeFence = false;
  let codeFenceLanguage = '';

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();
    const nextLine = lines[index + 1]?.trimEnd() ?? '';

    if (inCodeFence) {
      if (/^```/.test(line.trim())) {
        flushCodeBlock(codeBlockBuffer, blocks, codeFenceLanguage);
        inCodeFence = false;
        codeFenceLanguage = '';
      } else {
        codeBlockBuffer.push(rawLine);
      }
      continue;
    }

    const codeFenceMatch = line.match(/^```([\w-]+)?\s*$/);

    if (codeFenceMatch) {
      flushAll(
        paragraphBuffer,
        unorderedListBuffer,
        orderedListBuffer,
        quoteBuffer,
        tableBuffer,
        blocks,
      );
      inCodeFence = true;
      codeFenceLanguage = codeFenceMatch[1] ?? '';
      continue;
    }

    if (tableBuffer.length > 0) {
      if (line.includes('|') || isTableDivider(line)) {
        tableBuffer.push(line);
        continue;
      }

      flushTable(tableBuffer, blocks);
    }

    if (!line.trim()) {
      flushAll(
        paragraphBuffer,
        unorderedListBuffer,
        orderedListBuffer,
        quoteBuffer,
        tableBuffer,
        blocks,
      );
      continue;
    }

    if (line.includes('|') && isTableDivider(nextLine)) {
      flushParagraph(paragraphBuffer, blocks);
      flushUnorderedList(unorderedListBuffer, blocks);
      flushOrderedList(orderedListBuffer, blocks);
      flushQuote(quoteBuffer, blocks);
      tableBuffer.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    const quoteMatch = line.match(/^>\s?(.*)$/);
    const imageOnlyMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    const horizontalRuleMatch = line.match(/^([-*_])(?:\s*\1){2,}\s*$/);

    if (headingMatch) {
      flushAll(
        paragraphBuffer,
        unorderedListBuffer,
        orderedListBuffer,
        quoteBuffer,
        tableBuffer,
        blocks,
      );
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (horizontalRuleMatch) {
      flushAll(
        paragraphBuffer,
        unorderedListBuffer,
        orderedListBuffer,
        quoteBuffer,
        tableBuffer,
        blocks,
      );
      blocks.push('<hr />');
      continue;
    }

    if (imageOnlyMatch) {
      flushAll(
        paragraphBuffer,
        unorderedListBuffer,
        orderedListBuffer,
        quoteBuffer,
        tableBuffer,
        blocks,
      );
      blocks.push(
        `<p><img src="${escapeAttribute(imageOnlyMatch[2])}" alt="${escapeAttribute(
          imageOnlyMatch[1],
        )}" /></p>`,
      );
      continue;
    }

    if (taskMatch) {
      flushParagraph(paragraphBuffer, blocks);
      flushOrderedList(orderedListBuffer, blocks);
      flushQuote(quoteBuffer, blocks);
      unorderedListBuffer.push({
        checked: taskMatch[1].toLowerCase() === 'x',
        content: taskMatch[2],
      });
      continue;
    }

    if (bulletMatch) {
      flushParagraph(paragraphBuffer, blocks);
      flushOrderedList(orderedListBuffer, blocks);
      flushQuote(quoteBuffer, blocks);
      unorderedListBuffer.push({
        checked: null,
        content: bulletMatch[1],
      });
      continue;
    }

    if (orderedMatch) {
      flushParagraph(paragraphBuffer, blocks);
      flushUnorderedList(unorderedListBuffer, blocks);
      flushQuote(quoteBuffer, blocks);
      orderedListBuffer.push(orderedMatch[1]);
      continue;
    }

    if (quoteMatch) {
      flushParagraph(paragraphBuffer, blocks);
      flushUnorderedList(unorderedListBuffer, blocks);
      flushOrderedList(orderedListBuffer, blocks);
      quoteBuffer.push(quoteMatch[1]);
      continue;
    }

    flushUnorderedList(unorderedListBuffer, blocks);
    flushOrderedList(orderedListBuffer, blocks);
    flushQuote(quoteBuffer, blocks);
    paragraphBuffer.push(line);
  }

  if (inCodeFence) {
    flushCodeBlock(codeBlockBuffer, blocks, codeFenceLanguage);
  }

  flushAll(
    paragraphBuffer,
    unorderedListBuffer,
    orderedListBuffer,
    quoteBuffer,
    tableBuffer,
    blocks,
  );

  return blocks.join('');
}

function isBlockElementTag(tag: string): boolean {
  return [
    'p',
    'div',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'ul',
    'ol',
    'li',
    'pre',
    'hr',
    'table',
  ].includes(tag);
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as HTMLElement;
  const children = Array.from(element.childNodes).map(nodeToMarkdown).join('');

  switch (element.tagName.toLowerCase()) {
    case 'strong':
    case 'b':
      return `**${children}**`;
    case 'em':
    case 'i':
      return `*${children}*`;
    case 'del':
    case 's':
    case 'strike':
      return `~~${children}~~`;
    case 'mark':
      return `==${children}==`;
    case 'code':
      return `\`${element.textContent ?? ''}\``;
    case 'a':
      if ((element.getAttribute('href') ?? '').startsWith('wiki:')) {
        return `[[${decodeURIComponent((element.getAttribute('href') ?? '').slice(5))}]]`;
      }
      return `[${children}](${element.getAttribute('href') ?? ''})`;
    case 'img':
      return `![${element.getAttribute('alt') ?? ''}](${element.getAttribute('src') ?? ''})`;
    case 'br':
      return '\n';
    default:
      return children;
  }
}

function blockToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').trim();
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes).map(nodeToMarkdown).join('').trim();
  const childBlocks = Array.from(element.childNodes)
    .map(blockToMarkdown)
    .filter(Boolean);

  switch (tag) {
    case 'h1':
      return `# ${children}`;
    case 'h2':
      return `## ${children}`;
    case 'h3':
      return `### ${children}`;
    case 'h4':
      return `#### ${children}`;
    case 'h5':
      return `##### ${children}`;
    case 'h6':
      return `###### ${children}`;
    case 'blockquote':
      return childBlocks
        .join('\n\n')
        .split('\n')
        .filter(Boolean)
        .map((line) => `> ${line}`)
        .join('\n');
    case 'ul':
      return Array.from(element.children)
        .map((child) => {
          const checked = child.getAttribute('data-checked');
          const content = Array.from(child.childNodes)
            .filter(
              (entry) =>
                !(
                  entry instanceof HTMLElement &&
                  entry.hasAttribute('data-task-box')
                ),
            )
            .map(nodeToMarkdown)
            .join('')
            .trim();

          if (checked === 'true') {
            return `- [x] ${content}`;
          }

          if (checked === 'false') {
            return `- [ ] ${content}`;
          }

          return `- ${content}`;
        })
        .join('\n');
    case 'ol':
      return Array.from(element.children)
        .map(
          (child, index) =>
            `${index + 1}. ${Array.from(child.childNodes)
              .map(nodeToMarkdown)
              .join('')
              .trim()}`,
        )
        .join('\n');
    case 'pre': {
      const code = element.querySelector('code');
      const language =
        code?.getAttribute('data-language') ??
        code?.className.replace(/^language-/, '') ??
        '';
      const content = code?.textContent ?? element.textContent ?? '';

      return `\`\`\`${language}\n${content}\n\`\`\``;
    }
    case 'hr':
      return '---';
    case 'table': {
      const rows = Array.from(element.querySelectorAll('tr')).map((row) =>
        Array.from(row.children).map((cell) => cell.textContent?.trim() ?? ''),
      );

      if (rows.length === 0) {
        return '';
      }

      const [header, ...body] = rows;
      const divider = header.map(() => '---');

      return [
        `| ${header.join(' | ')} |`,
        `| ${divider.join(' | ')} |`,
        ...body.map((row) => `| ${row.join(' | ')} |`),
      ].join('\n');
    }
    case 'div':
    case 'p': {
      if (
        Array.from(element.children).some((child) =>
          isBlockElementTag(child.tagName.toLowerCase()),
        )
      ) {
        return childBlocks.join('\n\n');
      }

      return children
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n\n');
    }
    default:
      if (element.children.length > 0) {
        return childBlocks.join('\n\n');
      }

      return children;
  }
}

export function richHtmlToMarkdown(html: string): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const blocks = Array.from(container.childNodes)
    .map(blockToMarkdown)
    .map((block) => block.replace(/\n{3,}/g, '\n\n').trim())
    .filter(Boolean);

  return blocks.join('\n\n').trim();
}

export function extractMarkdownTags(markdown: string): string[] {
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ');
  const matches = stripped.matchAll(
    /(^|[^/\p{L}\p{N}_-])#([\p{L}\p{N}_/-]+)/gu,
  );
  const unique = new Set<string>();

  for (const match of matches) {
    if (match[2]) {
      unique.add(match[2]);
    }
  }

  return Array.from(unique);
}
