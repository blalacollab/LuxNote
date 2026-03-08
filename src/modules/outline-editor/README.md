# Local Outline Editor Module

This directory hosts the in-repo Outline editor integration.

- `runtime.ts`: runtime exports used by LuxNote.
- `styles.ts`: async style entry loaded only when the fullscreen editor mounts.
- `reactDomLegacyCompat.ts`: local React 18 compatibility bridge for editor code paths that still call legacy `react-dom` APIs.
- `dist/`: runtime build consumed by LuxNote.
- `upstream-source/`: upstream source snapshot for local maintenance and future patching.

The source and distribution remain subject to the original license in [`LICENSE`](./LICENSE).
