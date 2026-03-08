export type {
  Dictionary,
  DocumentUIPresetOptions,
  EditorDataAdapter,
  EditorDocumentSearchResult,
  EditorMentionMenuItem,
  EditorProps,
  EditorRuntime,
  EditorRuntimeProps,
  EditorUploadAdapter,
  MentionNotificationValidationResult,
  ResolvedInternalLink,
} from './runtime';

function ensureNodeCompatGlobals() {
  const globalObject = globalThis as any;

  if (!globalObject.global) {
    globalObject.global = globalObject;
  }

  if (!globalObject.process) {
    globalObject.process = {};
  }

  const processObject = globalObject.process;

  if (!processObject.env) {
    processObject.env = {};
  }

  if (!processObject.env.NODE_ENV) {
    processObject.env.NODE_ENV = import.meta.env.PROD
      ? 'production'
      : 'development';
  }

  if (!processObject.versions) {
    processObject.versions = {};
  }

  if (!processObject.versions.node) {
    processObject.versions.node = '18.0.0';
  }

  if (!processObject.platform) {
    processObject.platform = 'browser';
  }

  if (typeof processObject.cwd !== 'function') {
    processObject.cwd = () => '/';
  }

  if (!processObject.release) {
    processObject.release = {
      name: 'browser',
    };
  }
}

export async function loadOutlineEditorRuntime() {
  ensureNodeCompatGlobals();
  await import('./styles');
  return import('./runtime');
}
