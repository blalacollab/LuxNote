import { useEffect, useMemo, useRef, useState } from 'react';

import type { NoteRecord } from '../lib/types';
import {
  extractMarkdownTags,
  markdownToRichHtml,
  richHtmlToMarkdown,
} from '../lib/richText';
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
  ['Ctrl/Cmd + B / I / K', '直接编辑粗体、斜体与链接'],
  ['Type # / - / 1. / >', '输入 Markdown 前缀后按空格直接转成标题、列表、引用'],
  ['Enter In List', '在所见即所得模式下续写列表'],
  ['Enter', '打开当前选中笔记'],
  ['P', '将选中笔记重新居中'],
  ['Shift + /', '调出隐藏设置笔记'],
  ['Escape', '退出查看 / 编辑界面'],
];

function runExecCommand(command: string, value?: string): void {
  if (typeof document.execCommand === 'function') {
    document.execCommand(command, false, value);
  }
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

export function CanvasDialog({ dialog, note }: CanvasDialogProps) {
  const closeDialog = useCanvasStore((state) => state.closeDialog);
  const updateNote = useCanvasStore((state) => state.updateNote);
  const deleteSelectedNote = useCanvasStore((state) => state.deleteSelectedNote);
  const focusNote = useCanvasStore((state) => state.focusNote);
  const hudVisible = useCanvasStore((state) => state.preferences.hudVisible);
  const setHudVisible = useCanvasStore((state) => state.setHudVisible);

  const editorRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef('');
  const [titleDraft, setTitleDraft] = useState('');
  const tags = useMemo(
    () => extractMarkdownTags(note?.body ?? bodyRef.current),
    [note?.body],
  );

  useEffect(() => {
    if (dialog?.type === 'note' && note) {
      setTitleDraft(note.title);

      if (editorRef.current) {
        runExecCommand('defaultParagraphSeparator', 'p');
        editorRef.current.innerHTML = markdownToRichHtml(note.body || '');
      }

      bodyRef.current = note.body || '';
    }
  }, [dialog, note?.id]);

  const syncEditorToStore = () => {
    if (!note) {
      return;
    }

    const html = editorRef.current?.innerHTML ?? '';
    const markdown = richHtmlToMarkdown(html);

    if (markdown === bodyRef.current) {
      return;
    }

    bodyRef.current = markdown;
    updateNote(note.id, { body: markdown });
  };

  const executeRichCommand = (command: string, value?: string) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    runExecCommand(command, value);
    requestAnimationFrame(() => {
      syncEditorToStore();
    });
  };

  const handleMarkdownShortcut = (): boolean => {
    if (!editorRef.current) {
      return false;
    }

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      return false;
    }

    const block = findBlockElement(selection.anchorNode, editorRef.current);

    if (!block) {
      return false;
    }

    if (!selection.anchorNode) {
      return false;
    }

    const prefixRange = selection.getRangeAt(0).cloneRange();
    prefixRange.selectNodeContents(block);
    prefixRange.setEnd(selection.anchorNode, selection.anchorOffset);

    const beforeCaret = prefixRange.toString().replace(/\u00a0/g, ' ');
    const fullText = (block.textContent ?? '').replace(/\u00a0/g, ' ').trim();

    if (beforeCaret.trim() !== fullText) {
      return false;
    }

    const prefix = beforeCaret.trim();
    let command: [string, string?] | null = null;

    if (prefix === '#') {
      command = ['formatBlock', '<h1>'];
    } else if (prefix === '##') {
      command = ['formatBlock', '<h2>'];
    } else if (prefix === '###') {
      command = ['formatBlock', '<h3>'];
    } else if (prefix === '>') {
      command = ['formatBlock', '<blockquote>'];
    } else if (prefix === '-' || prefix === '*') {
      command = ['insertUnorderedList'];
    } else if (/^\d+\.$/.test(prefix)) {
      command = ['insertOrderedList'];
    }

    if (!command) {
      return false;
    }

    block.textContent = '';
    placeCaretAtStart(block);
    executeRichCommand(command[0], command[1]);
    return true;
  };

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
                <input
                  className={styles.titleInput}
                  value={titleDraft}
                  onChange={(event) => {
                    setTitleDraft(event.target.value);
                    updateNote(note.id, { title: event.target.value });
                  }}
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
                      No tags. Use Obsidian syntax like `#research` or `#project/ux`.
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.editorPanel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Editor</span>
                  <span className={styles.panelHint}>
                    {'`Ctrl/Cmd + B / I / K`, `# `, `- `, `1. `, `> `, ` ``` `'}
                  </span>
                </div>

                <div
                  ref={editorRef}
                  aria-label="Note editor"
                  className={styles.richEditor}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck
                  data-placeholder="Start writing. Markdown is stored in the background, but the editor stays in WYSIWYG mode."
                  onInput={() => syncEditorToStore()}
                  onFocus={() => {
                    runExecCommand('defaultParagraphSeparator', 'p');
                  }}
                  onBlur={() => {
                    if (editorRef.current) {
                      editorRef.current.innerHTML = markdownToRichHtml(
                        bodyRef.current,
                      );
                    }
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
                          ? findBlockElement(selection.anchorNode, editorRef.current)
                          : null;

                      if (block && block.tagName.toLowerCase() !== 'li') {
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
