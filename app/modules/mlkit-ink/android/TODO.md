# android/ — Kotlin ML Kit implementation

**Owner:** Dev A

Implements the contract in [`docs/recognizer-contract.md`](../../../../docs/recognizer-contract.md).
Nothing more. Your file: [`src/main/java/expo/modules/mlkitink/MlkitInkModule.kt`](src/main/java/expo/modules/mlkitink/MlkitInkModule.kt).
It already compiles into the app with stub functions. Replace the `notImplemented(...)` bodies one at a time.

## Before you start

- Works on Windows, macOS or Linux. Install the Android prerequisites from [`app/README.md`](../../../README.md).
- From the repo root: `npm install`, then `npm run android`. You should see the app; tapping Recognize
  shows `mlkit-ink (Android): isModelDownloaded is not implemented yet`. That's your starting line.
- First milestone: `isModelDownloaded` returns a real answer (the model label on screen changes
  from "error" to "not downloaded"). Then `downloadModel`, then `recognize`.

## Setup

- [ ] Add `com.google.mlkit:digital-ink-recognition` to the `dependencies` block in `build.gradle`
      (version from the ML Kit Android release notes — don't guess), then set the `android` entry
      of `MLKIT_VERSION` in `../index.ts`
- [ ] `npm run android` still builds

## Work — verify every class/method name against the Android guide before using it

- [ ] Model identifier from a language tag (`DigitalInkRecognitionModelIdentifier`); unknown tag
      → throw `CodedException("INVALID_MODEL_ID", …)`
- [ ] Model check / download / delete via the remote model manager; Wi-Fi only when `wifiOnly`.
      Not on device at recognize time → `MODEL_NOT_DOWNLOADED`; download failure → `DOWNLOAD_FAILED`
- [ ] Build the `Ink` object: one stroke per `List<InkPoint>`, points with x, y, t (`t` is ms; check the
      unit ML Kit expects)
- [ ] Recognizer from options; pass `preContext` / `writingArea` when non-null (`RecognitionContext`)
- [ ] Return candidates in engine order as `mapOf("text" to …, "score" to …)` (score null if none)
- [ ] Cache one recognizer per model id; close them when the module is destroyed (`OnDestroy`)
- [ ] Run off the main thread; return the result from the ML Kit task (use `Promise` or a suspend
      `Coroutine` AsyncFunction — check the Expo Modules API docs for the current style)

## Capture (Android-specific)

`app/src/components/InkCanvas.tsx` captures x, y, t only. For stylus devices, add:

- [ ] Real pen pressure → `p` (0..1), only for stylus input, never for finger
- [ ] Input device for the page → `metadata.source.inputDevice` (`pen` / `touch`)
- [ ] Palm rejection while a pen is active

The canvas is shared code. Agree the approach with Dev B (iOS needs the same three) and the lead
before changing it. One option is RN pointer events (`pointerType`, `pressure`).

## Done when

- [ ] Recognizes `docs/samples/harness-export.v1.json` strokes (replayed) on an emulator
- [ ] Gesture model classifies a strike-through as a strike; gesture id set in `createRecognizer.ts`
- [ ] Every contract error code reachable and tested manually; no `NOT_IMPLEMENTED` left
- [ ] Results match the iOS module's output shape for the same input
