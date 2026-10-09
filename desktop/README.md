# desktop — Tauri app: capture → Windows Ink recognition → JSON export

The Windows counterpart of [`../mobile/`](../mobile/). ML Kit Digital Ink has no desktop SDK, so on
Windows recognition uses the handwriting recognizer built into the OS (`Windows.UI.Input.Inking`).
Everything except that call is shared: the [`../ink/`](../ink/) pipeline, the JSON schema
([`../docs/ink-schema.md`](../docs/ink-schema.md)) and the native contract
([`../docs/recognizer-contract.md`](../docs/recognizer-contract.md)).

**Windows 10/11 only.** macOS/Linux have no stroke recognizer we know of; the app may still run
there for capture + export (`recognition.status: "notRecognized"`), but that is not a Phase 1 goal.

## Layout (target)

```
desktop/
  src/                       web frontend (Vite + React)
    app/                     test screen; capture reused from harness/          Dev ?
    recognizer/              TS wrapper implementing InkRecognizer               Dev ?
  src-tauri/                 Rust: Tauri shell + Windows Ink commands            Dev ?
```

Each folder has a `TODO.md` with the work and a "done when". Delete a `TODO.md` once it's done.

## Order of work

1. **Lead:** sign off [`../docs/recognizer-contract.md`](../docs/recognizer-contract.md), including the
   proposed `DOWNLOAD_UNSUPPORTED` code and the Windows rows of the differences table.
2. **Spike (before scaffolding the full app):** prove a Rust program can recognize the strokes in
   [`../docs/samples/harness-export.v1.json`](../docs/samples/harness-export.v1.json) with Windows Ink,
   outside a UWP app. See [`src-tauri/TODO.md`](src-tauri/TODO.md). If it can't, stop and tell the lead —
   the whole desktop plan depends on this.
3. Scaffold the Tauri app (below).
4. In parallel: Windows Ink commands (`src-tauri/`), recognizer wrapper (`src/recognizer/`), test screen
   (`src/app/`).
5. Same sample ink must give the same JSON shape as mobile (texts may differ — different engine).

## Scaffolding (once)

This folder already holds TODO files, so generate into a temp folder and move the files in:

- [ ] `npm create tauri-app@latest desktop-tmp` (React + TypeScript + Vite), move its contents into
      `desktop/`
- [ ] Make `../ink` importable (root npm workspaces — see [`../ink/TODO.md`](../ink/TODO.md)). Don't copy it.
- [ ] Commit the generated scaffold on its own before adding features

Check the generator flags against the current Tauri docs before running; don't guess.

## Prerequisites

- Windows 10/11 with a **handwriting recognition** language pack installed
  (Settings → Time & language → Language → language options → Handwriting)
- Rust via rustup, with the MSVC toolchain (Visual Studio Build Tools, "Desktop development with C++")
- WebView2 runtime (preinstalled on Windows 11)
- Node 24+ (same as `ink/`)

Follow the Tauri "prerequisites" page for Windows; it is the source of truth for the exact list.

## Dependencies that need lead approval before adding

- Tauri 2 (`@tauri-apps/cli`, `@tauri-apps/api`, `tauri` crate) — **ask**
- `windows` crate (windows-rs) with the `UI_Input_Inking` feature set — **ask**
- React + Vite (already used by `harness/`) — approved
- `@excalidraw/excalidraw` (already used by `harness/`) — approved

## Done when (Phase 1)

- [ ] Draw on Windows with pen or mouse, tap Recognize, get per-line text + candidates
- [ ] Missing language pack shows a clear "install handwriting for <language> in Windows Settings" state
- [ ] Export validates with `validateDocument()` from `ink/`
- [ ] Works offline
- [ ] A sample Windows export is added to `docs/samples/` (real Windows Ink output)
- [ ] This README has real run instructions
