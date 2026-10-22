# ios/ — Swift ML Kit implementation

**Owner:** Dev B. **Requires a Mac with Xcode.**

Implements the contract in [`docs/recognizer-contract.md`](../../../../docs/recognizer-contract.md) — same
names, shapes and error codes as Android. When in doubt, match what Dev A's Android module does and raise
the mismatch with the lead. Your files: [`MlkitInkModule.swift`](MlkitInkModule.swift) and
[`MlkitInk.podspec`](MlkitInk.podspec).

## Before you start

- Install the iOS prerequisites from [`app/README.md`](../../../README.md) (Mac, Xcode, CocoaPods,
  Apple ID in Xcode for on-device builds).
- From the repo root: `npm install`, then `npm run ios`.

## Setup

- [x] Add `GoogleMLKit/DigitalInkRecognition` to the podspec (approved; version from the ML Kit iOS
      release notes), then set the `ios` entry of
      `MLKIT_VERSION` in `../index.ts` — **9.0.0**
- [ ] `npm run ios` builds on a simulator, then on a real device with Apple Pencil

## Work — verify every class/method name against the iOS guide before using it

- [x] Errors: one exception class per contract code, named after it
      (`ModelNotDownloadedException`, `InvalidModelIdException`, `DownloadFailedException`,
      `RecognitionFailedException`). Expo turns the class name into `ERR_<CODE>`; the JS side handles that
- [x] Model identifier from a language tag; unknown tag → `InvalidModelIdException`
- [x] Model check / download / delete via the model manager; cellular allowed only when not
      `wifiOnly`. iOS reports download completion via **notifications**, so resolve the async function
      from those (with a timeout), and handle failure
- [x] Build the `Ink` object: strokes of points with x, y, t
- [x] Recognizer from options; pass `preContext` / `writingArea` when non-nil
- [x] Return `[Candidate]` in engine order (`score` nil → null)
- [x] Keep one recognizer per model id; run off the main thread

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

## Run on the iOS Simulator (Mac only)

The iOS Simulator is part of Xcode. It cannot run on Windows or WSL. From a Mac, at the repo root:

```bash
npm install
npm run ios
```

That generates `app/ios/` (gitignored), installs pods including Digital Ink, and launches the Expo
dev client on the default iPhone simulator. First launch downloads nothing until you tap
**Download model** (or Recognize, which auto-downloads via the JS pipeline). After the `en-US` model
is on the simulator, drawing on the canvas and tapping **Recognize** should fill in per-line text.

Useful variants:

```bash
# Pick a simulator by name
npx expo run:ios --workspace app -d "iPhone 16"

# Rebuild after native/podspec changes
rm -rf app/ios
npm run ios
```

You need a development build, not Expo Go: Expo Go does not include `mlkit-ink`.

### From Windows / WSL (no Simulator here)

Xcode's Simulator cannot run on this OS. Two options:

1. Copy the repo to a Mac and run `npm run ios` there (this is what you want for debugging Swift).
2. Cloud-build a Simulator `.app` with EAS, then open that build **on a Mac**:

```bash
cd app
npx eas-cli login
npx eas-cli build --platform ios --profile development-simulator
```

Download the tarball EAS produces, extract the `.app`, and on the Mac: `xcrun simctl install booted /path/to/OpenRecogHandwriting.app` then `npx expo start` in this repo so Metro can connect.
