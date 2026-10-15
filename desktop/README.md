# desktop — Windows app: Tauri shell + Windows Ink

ML Kit has no desktop SDK, so on Windows recognition uses the handwriting recognizer built into the OS
(`Windows.UI.Input.Inking`). The desktop app is **not a second UI**: Tauri opens a native window that
loads the web build of [`../app/`](../app/), the same screen, canvas and pipeline as Android/iOS.
The only desktop-specific code is the Rust side of the recognizer.

```
desktop/
  package.json                    Tauri CLI (npm run dev / build)
  src-tauri/
    tauri.conf.json               dev: loads Expo web on :8081 · build: ships app/dist        done
    src/lib.rs                    registers the commands                                       done
    src/windows_ink.rs            the 4 contract commands (stubs + DOWNLOAD_UNSUPPORTED done)  ← your work
    capabilities/, icons/         Tauri config + generated icons                               done
```

How a Recognize click reaches Windows: `RecognizeScreen` → `ink` pipeline → `NativeInkRecognizer` →
`app/src/recognizer/windowsInk.ts` (`invoke('recognize', …)`) → `windows_ink::recognize` in Rust.
Everything before the Rust function is done and tested.

**Windows 10/11 only.** In a plain browser (`npm run web`) the same UI runs as capture + export only.

## Run it

1. Prerequisites below, once. Check with `npx tauri info` in `desktop/`: Environment must be all ✔.
2. Repo root: `npm install`
3. Repo root: `npm run desktop`. Tauri starts the Expo web server, compiles Rust (slow the first time)
   and opens the window. Edits to `app/` hot-reload; edits to Rust recompile and restart.

Until `windows_ink.rs` is filled in, the screen shows
`windows-ink: is_model_downloaded is not implemented yet`. That's your starting line.

Release build: `npm run build -w @openrecog-handwriting/desktop`. It runs `expo export` and bundles
`app/dist` into an installer under `desktop/src-tauri/target/release/bundle/`.

## Prerequisites

Follow the Tauri "Prerequisites → Windows" page; it's the source of truth. In short:

- Visual Studio Build Tools with **"Desktop development with C++"** (MSVC + Windows SDK)
- Rust via rustup (`rustup default stable-msvc`)
- WebView2 runtime (preinstalled on Windows 11)
- Node 24+
- A Windows **handwriting** language pack (Settings → Time & language → Language → language options →
  Handwriting). Without it there's nothing to recognize with.

## Reference implementation

[`../recog_mvp/`](../recog_mvp/) is a working PowerShell prototype of exactly this backend. Run it
next to the app to compare outputs while porting. Its `Invoke-InkLine` function is the recipe for
`recognize`.

## Dependency decisions (lead)

- Tauri 2 (`@tauri-apps/cli`, `@tauri-apps/api`, `tauri` crate) — approved, already in
- `windows` crate (windows-rs) with the inking features — approved, add it when you start the Rust work
- Anything else: ask first.

## Done when (Phase 1)

- [x] `npm run desktop` opens the shared app in a native window, wired to Rust commands
- [ ] `windows_ink.rs` implemented (see [`src-tauri/TODO.md`](src-tauri/TODO.md)); no `NOT_IMPLEMENTED` left
- [ ] Draw with pen or mouse, Recognize, get per-line text + candidates
- [ ] Missing language pack shows the "install handwriting for … in Windows Settings" message
- [ ] Export (download) works inside the Tauri window and validates with `validateDocument()`
- [ ] A real Windows export is added to `docs/samples/`
