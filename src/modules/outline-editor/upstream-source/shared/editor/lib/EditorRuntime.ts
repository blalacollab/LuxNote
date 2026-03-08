import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import type { MarkdownParser } from "prosemirror-markdown";
import type { Schema } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import type { DefaultTheme } from "styled-components";
import type { EmbedDescriptor } from "../embeds";
import type { EditorDataAdapter } from "../types/EditorDataAdapter";
import type { Dictionary } from "../types/Dictionary";
import type { EditorUploadAdapter } from "../types/EditorUploadAdapter";
import type { MarkdownSerializer } from "./markdown/serializer";

export interface EditorRuntimeProps {
  id?: string;
  userId?: string;
  readOnly?: boolean;
  template?: boolean;
  embeds?: EmbedDescriptor[];
  dictionary: Dictionary;
  theme: DefaultTheme;
  onSave?: (options: { done: boolean }) => void;
  onCancel?: () => void;
  onClickLink?: (href: string, event?: MouseEvent | ReactMouseEvent) => void;
  uploadFile?: (
    file: File | string,
    options?: {
      id?: string;
      onProgress?: (fractionComplete: number) => void;
    }
  ) => Promise<string>;
  hostAdapter?: EditorDataAdapter;
  uploadAdapter?: EditorUploadAdapter;
  [key: string]: any;
}

/**
 * Runtime contract required by shared editor extensions and nodes.
 */
export interface EditorRuntime {
  props: EditorRuntimeProps;
  schema: Schema;
  view: EditorView;
  parser: MarkdownParser;
  pasteParser: MarkdownParser;
  serializer: MarkdownSerializer;
  commands: Record<string, any>;
  extensions: {
    serializer: () => MarkdownSerializer;
  };
  elementRef: RefObject<HTMLDivElement>;
  updateActiveLightboxImage: (activeImage: any) => void;
}
