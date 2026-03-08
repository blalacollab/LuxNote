# outline-editor

Standalone Outline document editor package with full editing UI (toolbar, slash menu, mention menu, link editor, paste menu) and no realtime collaboration.

## Install

```bash
npm install outline-editor
```

## Quick Start

```tsx
import React, { useMemo, useState } from "react";
import {
  Editor,
  createDocumentUIPreset,
  defaultDictionary,
  type EditorDataAdapter,
} from "outline-editor";
import "outline-editor/styles.css";

export default function DemoEditor() {
  const [value, setValue] = useState("# Hello\n");

  const hostAdapter: EditorDataAdapter = useMemo(
    () => ({
      searchMentions: async ({ query }) => {
        // return mention menu items from your backend
        return [];
      },
      searchDocuments: async ({ query }) => {
        // return internal document search results
        return [];
      },
      resolveInternalLink: async ({ url }) => {
        // optional: convert pasted internal links to mentions/pretty links
        return undefined;
      },
      checkEmbed: async ({ url }) => {
        // optional: validate if a URL can be embedded
        return { embeddable: true };
      },
      validateMentionNotification: async () => {
        // optional: validate @notification behavior
        return undefined;
      },
    }),
    []
  );

  return (
    <Editor
      defaultValue={value}
      value={value}
      onChange={(getValue) => setValue(getValue())}
      onClickLink={(href) => window.open(href, "_blank")}
      placeholder="Write something"
      dictionary={defaultDictionary}
      extensions={createDocumentUIPreset()}
      embeds={[]}
      hostAdapter={hostAdapter}
    />
  );
}
```

## Public API

- `Editor`
- `createDocumentUIPreset(options?)`
- `defaultDictionary`
- Types:
  - `EditorProps`
  - `EditorDataAdapter`
  - `EditorUploadAdapter`
  - `Dictionary`
  - `EditorRuntime`

## Notes

- Realtime collaboration is intentionally excluded in this package.
- Upload is optional and disabled by default. Pass `uploadAdapter` to enable custom upload behavior.
- Mention/link/embed business data is injected through `hostAdapter`.
