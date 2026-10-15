# OpenRecog-Handwriting

## What this is

Recognize handwriting from **pen strokes** (vector points: x, y, time, pressure) — the ink from
a stylus on a note canvas or a PDF annotation. **Not** image/photo OCR — that's a
different, already-solved problem. This is about the raw pen trajectory, which
actually carries more signal than a flat image (you know the order and direction strokes were
drawn in).

Two genuinely different sub-problems — see each folder's README:

1. **[`recognition_text/`](recognition_text/)** — ordinary handwritten prose. Linear, left to
   right. The tractable one — start here.
2. **[`recognition_math/`](recognition_math/)** — handwritten equations. **2D layout, not a
   line of symbols** (fractions, exponents, roots). A structurally different, harder problem.
   Don't treat it as "text recognition but for math symbols."
3. **[`generation_stretch/`](generation_stretch/)** — stretch idea, not expected to be finished.
   The reverse direction: generate ink that looks handwritten.

## The app: one codebase, three platforms

```
            app/  (Expo — screen, canvas, export; shared by everyone)
              │
              ▼
            ink/  (pipeline: layout → recognize → schema v1 JSON; shared, tested)
              │   NativeInkRecognizer: one adapter for every engine
     ┌────────┼──────────────────────┐
     ▼        ▼                      ▼
  Android    iOS                  Windows
  Kotlin     Swift                Rust (Tauri shell hosts app's web build)
  ML Kit     ML Kit               Windows Ink
  app/modules/mlkit-ink/android   app/modules/mlkit-ink/ios   desktop/src-tauri/src/windows_ink.rs
```

Everything above the three native boxes is **built and working**. Each native box already has stub
functions with the right signatures (they answer `NOT_IMPLEMENTED`), so every platform runs end to end
on day one and you only fill in your box. The boxes all implement one contract:
[`docs/recognizer-contract.md`](docs/recognizer-contract.md).

| Platform | Run (repo root) | Engine | Your folder |
|---|---|---|---|
| Android | `npm run android` | Google ML Kit Digital Ink, on-device | [`app/modules/mlkit-ink/android/`](app/modules/mlkit-ink/android/) |
| iOS | `npm run ios` (Mac) | Google ML Kit Digital Ink, on-device | [`app/modules/mlkit-ink/ios/`](app/modules/mlkit-ink/ios/) |
| Windows | `npm run desktop` | Windows Ink, built into the OS | [`desktop/src-tauri/`](desktop/src-tauri/) |
| Browser | `npm run web` | none — capture + export only | — |

## Getting started (everyone, ~10 minutes)

1. Install Node 24+ and Git. Python people also install [uv](https://docs.astral.sh/uv/getting-started/installation/).
2. Clone, then at the repo root: `npm install` (one install for `ink`, `app` and `desktop`).
3. `npm run check`: typecheck + all tests. Green means your setup is fine.
4. `npm run web`: the app opens in the browser. Draw something, hit Export. You've now seen the
   whole flow minus recognition.
5. Install your platform's prerequisites and run your platform's command from the table above. The
   prerequisites are in [`app/README.md`](app/README.md) for Android/iOS and
   [`desktop/README.md`](desktop/README.md) for Windows.

Python side (evaluation, datasets): `uv sync`, then `uv run main.py`.

## Who does what (Phase 1)

Each folder has a `TODO.md` with the tasks and a "done when". Delete a `TODO.md` when it's done.

| Who | Start here | Touches |
|---|---|---|
| Lead | [`docs/recognizer-contract.md`](docs/recognizer-contract.md), reviews | contract, `ink/`, shared `app/src/` |
| Dev A — Android | [`app/modules/mlkit-ink/android/TODO.md`](app/modules/mlkit-ink/android/TODO.md) | `android/` + `MLKIT_VERSION` in `mlkit-ink/index.ts` |
| Dev B — iOS | [`app/modules/mlkit-ink/ios/TODO.md`](app/modules/mlkit-ink/ios/TODO.md) (needs a Mac) | `ios/` + `MLKIT_VERSION` in `mlkit-ink/index.ts` |
| Dev ? — Windows desktop | [`desktop/src-tauri/TODO.md`](desktop/src-tauri/TODO.md) | `desktop/src-tauri/` |
| Dev C — math + evaluation | [`recognition_math/TODO.md`](recognition_math/TODO.md), `recognition_text/dataset/`, `recognition_text/evaluation/` | Python, datasets |

## Ground rules

- **Stay in your folder.** If you think the shared code (`ink/`, `app/src/`, the contract) needs to
  change, open a PR and tag the lead. Don't work around it in native code.
- **The contract is the API.** Same names, shapes and error codes on every platform. If ML Kit or
  Windows can't do something, return the error code; don't fake it.
- **Never lose ink.** Recognition failing is a normal state (`recognition.status: "failed"`); export
  must still work.
- **Before you push:** `npm run check` passes.
- **Ask before adding dependencies.** Already-approved ones are listed in `app/README.md` and
  `desktop/README.md`.

## Other folders

- [`ink/`](ink/): shared TypeScript core (strokes → layout → recognition → versioned JSON). Format in
  [`docs/ink-schema.md`](docs/ink-schema.md), samples in [`docs/samples/`](docs/samples/).
- [`harness/`](harness/): standalone Excalidraw page for collecting labeled ink data
  (`cd harness && npm install && npm run dev`). Not part of the workspace on purpose; it stays as-is.
- [`recog_mvp/`](recog_mvp/): PowerShell prototype that proved Windows Ink works. The reference for the
  desktop Rust work.

## Heads up

The recognition SDKs worth evaluating (Google's Digital Ink Recognition, Windows Ink, MyScript for
math) ship as Android/iOS/Windows/JS libraries, not Python. Python is for prototyping, data handling,
and evaluating accuracy. The app integration is TypeScript plus native glue.
