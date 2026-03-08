import { createContext, useContext } from "react";
import type { EditorDataAdapter } from "@shared/editor/types/EditorDataAdapter";
import type { EditorUploadAdapter } from "@shared/editor/types/EditorUploadAdapter";

export interface EditorHostContextValue {
  hostAdapter?: EditorDataAdapter;
  uploadAdapter?: EditorUploadAdapter;
}

const EditorHostContext = createContext<EditorHostContextValue>({});

export const useEditorHost = () => useContext(EditorHostContext);

export default EditorHostContext;

