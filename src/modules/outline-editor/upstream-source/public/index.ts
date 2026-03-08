export { default as Editor } from "../app/editor";
export { Editor as EditorClass } from "../app/editor";
export type { Props as EditorProps } from "../app/editor";

export { createDocumentUIPreset } from "./createDocumentUIPreset";
export type { DocumentUIPresetOptions } from "./createDocumentUIPreset";

export { defaultDictionary } from "./defaultDictionary";

export type { Dictionary } from "../shared/editor/types/Dictionary";
export type {
  EditorDataAdapter,
  EditorDocumentSearchResult,
  EditorMentionMenuItem,
  MentionNotificationValidationResult,
  ResolvedInternalLink,
} from "../shared/editor/types/EditorDataAdapter";
export type { EditorUploadAdapter } from "../shared/editor/types/EditorUploadAdapter";
export type {
  EditorRuntime,
  EditorRuntimeProps,
} from "../shared/editor/lib/EditorRuntime";
