# mobile — Expo app: capture → ML Kit recognition → JSON export

Phase 1 steps 5–8. One Expo app for Android **and** iOS. Only the ML Kit call is written twice
(Kotlin + Swift); everything else is shared TypeScript, including [`../ink/`](../ink/).

ML Kit Digital Ink runs on-device only (no web/server SDK), so this app is where recognition
happens. The JSON it exports is the same schema the harness exports — see
[`../docs/ink-schema.md`](../docs/ink-schema.md).

## Layout (target)

```
mobile/
  app/                       screens (Expo Router)                  Dev A
  components/                InkCanvas: stroke capture              Dev B
  modules/mlkit-ink/         local Expo native module
    src/                     TS wrapper implementing InkRecognizer  Dev A (+B reviews)
    android/                 Kotlin, ML Kit Android                 Dev A
    ios/                     Swift, ML Kit iOS                      Dev B
```

Each folder has a `TODO.md` with the work and a "done when". Delete a `TODO.md` once it's done.

## Order of work

1. **Lead:**
   - agree the native API in [`../docs/recognizer-contract.md`](../docs/recognizer-contract.md).
     Nothing native gets written before this is signed off — it is what keeps Android, iOS and the
     Windows desktop app ([`../desktop/`](../desktop/)) identical.
   - answer the two **ask** dependencies below (iOS CocoaPod, drawing surface) — they block Dev B.
   - set up the root npm workspaces ([`../ink/TODO.md`](../ink/TODO.md)) so the scaffold can import `ink`.
2. **Dev A:** scaffold the Expo app (below), get an Android dev build running.
3. **Dev B:** pull the scaffold, get an iOS dev build running on a Mac (simulator, then a real device).
4. **Dev A / Dev B in parallel:** Android module, iOS module, InkCanvas.
5. **Dev A:** test screen (draw → recognize → export → share file).
6. **Both:** same sample ink must give the same JSON shape on both platforms (see Testing).

## Scaffolding (Dev A, once)

This folder already holds TODO files, so generate into a temp folder and move the files in:

- [ ] `npx create-expo-app@latest mobile-tmp` (TypeScript template), move its contents into `mobile/`
- [ ] `npx create-expo-module@latest --local` from `mobile/`, name it `mlkit-ink`; merge into
      `modules/mlkit-ink/` (keep the TODO/README files)
- [ ] Use a **development build** (`npx expo run:android` / `run:ios`), not Expo Go — Expo Go can't
      load custom native modules
- [ ] Add `mobile` to the root npm workspaces and depend on `@openrecog-handwriting/ink`; configure
      Metro to resolve the workspace package and compile its `.ts` sources. Don't copy `ink/`.
- [ ] Commit the generated scaffold on its own before adding features

Check the generator flags against the current Expo docs before running; don't guess.

## Prerequisites

- Everyone: Node 24+ (same as `ink/`), Git
- Android (works on Windows, macOS or Linux): Android Studio + SDK + emulator or USB device, JDK 17+.
  A stylus device (e.g. Samsung with S Pen) for pressure testing; emulators only give mouse input.
- iOS: **a Mac with Xcode** and CocoaPods; a real iPad/iPhone for stylus testing, plus an Apple ID
  in Xcode to sign builds for that device (check Apple's current rules for free vs. paid accounts).
  EAS Build can build iOS in the cloud from Windows, but debugging the Swift side needs a Mac.
- Network on first run: ML Kit downloads the language model once, then works offline.

## Dependencies that need lead approval before adding

- `com.google.mlkit:digital-ink-recognition` (Android) — approved
- `GoogleMLKit/DigitalInkRecognition` (iOS CocoaPod) — **ask**
- Expo / React Native — approved
- Drawing surface (e.g. `@shopify/react-native-skia` + `react-native-gesture-handler`) — **ask**

## Testing

- **Unit (any OS, no device):** `ink/` tests (`cd ink && npm test`) plus the `mlkit-ink/src/` wrapper
  tests with the native module mocked. These cover all layout, gesture and JSON logic.
- **Android:** emulator for the flow, a real stylus device for pressure and point density.
- **iOS:** simulator for the flow, a real iPad with Apple Pencil for pressure and point density.
- **Cross-platform:** replay the strokes of
  [`../docs/samples/harness-export.v1.json`](../docs/samples/harness-export.v1.json) on both platforms
  and diff the two exports — same structure and fields; recognized texts may differ slightly.
- **Offline:** download the model, enable airplane mode, recognize again.
- **Error paths:** delete the model and recognize with `autoDownload: false` → `recognition.status:
  "failed"` with a readable `error`, export still works.

## Done when (Phase 1)

- [ ] Draw on Android and iOS, tap Recognize, get per-line text + candidates + gestures
- [ ] Export validates with `validateDocument()` from `ink/`
- [ ] Works offline after the language model is downloaded
- [ ] A sample device export is added to `docs/samples/` (real ML Kit output)
- [ ] This README has real run instructions (step 8)
