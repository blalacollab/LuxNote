import type { ReactNode } from "react";
import type { MentionType } from "@shared/types";
import type { Primitive } from "utility-types";
import type { MenuItem } from "./index";

export interface EditorMentionAttrs {
  id: string;
  type: MentionType;
  modelId: string;
  label: string;
  actorId?: string;
  href?: string;
  [key: string]: Primitive;
}

export interface EditorMentionMenuItem extends MenuItem {
  attrs: EditorMentionAttrs;
}

export interface EditorDocumentSearchResult {
  id: string;
  title: string;
  path: string;
  url: string;
  icon?: string | null;
  initial?: string;
  color?: string | null;
  subtitle?: ReactNode;
}

export interface ResolvedInternalLink {
  mentionType: MentionType;
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
  icon?: ReactNode;
  duration?: number;
}

/**
 * Adapter interface implemented by the host app to provide business data
 * dependencies for the editor.
 */
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
    mentionType: MentionType;
    modelId: string;
    label: string;
  }) => Promise<MentionNotificationValidationResult | undefined>;
}
