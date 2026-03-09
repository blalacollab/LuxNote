import { useEffect, useMemo, useRef, useState } from 'react';

import { writeSceneToLocalStorage } from '../lib/persistence';
import { extractMarkdownTags } from '../lib/markdownDialect';
import type { NoteRecord } from '../lib/types';
import { buildSnapshot, useCanvasStore } from '../store/canvasStore';
import { OutlineNoteEditor } from './OutlineNoteEditor';
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
  ['Slash Menu', '使用本地 outline-editor 模块的完整文档插入与命令体验'],
  ['Settings Button', '点击左下角状态栏中的 Settings 打开设置面板'],
  ['Escape', '退出查看 / 编辑界面'],
];

export function CanvasDialog({ dialog, note }: CanvasDialogProps) {
  const closeDialog = useCanvasStore((state) => state.closeDialog);
  const updateNote = useCanvasStore((state) => state.updateNote);
  const requestDeleteNote = useCanvasStore((state) => state.requestDeleteNote);
  const hudVisible = useCanvasStore((state) => state.preferences.hudVisible);
  const setHudVisible = useCanvasStore((state) => state.setHudVisible);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const activeNoteIdRef = useRef<string | null>(null);
  const bodyDraftRef = useRef('');
  const editorValueGetterRef = useRef<(() => string) | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const tags = useMemo(() => extractMarkdownTags(bodyDraft), [bodyDraft]);

  const commitBodySync = (
    nextBody = bodyDraftRef.current,
    noteId = activeNoteIdRef.current,
  ) => {

    if (!noteId) {
      return;
    }

    const liveNote = useCanvasStore.getState().notes[noteId];

    if (!liveNote) {
      return;
    }

    if (liveNote.body === nextBody) {
      return;
    }

    updateNote(noteId, {
      body: nextBody,
    });
  };

  const syncBodyDraft = (nextBody: string) => {
    if (nextBody === bodyDraftRef.current) {
      return;
    }

    bodyDraftRef.current = nextBody;
    setBodyDraft(nextBody);
    commitBodySync(nextBody);
  };

  const flushDraftToStorage = () => {
    const liveBody = editorValueGetterRef.current?.() ?? bodyDraftRef.current;

    if (liveBody !== bodyDraftRef.current) {
      bodyDraftRef.current = liveBody;
      setBodyDraft(liveBody);
    }

    commitBodySync(liveBody);

    const state = useCanvasStore.getState();

    if (!state.isHydrated) {
      return;
    }

    writeSceneToLocalStorage(buildSnapshot(state));
  };

  const handleRequestClose = () => {
    flushDraftToStorage();
    closeDialog();

    const state = useCanvasStore.getState();

    if (state.isHydrated) {
      writeSceneToLocalStorage(buildSnapshot(state));
    }
  };

  useEffect(() => {
    commitBodySync();
    activeNoteIdRef.current = note?.id ?? null;

    if (dialog?.type === 'note' && note) {
      setTitleDraft(note.title);
      setBodyDraft(note.body);
      bodyDraftRef.current = note.body;
      return;
    }

    setTitleDraft('');
    setBodyDraft('');
    bodyDraftRef.current = '';
  }, [dialog?.type, note?.id]);

  useEffect(() => {
    const element = titleRef.current;

    if (!element) {
      return;
    }

    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  }, [dialog, note?.id, titleDraft]);

  useEffect(() => {
    if (dialog?.type !== 'note') {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushDraftToStorage();
      }
    };

    window.addEventListener('pagehide', flushDraftToStorage);
    window.addEventListener('beforeunload', flushDraftToStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushDraftToStorage);
      window.removeEventListener('beforeunload', flushDraftToStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dialog?.type, note?.id]);

  useEffect(() => {
    return () => {
      flushDraftToStorage();
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
          handleRequestClose();
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
                onClick={handleRequestClose}
              >
                ← Back
              </button>
            </div>

            <div className={styles.topbarGroup}>
              <button
                type="button"
                className={styles.navButton}
                data-danger="true"
                onClick={() => {
                  requestDeleteNote(note.id);
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
                      Use `#tag` or `[[Wiki Link]]` in the note body.
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.editorPanel}>
                <div className={styles.editorViewport}>
                  <OutlineNoteEditor
                    editorKey={note.id}
                    value={bodyDraft}
                    defaultValue={note.body}
                    onChange={(nextMarkdown) => {
                      syncBodyDraft(nextMarkdown);
                    }}
                    onRegisterValueGetter={(getter) => {
                      editorValueGetterRef.current = getter;
                    }}
                    onBlur={() => {
                      flushDraftToStorage();
                    }}
                    onClickLink={(href) => {
                      if (/^https?:\/\//i.test(href)) {
                        window.open(href, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  />
                </div>
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
                  <strong>Show status metrics</strong>
                  <p className={styles.hint}>
                    左下角 Settings 按钮始终保留；关闭后只隐藏缩放倍数和当前视口中心坐标。
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
