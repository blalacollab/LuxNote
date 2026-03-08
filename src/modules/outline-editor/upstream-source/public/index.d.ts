import * as React from "react";

export type Dictionary = Record<
  string,
  string | ((...args: Array<string | number | boolean>) => string)
>;

export interface EditorMentionMenuItem {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  attrs: {
    id: string;
    type: string;
    modelId: string;
    label: string;
    actorId?: string;
    href?: string;
  };
}

export interface EditorDocumentSearchResult {
  id: string;
  title: string;
  path: string;
  url: string;
  icon?: string | null;
  initial?: string;
  color?: string | null;
  subtitle?: React.ReactNode;
}

export interface ResolvedInternalLink {
  mentionType: string;
  modelId: string;
  label: string;
  path: string;
  hash?: string;
  icon?: string | null;
  color?: string | null;
}

export interface MentionNotificationValidationResult {
  notify: boolean;
  message?: string;
  icon?: React.ReactNode;
  duration?: number;
}

export interface EditorDataAdapter {
  getCustomEmojis?: () => Array<{
    id: string;
    name: string;
    url?: string;
  }>;
  searchMentions?: (input: {
    query: string;
    limit: number;
    actorId?: string;
    documentId?: string;
  }) => Promise<EditorMentionMenuItem[]>;
  searchDocuments?: (input: {
    query: string;
    limit: number;
  }) => Promise<EditorDocumentSearchResult[]>;
  resolveInternalLink?: (input: {
    url: string;
  }) => Promise<ResolvedInternalLink | undefined>;
  checkEmbed?: (input: {
    url: string;
  }) => Promise<{ embeddable: boolean; reason?: string }>;
  validateMentionNotification?: (input: {
    documentId: string;
    mentionType: string;
    modelId: string;
    label: string;
  }) => Promise<MentionNotificationValidationResult | undefined>;
}

export interface EditorUploadAdapter {
  uploadFile: (
    file: File | string,
    options?: { id?: string; onProgress?: (fractionComplete: number) => void }
  ) => Promise<string>;
}

export interface EditorProps {
  id?: string;
  userId?: string;
  value?: unknown;
  defaultValue: unknown;
  placeholder: string;
  extensions?: unknown[];
  autoFocus?: boolean;
  focusedCommentId?: string;
  readOnly?: boolean;
  cacheOnly?: boolean;
  canUpdate?: boolean;
  canComment?: boolean;
  dictionary: Dictionary;
  dir?: "rtl" | "ltr" | "auto";
  grow?: boolean;
  template?: boolean;
  maxLength?: number;
  scrollTo?: string;
  hostAdapter?: EditorDataAdapter;
  uploadAdapter?: EditorUploadAdapter;
  onInit?: () => void;
  onDestroy?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onSave?: (options: { done: boolean }) => void;
  onCancel?: () => void;
  onChange?: (value: () => unknown) => void;
  onClickCommentMark?: (commentId: string) => void;
  onCreateCommentMark?: (commentId: string, userId: string) => void;
  onDeleteCommentMark?: (commentId: string) => void;
  onOpenCommentsSidebar?: () => void;
  onFileUploadStart?: () => void;
  onFileUploadStop?: () => void;
  onFileUploadProgress?: (id: string, fractionComplete: number) => void;
  onCreateLink?: (params: Record<string, unknown>) => Promise<string>;
  onClickLink: (
    href: string,
    event?: MouseEvent | React.MouseEvent<HTMLButtonElement>
  ) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  embeds: unknown[];
  userPreferences?: unknown;
  embedsDisabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  editorStyle?: React.CSSProperties;
  lang?: string;
}

export type DocumentUIPresetOptions = {
  enableFindAndReplace?: boolean;
  enableDiagrams?: boolean;
};

export declare const Editor: React.ComponentType<EditorProps>;
export declare const EditorClass: React.ComponentType<EditorProps>;
export default Editor;

export declare function createDocumentUIPreset(
  options?: DocumentUIPresetOptions
): unknown[];

export declare const defaultDictionary: Dictionary;

export type EditorRuntime = unknown;
export type EditorRuntimeProps = unknown;
