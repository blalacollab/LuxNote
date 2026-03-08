# LuxNote

LuxNote is a local-first infinite canvas notes app built with React, TypeScript, Zustand, and a Canvas 2D rendering layer. It uses a dark sci-fi visual language inspired by tactile floating-card motion systems, while keeping all brand assets, copy, imagery, and structure original.

## Stack

- React + TypeScript + Vite
- Zustand for scene and interaction state
- Canvas 2D for grid and connection rendering
- Vendored `outline-editor` for the fullscreen document editor
- CSS variables + CSS Modules
- IndexedDB with localStorage fallback
- Vitest + Testing Library

## Run

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

Run tests:

```bash
npm run test
```

## Shortcuts

- `Ctrl/Cmd + N`: create a new note and open the editor
- `Double Click`: create a note at the pointer position
- `Drag Background`: pan the infinite canvas directly with the mouse
- `Wheel`: zoom around the cursor
- `Space + Drag`: auxiliary panning for laptop and trackpad use
- `Delete` / `Backspace`: delete the selected note
- `Enter`: open the selected note in the fullscreen editor
- `P`: focus the selected note
- `Shift + /`: reveal the hidden settings note
- `Escape`: exit the fullscreen editor, clear selection, or leave link mode

## Architecture

### Rendering split

- `CanvasStage` draws the background grid and connection lines on a single canvas layer.
- `React DOM` renders only the visible note cards, the hidden settings note, and the fullscreen note shell.
- The note shell hosts a vendored `outline-editor` instance for Markdown-first WYSIWYG editing while LuxNote keeps title, tags, and persistence outside the editor runtime.
- This hybrid avoids expensive DOM work for vector layers while keeping document editing rich and predictable.

### Scene model

- `src/store/canvasStore.ts` owns camera state, notes, links, z-order, drag inertia, zoom animation, and hydration state.
- Notes store world coordinates, fixed dimensions, timestamps, and stacking order.
- Links store note-to-note relationships using stable deterministic ids.
- `NoteRecord.title` and `NoteRecord.body` stay unchanged; the editor only replaces the body editing surface.

### Persistence

- `src/hooks/useScenePersistence.ts` hydrates the scene on boot.
- Every persisted scene change is debounced and written to IndexedDB.
- When IndexedDB is unavailable or fails, localStorage is used as a fallback.
- The fullscreen editor flushes Markdown back into Zustand before close, blur, and unmount so editor state and persisted state stay aligned.

### Performance choices

- Only notes inside the camera bounds plus overscan are mounted.
- Each frame update is driven by `requestAnimationFrame`, but state writes happen only when note inertia or zoom animation is active.
- Canvas 2D draws the dense grid and all visible connection curves without forcing every note into the DOM tree.
- Card motion uses lightweight per-note velocity values instead of rerendering hidden notes.
- Background panning uses a drag threshold and `requestAnimationFrame` batching inspired by canvas-oriented interaction systems.
- Save writes are debounced to reduce IndexedDB churn during drag sessions.

## Project structure

```text
src/
  app/
    App.tsx
    App.module.css
  components/
    CanvasStage.tsx
    CanvasDialog.tsx
    InspectorPanel.tsx
    NoteCard.tsx
    OutlineNoteEditor.tsx
  hooks/
    useAnimationLoop.ts
    useCanvasHotkeys.ts
    useScenePersistence.ts
    useViewportSync.ts
  lib/
    camera.ts
    constants.ts
    ids.ts
    markdown.ts
    markdownDialect.ts
    outlineI18n.ts
    outlineTheme.ts
    persistence.ts
    physics.ts
    seed.ts
    types.ts
    viewport.ts
  store/
    canvasStore.ts
  test/
    camera.test.ts
    hotkeys.test.tsx
    outlineNoteEditor.test.tsx
    noteInteractions.test.tsx
    viewport.test.ts
  styles/
    globals.css
    outlineEditor.css
vendor/
  outline-editor/
```

## Acceptance checklist

- [x] Infinite canvas pan and zoom with cursor-centered scaling
- [x] Create, edit, and delete Markdown notes
- [x] Dragging raises card order and applies inertia after release
- [x] Card-to-card connections with canvas-rendered curves
- [x] Mouse-first pan, zoom, note selection, and note dragging
- [x] Keyboard shortcuts for auxiliary actions and fast creation
- [x] Auto-save and restore with IndexedDB fallback
- [x] Visible-note culling for large boards
- [x] Fullscreen note editor using vendored `outline-editor` with Markdown-backed storage
- [x] Core interaction tests with Vitest + Testing Library

## Next iterations

- Multi-user collaboration with conflict resolution
- Cloud sync and account-backed storage
- Attachment support for images, files, and embeds
- Search, tag filters, and graph exploration view
- Export to PNG, PDF, Markdown bundle, and shareable snapshots
- Minimap, pinning, note templates, and presentation mode
