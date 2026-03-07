export type MarkdownShortcutKind =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'blockquote'
  | 'ul'
  | 'ol'
  | 'codeFence';

function makeEditablePlaceholder(documentRef: Document): HTMLBRElement {
  const placeholder = documentRef.createElement('br');
  placeholder.setAttribute('data-editor-placeholder', 'true');
  return placeholder;
}

export function createEditableParagraph(
  documentRef: Document,
): HTMLParagraphElement {
  const paragraph = documentRef.createElement('p');
  paragraph.append(makeEditablePlaceholder(documentRef));
  return paragraph;
}

export function createEditableCodeBlock(
  documentRef: Document,
  language = '',
): HTMLElement {
  const pre = documentRef.createElement('pre');
  const code = documentRef.createElement('code');

  if (language) {
    code.setAttribute('data-language', language);
    code.className = `language-${language}`;
  }

  code.append(makeEditablePlaceholder(documentRef));
  pre.append(code);

  return pre;
}

function isTextuallyEmpty(element: HTMLElement): boolean {
  return (
    (element.textContent ?? '').replace(/\u00a0/g, '').trim() === '' &&
    !element.querySelector('img,table,hr,pre,ul,ol')
  );
}

export function exitBlockquoteOnEmptyParagraph(
  block: HTMLElement,
): HTMLElement | null {
  const quote =
    block.tagName.toLowerCase() === 'blockquote'
      ? block
      : block.closest('blockquote');

  if (!quote || !quote.parentElement || !isTextuallyEmpty(block)) {
    return null;
  }

  const directChildren = Array.from(quote.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  if (block !== quote && directChildren[directChildren.length - 1] !== block) {
    return null;
  }

  const paragraph = createEditableParagraph(quote.ownerDocument);
  quote.parentElement.insertBefore(paragraph, quote.nextSibling);

  if (block === quote) {
    quote.remove();
    return paragraph;
  }

  block.remove();

  const hasRemainingContent = Array.from(quote.children).some(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  if (!hasRemainingContent) {
    quote.remove();
  }

  return paragraph;
}

export function exitListOnEmptyItem(item: HTMLElement): HTMLElement | null {
  if (item.tagName.toLowerCase() !== 'li' || !isTextuallyEmpty(item)) {
    return null;
  }

  const list = item.parentElement;

  if (!list || !['ul', 'ol'].includes(list.tagName.toLowerCase()) || !list.parentElement) {
    return null;
  }

  const directItems = Array.from(list.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  if (directItems[directItems.length - 1] !== item) {
    return null;
  }

  const paragraph = createEditableParagraph(list.ownerDocument);
  list.parentElement.insertBefore(paragraph, list.nextSibling);
  item.remove();

  if (list.children.length === 0) {
    list.remove();
  }

  return paragraph;
}

export function exitCodeBlockOnEmptyPre(block: HTMLElement): HTMLElement | null {
  if (block.tagName.toLowerCase() !== 'pre' || !block.parentElement || !isTextuallyEmpty(block)) {
    return null;
  }

  const paragraph = createEditableParagraph(block.ownerDocument);
  block.parentElement.insertBefore(paragraph, block.nextSibling);
  block.remove();
  return paragraph;
}

export function insertParagraphAfterBlock(block: HTMLElement): HTMLElement | null {
  if (!block.parentElement) {
    return null;
  }

  const paragraph = createEditableParagraph(block.ownerDocument);
  block.parentElement.insertBefore(paragraph, block.nextSibling);
  return paragraph;
}

export function transformMarkdownShortcutBlock(
  block: HTMLElement,
  kind: MarkdownShortcutKind,
  options?: {
    language?: string;
  },
): HTMLElement | null {
  const ownerDocument = block.ownerDocument;
  const parent = block.parentElement;

  if (!ownerDocument || !parent) {
    return null;
  }

  if (kind === 'ul' || kind === 'ol') {
    const list = ownerDocument.createElement(kind);
    const item = ownerDocument.createElement('li');
    item.append(makeEditablePlaceholder(ownerDocument));
    list.append(item);
    parent.replaceChild(list, block);
    return item;
  }

  if (kind === 'blockquote') {
    const quote = ownerDocument.createElement('blockquote');
    const paragraph = createEditableParagraph(ownerDocument);
    quote.append(paragraph);
    parent.replaceChild(quote, block);
    return paragraph;
  }

  if (kind === 'codeFence') {
    const pre = createEditableCodeBlock(ownerDocument, options?.language ?? '');
    const code = pre.querySelector('code');

    parent.replaceChild(pre, block);
    return code instanceof HTMLElement ? code : pre;
  }

  const heading = ownerDocument.createElement(kind);
  heading.append(makeEditablePlaceholder(ownerDocument));
  parent.replaceChild(heading, block);
  return heading;
}
