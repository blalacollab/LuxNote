const CODE_SEGMENT_PATTERN = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`/g;
const WIKI_LINK_PATTERN =
  /(?<!!)\[\[([^[\]\n|]+?)(?:\|([^[\]\n]+?))?\]\]/g;
const WIKI_URL_PATTERN = /\[([^\]\n]+)\]\(wiki:([^)]+)\)/g;
const TAG_PATTERN = /(^|[^/\p{L}\p{N}_-])#([\p{L}\p{N}_/-]+)/gu;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function transformOutsideCode(
  markdown: string,
  transform: (segment: string) => string,
): string {
  const normalized = normalizeLineEndings(markdown);
  let cursor = 0;
  let result = '';

  for (const match of normalized.matchAll(CODE_SEGMENT_PATTERN)) {
    const [segment] = match;
    const start = match.index ?? 0;
    result += transform(normalized.slice(cursor, start));
    result += segment;
    cursor = start + segment.length;
  }

  result += transform(normalized.slice(cursor));
  return result;
}

function encodeWikiTarget(value: string): string {
  return encodeURIComponent(value.trim());
}

function decodeWikiTarget(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

function escapeLinkLabel(value: string): string {
  return value.replace(/([\[\]\\])/g, '\\$1');
}

function unescapeLinkLabel(value: string): string {
  return value.replace(/\\([\[\]\\])/g, '$1');
}

export function prepareMarkdownForEditor(markdown: string): string {
  return transformOutsideCode(markdown, (segment) =>
    segment.replace(WIKI_LINK_PATTERN, (match, target: string, alias?: string) => {
      const trimmedTarget = target.trim();
      const label = (alias ?? target).trim();

      if (!trimmedTarget || !label) {
        return match;
      }

      return `[${escapeLinkLabel(label)}](wiki:${encodeWikiTarget(trimmedTarget)})`;
    }),
  );
}

export function normalizeEditorMarkdown(markdown: string): string {
  return transformOutsideCode(markdown, (segment) =>
    segment.replace(WIKI_URL_PATTERN, (match, label: string, href: string) => {
      const target = decodeWikiTarget(href);
      const cleanLabel = unescapeLinkLabel(label.trim());

      if (!target) {
        return match;
      }

      if (!cleanLabel || cleanLabel === target) {
        return `[[${target}]]`;
      }

      return `[[${target}|${cleanLabel}]]`;
    }),
  ).replace(/\s+$/u, '');
}

function stripForTagScan(markdown: string): string {
  return normalizeLineEndings(markdown)
    .replace(CODE_SEGMENT_PATTERN, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\bhttps?:\/\/[^\s)]+/g, ' ');
}

export function extractMarkdownTags(markdown: string): string[] {
  const matches = stripForTagScan(markdown).matchAll(TAG_PATTERN);
  const unique = new Set<string>();

  for (const match of matches) {
    if (match[2]) {
      unique.add(match[2]);
    }
  }

  return Array.from(unique);
}

export function toPreviewText(markdown: string): string {
  return normalizeLineEndings(markdown)
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/!\[\[([^[\]]+)\]\]/g, '$1')
    .replace(WIKI_LINK_PATTERN, (_match, target: string, alias?: string) =>
      (alias ?? target).trim(),
    )
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s+\[![^\]]+\]\s*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^\|/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/^\s*---+\s*$/gm, ' ')
    .replace(TAG_PATTERN, '$1$2')
    .replace(/[>*_~`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decorateEditorContent(root: HTMLElement): void {
  const proseMirror = root.querySelector<HTMLElement>('.ProseMirror');

  if (proseMirror) {
    proseMirror.setAttribute('role', 'textbox');
    proseMirror.setAttribute('aria-label', 'Note editor');
    proseMirror.setAttribute('spellcheck', 'true');
  }

  root.querySelectorAll<HTMLAnchorElement>('a[href^="wiki:"]').forEach((link) => {
    link.dataset.wikiLink = 'true';
  });

  root.querySelectorAll<HTMLElement>('blockquote').forEach((blockquote) => {
    delete blockquote.dataset.calloutType;
    delete blockquote.dataset.calloutTitle;

    const firstParagraph = blockquote.querySelector('p');
    const firstLine = firstParagraph?.textContent?.trimStart() ?? '';
    const match = firstLine.match(/^\[!([\w-]+)\](?:\s+([^\n]+))?/i);

    if (!match) {
      return;
    }

    blockquote.dataset.calloutType = match[1].toLowerCase();

    if (match[2]?.trim()) {
      blockquote.dataset.calloutTitle = match[2].trim();
    }
  });
}
