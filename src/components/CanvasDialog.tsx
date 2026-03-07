import { useEffect, useMemo, useRef, useState } from 'react';

import { extractMarkdownTags } from '../lib/markdownDialect';
import {
  exitCodeBlockOnEmptyPre,
  exitListOnEmptyItem,
  insertParagraphAfterBlock,
  exitBlockquoteOnEmptyParagraph,
  transformMarkdownShortcutBlock,
  type MarkdownShortcutKind,
} from '../lib/editorTransforms';
import { markdownToRichHtml, richHtmlToMarkdown } from '../lib/richText';
import type { NoteRecord } from '../lib/types';
import { useCanvasStore } from '../store/canvasStore';
import styles from './CanvasDialog.module.css';

type DialogState =
  | {
      type: 'note';
      noteId: string;
    }
  | {
      type: 'settings';
    }
  | null;

interface CanvasDialogProps {
  dialog: DialogState;
  note: NoteRecord | null;
}

const SHORTCUTS = [
  ['Ctrl/Cmd + N', '新建笔记并进入全屏编辑界面'],
  ['Double Click', '在当前指针位置创建笔记'],
  ['Wheel', '直接以鼠标位置缩放画板'],
  ['Drag Background', '直接拖动画布平移视图'],
  ['Drag Note', '直接移动笔记位置'],
  ['Ctrl/Cmd + B / I / K', '正文中使用粗体、斜体与链接'],
  ['Type # / - / 1. / >', '输入 Markdown 前缀后按空格，将当前块转换为格式块'],
  ['Shift + /', '调出隐藏设置笔记'],
  ['Escape', '退出查看 / 编辑界面'],
];

const BODY_SYNC_DEBOUNCE_MS = 140;

function runExecCommand(command: string, value?: string): void {
  if (typeof document.execCommand === 'function') {
    document.execCommand(command, false, value);
  }
}

function insertPlainTextAtSelection(text: string): void {
  if (typeof document.execCommand === 'function') {
    document.execCommand('insertText', false, text);
    return;
  }

  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const fragment = document.createDocumentFragment();
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.append(document.createElement('br'));
    }

    if (line.length > 0) {
      fragment.append(document.createTextNode(line));
    }
  });

  const tail = fragment.lastChild;
  range.insertNode(fragment);

  if (!tail) {
    return;
  }

  range.setStartAfter(tail);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtStart(element: HTMLElement): void {
  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtEnd(element: HTMLElement): void {
  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function findBlockElement(
  node: Node | null,
  root: HTMLElement,
): HTMLElement | null {
  let current: HTMLElement | null =
    node instanceof HTMLElement ? node : node?.parentElement ?? null;

  while (current && current !== root) {
    const tag = current.tagName.toLowerCase();

    if (
      tag === 'p' ||
      tag === 'div' ||
      tag === 'li' ||
      tag === 'blockquote' ||
      tag === 'h1' ||
      tag === 'h2' ||
      tag === 'h3' ||
      tag === 'h4' ||
      tag === 'h5' ||
      tag === 'h6' ||
      tag === 'pre'
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return root;
}

function resolveSelectionBlock(
  selection: Selection,
  root: HTMLElement,
): HTMLElement | null {
  const anchorNode = selection.anchorNode;
  const candidates: Node[] = [];

  if (anchorNode) {
    candidates.push(anchorNode);

    if (anchorNode instanceof Element) {
      const previousNode =
        selection.anchorOffset > 0
          ? anchorNode.childNodes[selection.anchorOffset - 1] ?? null
          : null;
      const nextNode = anchorNode.childNodes[selection.anchorOffset] ?? null;

      if (previousNode) {
        candidates.unshift(previousNode);
      }

      if (nextNode) {
        candidates.unshift(nextNode);
      }
    }
  }

  for (const candidate of candidates) {
    const block = findBlockElement(candidate, root);

    if (block && block !== root) {
      return block;
    }
  }

  return findBlockElement(anchorNode, root);
}

function isAtomicImageBlock(block: HTMLElement): boolean {
  if (block.tagName.toLowerCase() !== 'p') {
    return false;
  }

  if ((block.textContent ?? '').replace(/\u00a0/g, '').trim() !== '') {
    return false;
  }

  return block.children.length === 1 && block.firstElementChild?.tagName.toLowerCase() === 'img';
}

export function CanvasDialog({ dialog, note }: CanvasDialogProps) {
  const closeDialog = useCanvasStore((state) => state.closeDialog);
  const updateNote = useCanvasStore((state) => state.updateNote);
  const deleteSelectedNote = useCanvasStore((state) => state.deleteSelectedNote);
  const focusNote = useCanvasStore((state) => state.focusNote);
  const hudVisible = useCanvasStore((state) => state.preferences.hudVisible);
  const setHudVisible = useCanvasStore((state) => state.setHudVisible);

  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef('');
  const syncTimerRef = useRef<number | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const tags = useMemo(() => extractMarkdownTags(note?.body ?? ''), [note?.body]);

  const clearSyncTimer = () => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  };

  const renderEditorFromMarkdown = (
    markdown: string,
    caret: 'start' | 'end' | null = null,
  ) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.innerHTML = markdownToRichHtml(markdown);
    editorRef.current.dataset.empty = markdown.trim() ? 'false' : 'true';

    if (caret === 'start') {
      const firstBlock =
        editorRef.current.querySelector<HTMLElement>(
          'p, h1, h2, h3, h4, h5, h6, li, blockquote p, pre, div',
        ) ?? editorRef.current;
      placeCaretAtStart(firstBlock);
      return;
    }

    if (caret === 'end') {
      const blocks = editorRef.current.querySelectorAll<HTMLElement>(
        'p, h1, h2, h3, h4, h5, h6, li, blockquote p, pre, div',
      );
      const lastBlock = blocks.item(blocks.length - 1) ?? editorRef.current;
      placeCaretAtEnd(lastBlock);
    }
  };

  const syncEditorToStore = (immediate = false) => {
    if (!note) {
      return;
    }

    const commit = () => {
      syncTimerRef.current = null;
      const html = editorRef.current?.innerHTML ?? '';
      const markdown = richHtmlToMarkdown(html);

      if (markdown === bodyRef.current) {
        return;
      }

      bodyRef.current = markdown;
      updateNote(note.id, { body: markdown });
    };

    clearSyncTimer();

    if (immediate) {
      commit();
      return;
    }

    syncTimerRef.current = window.setTimeout(commit, BODY_SYNC_DEBOUNCE_MS);
  };

  const executeRichCommand = (command: string, value?: string) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    runExecCommand(command, value);
    syncEditorToStore();
  };

  const handleMarkdownShortcut = (): boolean => {
    if (!editorRef.current) {
      return false;
    }

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      return false;
    }

    const block = resolveSelectionBlock(selection, editorRef.current);

    if (!block || !selection.anchorNode) {
      return false;
    }

    const prefixRange = selection.getRangeAt(0).cloneRange();
    prefixRange.selectNodeContents(block);
    prefixRange.setEnd(selection.anchorNode, selection.anchorOffset);

    const beforeCaret = prefixRange.toString().replace(/\u00a0/g, ' ');
    const fullText = (block.textContent ?? '').replace(/\u00a0/g, ' ').trim();

    if (beforeCaret.trim() !== fullText || block === editorRef.current) {
      return false;
    }

    const prefix = beforeCaret.trim();
    let transformKind: MarkdownShortcutKind | null = null;

    if (prefix === '#') {
      transformKind = 'h1';
    } else if (prefix === '##') {
      transformKind = 'h2';
    } else if (prefix === '###') {
      transformKind = 'h3';
    } else if (prefix === '>') {
      transformKind = 'blockquote';
    } else if (prefix === '-' || prefix === '*') {
      transformKind = 'ul';
    } else if (/^\d+\.$/.test(prefix)) {
      transformKind = 'ol';
    }

    if (!transformKind) {
      return false;
    }

    const nextEditable = transformMarkdownShortcutBlock(block, transformKind);

    if (!nextEditable) {
      return false;
    }

    placeCaretAtStart(nextEditable);
    syncEditorToStore();
    return true;
  };

  useEffect(() => {
    if (dialog?.type === 'note' && note) {
      setTitleDraft(note.title);
      bodyRef.current = note.body || '';
      clearSyncTimer();
      renderEditorFromMarkdown(bodyRef.current);
    }
  }, [dialog, note?.id]);

  useEffect(() => {
    const element = titleRef.current;

    if (!element) {
      return;
    }

    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  }, [dialog, note?.id, titleDraft]);

  useEffect(() => {
    return () => {
      clearSyncTimer();
    };
  }, []);

  if (!dialog) {
    return null;
  }

  return (
    <div
      data-dialog-surface="true"
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      {dialog.type === 'note' && note ? (
        <section className={styles.noteScreen}>
          <header className={styles.topbar}>
            <div className={styles.topbarGroup}>
              <button
                type="button"
                className={styles.navButton}
                onClick={closeDialog}
              >
                ← Back
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => focusNote(note.id)}
              >
                Locate
              </button>
            </div>

            <div className={styles.topbarGroup}>
              <button
                type="button"
                className={styles.navButton}
                data-danger="true"
                onClick={() => {
                  deleteSelectedNote();
                  closeDialog();
                }}
              >
                Delete
              </button>
            </div>
          </header>

          <div
            className={styles.editorShell}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className={styles.editorFrame}>
              <div className={styles.documentHeader}>
                <textarea
                  ref={titleRef}
                  aria-label="Note title"
                  className={styles.titleInput}
                  value={titleDraft}
                  onChange={(event) => {
                    const nextTitle = event.target.value;
                    setTitleDraft(nextTitle);

                    if (nextTitle !== note.title) {
                      updateNote(note.id, { title: nextTitle });
                    }
                  }}
                  rows={1}
                  placeholder="Untitled note"
                />

                <div className={styles.documentMeta}>
                  <span className={styles.tagLabel}>Tags</span>
                  {tags.length > 0 ? (
                    tags.map((tag) => (
                      <span key={tag} className={styles.metaChip}>
                        #{tag}
                      </span>
                    ))
                  ) : (
                    <span className={styles.tagPlaceholder}>
                      No tags yet. Use `#research`, `#project/ux`, or `[[Wiki Links]]`
                      in the document body.
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.editorPanel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Document</span>
                  <span className={styles.panelHint}>
                    WYSIWYG editor with markdown-backed storage
                  </span>
                </div>

                <div
                  ref={editorRef}
                  aria-label="Note editor"
                  aria-multiline="true"
                  role="textbox"
                  className={styles.richEditor}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck
                  data-placeholder="Start writing. Markdown is stored in the background while the editor stays in WYSIWYG mode."
                  data-empty={bodyRef.current.trim() ? 'false' : 'true'}
                  onInput={() => {
                    if (editorRef.current) {
                      editorRef.current.dataset.empty = 'false';
                    }

                    syncEditorToStore();
                  }}
                  onFocus={() => {
                    runExecCommand('defaultParagraphSeparator', 'p');

                    if (editorRef.current && !editorRef.current.innerHTML.trim()) {
                      renderEditorFromMarkdown('', 'start');
                    }
                  }}
                  onBlur={() => {
                    syncEditorToStore(true);
                    renderEditorFromMarkdown(bodyRef.current);
                  }}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
                      switch (event.key.toLowerCase()) {
                        case 'b':
                          event.preventDefault();
                          executeRichCommand('bold');
                          return;
                        case 'i':
                          event.preventDefault();
                          executeRichCommand('italic');
                          return;
                        case 'k': {
                          event.preventDefault();
                          const url = window.prompt('Link URL', 'https://');

                          if (url) {
                            executeRichCommand('createLink', url);
                          }
                          return;
                        }
                        default:
                          break;
                      }
                    }

                    if (event.key === 'Tab') {
                      event.preventDefault();
                      executeRichCommand(event.shiftKey ? 'outdent' : 'indent');
                      return;
                    }

                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.altKey
                    ) {
                      const selection = window.getSelection();
                      const block =
                        selection && editorRef.current
                          ? resolveSelectionBlock(selection, editorRef.current)
                          : null;

                      if (block) {
                        const fullText = (block.textContent ?? '')
                          .replace(/\u00a0/g, ' ')
                          .trim();
                        const codeFenceMatch = fullText.match(/^```([\w-]*)$/);

                        if (
                          codeFenceMatch &&
                          (block.tagName.toLowerCase() === 'p' ||
                            block.tagName.toLowerCase() === 'div')
                        ) {
                          const codeBlock = transformMarkdownShortcutBlock(
                            block,
                            'codeFence',
                            {
                              language: codeFenceMatch[1] ?? '',
                            },
                          );

                          if (codeBlock) {
                            event.preventDefault();
                            placeCaretAtStart(codeBlock);
                            syncEditorToStore(true);
                            return;
                          }
                        }

                        if (isAtomicImageBlock(block)) {
                          const nextParagraph = insertParagraphAfterBlock(block);

                          if (nextParagraph) {
                            event.preventDefault();
                            placeCaretAtStart(nextParagraph);
                            syncEditorToStore();
                            return;
                          }
                        }

                        const exitListParagraph = exitListOnEmptyItem(block);

                        if (exitListParagraph) {
                          event.preventDefault();
                          placeCaretAtStart(exitListParagraph);
                          syncEditorToStore();
                          return;
                        }

                        const exitParagraph = exitBlockquoteOnEmptyParagraph(block);

                        if (exitParagraph) {
                          event.preventDefault();
                          placeCaretAtStart(exitParagraph);
                          syncEditorToStore();
                          return;
                        }

                        const exitCodeParagraph = exitCodeBlockOnEmptyPre(block);

                        if (exitCodeParagraph) {
                          event.preventDefault();
                          placeCaretAtStart(exitCodeParagraph);
                          syncEditorToStore(true);
                          return;
                        }
                      }

                      if (
                        block &&
                        block.tagName.toLowerCase() !== 'li' &&
                        block.tagName.toLowerCase() !== 'pre'
                      ) {
                        event.preventDefault();
                        executeRichCommand('insertParagraph');
                        return;
                      }
                    }

                    if (
                      event.key === ' ' &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.altKey &&
                      handleMarkdownShortcut()
                    ) {
                      event.preventDefault();
                    }
                  }}
                  onPaste={(event) => {
                    const text = event.clipboardData?.getData('text/plain');

                    if (typeof text !== 'string') {
                      return;
                    }

                    event.preventDefault();
                    insertPlainTextAtSelection(text);
                    syncEditorToStore(true);
                    renderEditorFromMarkdown(bodyRef.current, 'end');
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.settingsScreen}>
          <header className={styles.topbar}>
            <div className={styles.topbarGroup}>
              <button
                type="button"
                className={styles.navButton}
                onClick={closeDialog}
              >
                ← Back
              </button>
            </div>
          </header>

          <div className={styles.settingsLayout}>
            <section className={styles.settingsPanel}>
              <p className={styles.eyebrow}>System Note</p>
              <h2 className={styles.screenTitle}>Control Archive</h2>

              <div className={styles.settingRow}>
                <div>
                  <strong>Show status bar</strong>
                  <p className={styles.hint}>
                    左下角仅显示缩放倍数和当前视口中心坐标，默认隐藏，鼠标靠近角落时浮出。
                  </p>
                </div>
                <input
                  className={styles.toggle}
                  type="checkbox"
                  checked={hudVisible}
                  onChange={(event) => setHudVisible(event.target.checked)}
                />
              </div>

              <div className={styles.settingRow}>
                <div>
                  <strong>Mouse-first interaction</strong>
                  <p className={styles.hint}>
                    画布支持直接拖动平移、滚轮缩放、点击笔记、拖拽笔记。连接笔记只在默认画布视图中可用。
                  </p>
                </div>
              </div>
            </section>

            <section className={styles.settingsPanel}>
              <p className={styles.eyebrow}>Usage Manual</p>
              <h2 className={styles.screenTitle}>Shortcuts And Gestures</h2>
              <div className={styles.shortcuts}>
                {SHORTCUTS.map(([key, label]) => (
                  <div key={key} className={styles.shortcutRow}>
                    <span className={styles.kbd}>{key}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
