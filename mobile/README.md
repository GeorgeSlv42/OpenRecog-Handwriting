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

1. **Lead:** agree the native module API in [`modules/mlkit-ink/README.md`](modules/mlkit-ink/README.md).
   Nothing native gets written before this is signed off — it is what keeps Android and iOS identical.
2. **Dev A:** scaffold the Expo app (below), get an Android dev build running.
3. **Dev A / Dev B in parallel:** Android module, iOS module, InkCanvas.
4. **Dev A:** test screen (draw → recognize → export → share file).
5. **Both:** same sample ink must give the same JSON shape on both platforms.

## Scaffolding (Dev A, once)

This folder already holds TODO files, so generate into a temp folder and move the files in:

- [ ] `npx create-expo-app@latest mobile-tmp` (TypeScript template), move its contents into `mobile/`
- [ ] `npx create-expo-module@latest --local` from `mobile/`, name it `mlkit-ink`; merge into
      `modules/mlkit-ink/` (keep the TODO/README files)
- [ ] Use a **development build** (`npx expo run:android` / `run:ios`), not Expo Go — Expo Go can't
      load custom native modules
- [ ] Make `../ink` importable from the app (Metro `watchFolders` / path alias). Don't copy it.
- [ ] Commit the generated scaffold on its own before adding features

Check the generator flags against the current Expo docs before running; don't guess.

## Prerequisites

- Android: Android Studio + SDK + emulator or USB device, JDK 17+
- iOS: **a Mac with Xcode** and CocoaPods; a real iPad/iPhone for stylus testing.
  EAS Build can build iOS in the cloud from Windows, but debugging the Swift side needs a Mac.

## Dependencies that need lead approval before adding

- `com.google.mlkit:digital-ink-recognition` (Android) — approved
- `GoogleMLKit/DigitalInkRecognition` (iOS CocoaPod) — **ask**
- Expo / React Native — approved
- Drawing surface (e.g. `@shopify/react-native-skia` + `react-native-gesture-handler`) — **ask**

## Done when (Phase 1)

- [ ] Draw on Android and iOS, tap Recognize, get per-line text + candidates + gestures
- [ ] Export validates with `validateDocument()` from `ink/`
- [ ] Works offline after the language model is downloaded
- [ ] A sample device export is added to `docs/samples/` (real ML Kit output)
- [ ] This README has real run instructions (step 8)
