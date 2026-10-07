# android/ — Kotlin ML Kit implementation

**Owner:** Dev A

Implements the contract in [`../README.md`](../README.md). Nothing more.

## Setup

- [ ] Add `com.google.mlkit:digital-ink-recognition` to this module's `build.gradle`
      (latest version from the ML Kit Android release notes — don't guess a version)
- [ ] Builds with `npx expo run:android`

## Work — verify every class/method name against the Android guide before using it

The Android guide describes these concepts; confirm the exact names there:

- [ ] Model identifier from a language tag (`DigitalInkRecognitionModelIdentifier`), handle unknown tags
      → `INVALID_MODEL_ID`
- [ ] Model download / check / delete via the remote model manager, with download conditions
      (Wi-Fi only when `wifiOnly`)
- [ ] Build the `Ink` object: one stroke per input stroke, points with x, y, t
- [ ] Recognizer client from options; pass pre-context and writing area when given
      (`RecognitionContext`)
- [ ] Return candidates in engine order with `text` and `score` (null if the engine has none)
- [ ] Cache one recognizer per model id; close recognizers when the module is destroyed
- [ ] Run off the main thread; resolve/reject the JS promise from the ML Kit task callbacks

## Done when

- [ ] Recognizes `docs/samples/harness-export.v1.json` strokes (replayed) on an emulator
- [ ] Gesture model classifies a strike-through as a strike
- [ ] All four error codes reachable and tested manually
- [ ] Results match the iOS module's output shape for the same input
