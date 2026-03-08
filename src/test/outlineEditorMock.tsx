import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

let lastEditorProps: Record<string, unknown> | null = null;
let lastPresetOptions: Record<string, unknown> | undefined;

export function resetOutlineEditorMock(): void {
  lastEditorProps = null;
  lastPresetOptions = undefined;
}

export function getLastOutlineEditorProps() {
  return lastEditorProps;
}

export function getLastPresetOptions() {
  return lastPresetOptions;
}

export const defaultDictionary = {
  placeholder: 'Write something',
};

export function createDocumentUIPreset(options?: Record<string, unknown>) {
  lastPresetOptions = options;
  return [{ name: 'mock-document-ui-preset' }];
}

export const Editor = forwardRef(function Editor(
  input: Record<string, unknown>,
  ref,
) {
  const props = input as any;
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    lastEditorProps = props;
  });

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.textContent = String(props.defaultValue ?? '');
    }
  }, [props.defaultValue]);

  useEffect(() => {
    return () => {
      props.onRegisterValueGetter?.(null);
    };
  }, [props]);

  useImperativeHandle(ref, () => ({
    value() {
      return editorRef.current?.textContent ?? '';
    },
  }));

  return (
    <div
      data-testid="outline-editor-host"
      className={String(props.className ?? '')}
      style={props.style as never}
    >
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Note editor"
        onFocus={() => {
          props.onFocus?.();
        }}
        onBlur={() => {
          props.onBlur?.();
        }}
        onInput={(event) => {
          const nextValue = event.currentTarget.textContent ?? '';
          props.onChange?.(() => nextValue);
        }}
      />
      <button
        type="button"
        onClick={() => {
          props.onClickLink?.('https://example.com');
        }}
      >
        Open link
      </button>
    </div>
  );
});
