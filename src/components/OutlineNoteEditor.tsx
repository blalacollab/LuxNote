import { useEffect, useMemo, useRef, useState } from 'react';

import { StyleSheetManager, ThemeProvider } from 'styled-components';

import { outlineEmbeds } from '../lib/outlineEmbeds';
import { decorateEditorContent } from '../lib/markdownDialect';
import { createOutlineTheme } from '../lib/outlineTheme';
import {
  loadOutlineEditorRuntime,
  type EditorDataAdapter,
} from '../modules/outline-editor';

export interface OutlineNoteEditorProps {
  editorKey: string;
  value: string;
  defaultValue: string;
  placeholder?: string;
  onChange: (markdown: string) => void;
  onRegisterValueGetter?: (getter: (() => string) | null) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onClickLink?: (href: string) => void;
}

interface OutlineEditorHandle {
  value?: (asString?: boolean, trim?: boolean) => unknown;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'));
    };
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Unexpected file reader result'));
    };
    reader.readAsDataURL(file);
  });
}

function openExternalLink(href: string): void {
  if (!/^https?:\/\//i.test(href)) {
    return;
  }

  window.open(href, '_blank', 'noopener,noreferrer');
}

const blockedDomProps = new Set([
  'active',
  'arrow',
  'commenting',
  'userId',
  'editorStyle',
]);
type OutlineRuntimeModule = Awaited<ReturnType<typeof loadOutlineEditorRuntime>>;

function shouldForwardProp(propName: string, target: unknown) {
  if (typeof target !== 'string') {
    return true;
  }

  if (propName.startsWith('data-') || propName.startsWith('aria-')) {
    return true;
  }

  return !blockedDomProps.has(propName);
}

export function OutlineNoteEditor({
  editorKey,
  value,
  defaultValue,
  placeholder = 'Start writing. Markdown is stored directly while the editor stays fully interactive.',
  onChange,
  onRegisterValueGetter,
  onBlur,
  onFocus,
  onClickLink,
}: OutlineNoteEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<OutlineEditorHandle | null>(null);
  const decorateFrameRef = useRef<number | null>(null);
  const changeFrameRef = useRef<number | null>(null);
  const hasUserInteractedRef = useRef(false);
  const [runtime, setRuntime] = useState<OutlineRuntimeModule | null>(null);
  const [runtimeLoadFailed, setRuntimeLoadFailed] = useState(false);
  const valueGetterRef = useRef<(() => string) | null>(null);
  const initialValueRef = useRef('');
  const readLiveMarkdownRef = useRef<() => string>(() => '');
  const runtimeUserId = 'luxnote-local-user';
  const initialValue = value || defaultValue;
  const theme = useMemo(() => createOutlineTheme(), []);
  const RuntimeEditor = runtime?.Editor as any;
  const extensions = useMemo(
    () =>
      runtime?.createDocumentUIPreset({
        enableFindAndReplace: true,
        enableDiagrams: true,
      }) as unknown[] | undefined,
    [runtime],
  );
  const hostAdapter = useMemo<EditorDataAdapter>(
    () => ({
      searchMentions: async () => [],
      searchDocuments: async () => [],
      resolveInternalLink: async () => undefined,
      checkEmbed: async ({ url }) => ({
        embeddable: /^https?:\/\//i.test(url),
      }),
      validateMentionNotification: async () => ({
        notify: false,
      }),
    }),
    [],
  );
  const handleLocalUpload = async (file: File | string) => {
    if (typeof file === 'string') {
      return file;
    }

    return readFileAsDataUrl(file);
  };

  useEffect(() => {
    let mounted = true;
    setRuntimeLoadFailed(false);

    void loadOutlineEditorRuntime()
      .then((nextRuntime) => {
        if (mounted) {
          setRuntime(nextRuntime);
          setRuntimeLoadFailed(false);
        }
      })
      .catch((error) => {
        if (mounted) {
          setRuntimeLoadFailed(true);
        }
        console.error('Failed to load outline editor runtime', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    hasUserInteractedRef.current = false;
  }, [editorKey]);

  useEffect(() => {
    const getter = () => readLiveMarkdownRef.current();

    onRegisterValueGetter?.(getter);

    return () => {
      onRegisterValueGetter?.(null);
    };
  }, [editorKey, onRegisterValueGetter]);

  useEffect(() => {
    readLiveMarkdownRef.current = () => {
      if (!hasUserInteractedRef.current) {
        return initialValueRef.current;
      }

      const liveValue = editorRef.current?.value?.(true, false);

      if (typeof liveValue === 'string') {
        return liveValue;
      }

      if (liveValue !== undefined && liveValue !== null) {
        return String(liveValue);
      }

      if (valueGetterRef.current) {
        return valueGetterRef.current();
      }

      return initialValueRef.current;
    };
  }, [editorKey]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const decorate = () => {
      decorateFrameRef.current = null;
      decorateEditorContent(root);
    };
    const scheduleDecorate = () => {
      if (decorateFrameRef.current !== null) {
        return;
      }

      decorateFrameRef.current = window.requestAnimationFrame(decorate);
    };

    scheduleDecorate();

    if (typeof MutationObserver === 'undefined') {
      return () => {
        if (decorateFrameRef.current !== null) {
          window.cancelAnimationFrame(decorateFrameRef.current);
          decorateFrameRef.current = null;
        }
      };
    }

    const observer = new MutationObserver(() => {
      scheduleDecorate();
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (decorateFrameRef.current !== null) {
        window.cancelAnimationFrame(decorateFrameRef.current);
        decorateFrameRef.current = null;
      }
      if (changeFrameRef.current !== null) {
        window.cancelAnimationFrame(changeFrameRef.current);
        changeFrameRef.current = null;
      }
    };
  }, [editorKey]);

  return (
    <div
      ref={rootRef}
      className="luxnoteOutlineEditorScope"
      data-note-editor-root="true"
      data-note-id={editorKey}
      onPointerDownCapture={() => {
        hasUserInteractedRef.current = true;
      }}
      onKeyDownCapture={() => {
        hasUserInteractedRef.current = true;
      }}
      onWheelCapture={(event) => {
        event.stopPropagation();
      }}
    >
      <StyleSheetManager shouldForwardProp={shouldForwardProp}>
        <ThemeProvider theme={theme as any}>
          {runtime && extensions ? (
            <RuntimeEditor
              ref={editorRef as any}
              key={editorKey}
              id={`luxnote-outline-editor-${editorKey}`}
              userId={runtimeUserId}
              defaultValue={initialValue}
              placeholder={placeholder}
              dictionary={runtime.defaultDictionary}
              embeds={outlineEmbeds as any}
              uploadFile={handleLocalUpload}
              extensions={extensions as any}
              hostAdapter={hostAdapter}
              editorStyle={{
                padding: '8px var(--editor-pad-x, 42px) 72px',
              }}
              onChange={(getValue: () => unknown) => {
                const readMarkdown = () => {
                  const nextValue = getValue();
                  return typeof nextValue === 'string'
                    ? nextValue
                    : String(nextValue ?? '');
                };

                valueGetterRef.current = readMarkdown;

                if (changeFrameRef.current !== null) {
                  window.cancelAnimationFrame(changeFrameRef.current);
                }

                changeFrameRef.current = window.requestAnimationFrame(() => {
                  changeFrameRef.current = null;
                  const nextMarkdown = readMarkdown();

                  if (!hasUserInteractedRef.current) {
                    return;
                  }

                  if (
                    initialValueRef.current.trim().length > 0 &&
                    nextMarkdown.trim().length === 0
                  ) {
                    return;
                  }

                  onChange(nextMarkdown);
                });
              }}
              onBlur={onBlur}
              onFocus={() => {
                onFocus?.();
              }}
              onClickLink={(href: string) => {
                if (onClickLink) {
                  onClickLink(href);
                  return;
                }

                openExternalLink(href);
              }}
            />
          ) : runtimeLoadFailed ? (
            <div role="alert" aria-live="assertive">
              Editor failed to load. Please refresh and try again.
            </div>
          ) : (
            <div role="status" aria-live="polite">
              Loading editor...
            </div>
          )}
        </ThemeProvider>
      </StyleSheetManager>
    </div>
  );
}
