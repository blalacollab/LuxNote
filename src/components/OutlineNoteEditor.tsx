import { useEffect, useMemo, useRef } from 'react';

import {
  Editor,
  createDocumentUIPreset,
  defaultDictionary,
  type EditorDataAdapter,
} from 'outline-editor';
import { StyleSheetManager, ThemeProvider } from 'styled-components';

import { decorateEditorContent } from '../lib/markdownDialect';
import { createOutlineTheme } from '../lib/outlineTheme';

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

function openExternalLink(href: string): void {
  if (!/^https?:\/\//i.test(href)) {
    return;
  }

  window.open(href, '_blank', 'noopener,noreferrer');
}

const blockedDomProps = new Set(['active', 'arrow', 'commenting']);
const RuntimeEditor = Editor as any;

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
  const valueGetterRef = useRef<(() => string) | null>(null);
  const initialValueRef = useRef('');
  const readLiveMarkdownRef = useRef<() => string>(() => '');
  const initialValue = value || defaultValue;
  const theme = useMemo(() => createOutlineTheme(), []);
  const extensions = useMemo(
    () =>
      createDocumentUIPreset({
        enableFindAndReplace: true,
        enableDiagrams: true,
      }) as unknown[],
    [],
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
          <RuntimeEditor
            ref={editorRef as any}
            key={editorKey}
            id={`luxnote-outline-editor-${editorKey}`}
            defaultValue={initialValue}
            placeholder={placeholder}
            dictionary={defaultDictionary}
            embeds={[]}
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

                if (
                  !hasUserInteractedRef.current &&
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
        </ThemeProvider>
      </StyleSheetManager>
    </div>
  );
}
