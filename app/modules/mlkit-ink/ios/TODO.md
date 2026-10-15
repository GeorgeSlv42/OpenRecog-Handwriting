# ios/ — Swift ML Kit implementation

**Owner:** Dev B. **Requires a Mac with Xcode.**

Implements the contract in [`docs/recognizer-contract.md`](../../../../docs/recognizer-contract.md) — same
names, shapes and error codes as Android. When in doubt, match what Dev A's Android module does and raise
the mismatch with the lead. Your files: [`MlkitInkModule.swift`](MlkitInkModule.swift) and
[`MlkitInk.podspec`](MlkitInk.podspec). They already build into the app with stub functions.

## Before you start

- Install the iOS prerequisites from [`app/README.md`](../../../README.md) (Mac, Xcode, CocoaPods,
  Apple ID in Xcode for on-device builds).
- From the repo root: `npm install`, then `npm run ios`. Tapping Recognize shows
  `mlkit-ink (iOS): isModelDownloaded is not implemented yet`. That's your starting line.
- First milestone: `isModelDownloaded` returns a real answer, then `downloadModel`, then `recognize`.

## Setup

- [ ] Add `GoogleMLKit/DigitalInkRecognition` to the podspec (approved; version from the ML Kit iOS
      release notes), then set the `ios` entry of
      `MLKIT_VERSION` in `../index.ts`
- [ ] `npm run ios` builds on a simulator, then on a real device with Apple Pencil

## Work — verify every class/method name against the iOS guide before using it

- [ ] Errors: one exception class per contract code, named after it
      (`ModelNotDownloadedException`, `InvalidModelIdException`, `DownloadFailedException`,
      `RecognitionFailedException`). Expo turns the class name into `ERR_<CODE>`; the JS side handles that
- [ ] Model identifier from a language tag; unknown tag → `InvalidModelIdException`
- [ ] Model check / download / delete via the model manager; cellular allowed only when not
      `wifiOnly`. iOS reports download completion via **notifications**, so resolve the async function
      from those (with a timeout), and handle failure
- [ ] Build the `Ink` object: strokes of points with x, y, t
- [ ] Recognizer from options; pass `preContext` / `writingArea` when non-nil
- [ ] Return `[Candidate]` in engine order (`score` nil → null)
- [ ] Keep one recognizer per model id; run off the main thread

## Capture (iOS-specific)

`app/src/components/InkCanvas.tsx` captures x, y, t only. For Apple Pencil, add:

- [ ] Real pressure → `p` (0..1), Pencil only, never finger
- [ ] Input device for the page → `metadata.source.inputDevice` (`pen` / `touch`)
- [ ] Palm rejection while the Pencil is active

The canvas is shared code. Agree the approach with Dev A (Android needs the same three) and the lead
before changing it.

## Done when

- [ ] Same replayed sample as Android gives the same output shape (texts may differ slightly)
- [ ] Gesture model classifies a strike-through as a strike
- [ ] Every contract error code reachable; no `NOT_IMPLEMENTED` left
- [ ] Works offline after download
