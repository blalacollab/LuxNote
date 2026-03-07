# LuxNote

LuxNote is a local-first infinite canvas notes app built with React, TypeScript, Zustand, and PixiJS. It uses a dark sci-fi visual language inspired by tactile floating-card motion systems, while keeping all brand assets, copy, imagery, and structure original.

## Stack

- React + TypeScript + Vite
- Zustand for scene and interaction state
- PixiJS for WebGL grid and connection rendering
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

- `N`: create a new note at the camera center
- `Space + Drag`: pan the infinite canvas
- `Ctrl/Cmd + Wheel`: zoom around the cursor
- `Delete` / `Backspace`: delete the selected note
- `Escape`: clear selection and exit link mode

## Architecture

### Rendering split

- `PixiJS` draws the background grid, axis highlights, and connection lines.
- `React DOM` renders only the visible note cards and the Markdown inspector.
- This hybrid avoids expensive DOM work for vector layers while keeping note editing accessible and straightforward.

### Scene model

- `src/store/canvasStore.ts` owns camera state, notes, links, z-order, drag inertia, zoom animation, and hydration state.
- Notes store world coordinates, fixed dimensions, timestamps, and stacking order.
- Links store note-to-note relationships using stable deterministic ids.

### Persistence

- `src/hooks/useScenePersistence.ts` hydrates the scene on boot.
- Every persisted scene change is debounced and written to IndexedDB.
- When IndexedDB is unavailable or fails, localStorage is used as a fallback.

### Performance choices

- Only notes inside the camera bounds plus overscan are mounted.
- Each frame update is driven by `requestAnimationFrame`, but state writes happen only when note inertia or zoom animation is active.
- WebGL draws the dense grid and all visible connection curves efficiently.
- Card motion uses lightweight per-note velocity values instead of rerendering hidden notes.
- Save writes are debounced to reduce IndexedDB churn during drag sessions.

## Project structure

```text
src/
  app/
    App.tsx
    App.module.css
  components/
    CanvasStage.tsx
    InspectorPanel.tsx
    NoteCard.tsx
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
    viewport.test.ts
```

## Acceptance checklist

- [x] Infinite canvas pan and zoom with cursor-centered scaling
- [x] Create, edit, and delete Markdown notes
- [x] Dragging raises card order and applies inertia after release
- [x] Card-to-card connections with Pixi-rendered curves
- [x] Keyboard shortcuts for creation, deletion, panning, and zooming
- [x] Auto-save and restore with IndexedDB fallback
- [x] Visible-note culling for large boards
- [x] Core interaction tests with Vitest + Testing Library

## Next iterations

- Multi-user collaboration with conflict resolution
- Cloud sync and account-backed storage
- Attachment support for images, files, and embeds
- Search, tag filters, and graph exploration view
- Export to PNG, PDF, Markdown bundle, and shareable snapshots
- Minimap, pinning, note templates, and presentation mode
