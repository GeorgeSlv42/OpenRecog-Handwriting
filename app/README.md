# app — the OpenRecog Handwriting app (Android, iOS, Windows desktop)

One Expo app, three platforms:

- **Android / iOS:** native builds. Recognition is ML Kit Digital Ink through the local
  [`modules/mlkit-ink/`](modules/mlkit-ink/) module.
- **Windows desktop:** the same app's **web build**, hosted by the Tauri shell in
  [`../desktop/`](../desktop/). Recognition is Windows Ink through Tauri commands.
- **Plain browser** (`npm run web`): same UI, capture + export only, no recognizer.

The screen, canvas, pipeline wiring and export are shared and **already work**. What's left per
platform is the native recognizer code. The native recognizers all implement one contract,
[`../docs/recognizer-contract.md`](../docs/recognizer-contract.md), so the shared code never changes per platform.

## Layout

```
app/
  App.tsx                         root, renders the screen
  app.json                        Expo config (bundle ids, plugins)
  src/
    screens/RecognizeScreen.tsx   test screen: draw → recognize → results → export      shared, done
    components/InkCanvas.tsx      native wrapper for the Excalidraw DOM canvas        shared
    components/ExcalidrawCanvas.tsx Excalidraw + timed pointer capture                 shared
    recognizer/
      createRecognizer.ts         Android/iOS: picks ML Kit                            done
      createRecognizer.web.ts     web: Windows Ink inside Tauri, else none             done
      windowsInk.ts               Tauri invoke bridge → desktop/src-tauri               done
    export/shareDocument(.web).ts native share sheet / browser download                done
    config.ts                     default ids + language
  modules/mlkit-ink/              local Expo native module
    index.ts                      JS glue (createMlKitRecognizer)                      done
    android/                      Kotlin — ML Kit Android                              Dev A  ← your work
    ios/                          Swift — ML Kit iOS                                   Dev B  ← your work
```

Expo picks `*.web.ts` over `*.ts` when bundling for web, which is how one import (`createRecognizer`)
gives each platform its own recognizer. You shouldn't need to touch `src/` for platform work.

## Run it

One-time, from the **repo root**: `npm install` (installs `ink`, `app` and `desktop` together).

| Goal | Command (repo root) | Needs |
|---|---|---|
| UI only, in a browser | `npm run web` | nothing else |
| Android dev build | `npm run android` | Android Studio + SDK, emulator or USB device |
| iOS dev build | `npm run ios` | Mac with Xcode + CocoaPods |
| Metro only (app already installed) | `npm start` | — |
| Windows desktop | `npm run desktop` | see [`../desktop/README.md`](../desktop/README.md) |

- Always a **development build** (`npm run android` / `ios`), never Expo Go: Expo Go can't load our
  native module, and the app will say so ("mlkit-ink native module is not in this build").
- `npm run android` / `ios` generate `app/android/` and `app/ios/`. They're build output (git-ignored);
  the native code we own lives in `modules/mlkit-ink/`. If native config gets weird, delete the generated
  folder and run the command again.
- Until the native code is written, Recognize shows `… is not implemented yet`. That's the stub
  talking, and it means everything up to the native call works.

## Prerequisites

- Everyone: Node 24+, Git
- Android (Windows, macOS or Linux): Android Studio + SDK + emulator or USB device, JDK 17+
  (set `JAVA_HOME` / `ANDROID_HOME`). A stylus device (e.g. Samsung with S Pen) for pressure testing.
- iOS: **a Mac with Xcode** and CocoaPods; a real iPad with Apple Pencil for stylus testing, plus an
  Apple ID in Xcode to sign for that device. EAS Build can build iOS from Windows, but you can't debug
  Swift without a Mac.
- Network on first run: ML Kit downloads the language model once, then works offline.

## Dependency decisions (lead)

- `com.google.mlkit:digital-ink-recognition` (Android) — approved, add it in
  `modules/mlkit-ink/android/build.gradle`
- `GoogleMLKit/DigitalInkRecognition` (iOS CocoaPod) — approved, add it in
  `modules/mlkit-ink/ios/MlkitInk.podspec`
- Drawing: `@excalidraw/excalidraw` — the shared canvas, embedded on Android/iOS through Expo's
  bundled DOM WebView. It runs directly in the browser/desktop build. Native ML Kit receives
  timed strokes through the existing adapter; it does not recognize canvas screenshots.
- Anything else: ask first.

## Platform work beyond the recognizer

The Excalidraw canvas reuses `harness/src/capture/TimedInkCapture.ts` to capture `x`, `y`, `t` in
scene coordinates, including coalesced pointer events. Real pen pressure and the dominant pointer
type are included when the WebView reports them. Verify these on physical devices:

- Real stylus **pressure** (`p`), only for pen input, never for fingers
- **Input device** per page (`pen` / `touch` / `mouse`) → `metadata.source.inputDevice`
- **Palm rejection** when a pen is active

Use Excalidraw's Undo/Redo and eraser; native controls never edit a separate stroke list.
The host Clear button resets the Excalidraw scene, history, and timed capture in place, then
starts a new capture session and discards delayed messages from the old one. The WebView stays
mounted so pending Expo DOM replies can finish without targeting a destroyed native view.
Imported ink and rotation/resizing/flipping of captured ink block recognition/export until undone
or redrawn, since the MVP does not reconstruct timed trajectories for those edits. Translations
are supported. Non-freehand shapes and typed text are not handwriting recognition input.

`metro.config.js` resolves Excalidraw's CSS and embeds its UI fonts locally. DOM bundle splitting
is disabled to avoid Expo 58's native export references to renamed common chunks. The handwriting
canvas is packaged with the app; it does not load excalidraw.com. Excalidraw's optional text-font
features can still request its upstream font assets; offline verification here concerns freehand ink.

## Testing

- **Unit, any OS:** `npm test` at the repo root runs `ink/` (pipeline, layout, schema, native adapter)
  and `recog_mvp/`, plus timed Excalidraw capture tests. `npm run typecheck` checks `ink` and `app`.
- **Android:** emulator for the flow, a real stylus device for pressure and point density.
- **iOS:** simulator for the flow, a real iPad with Apple Pencil for pressure and point density.
- **Cross-platform:** write the same word on each platform, export, and diff the JSON. It should have
  the same structure and fields; recognized texts may differ.
- **Offline:** download the model, airplane mode, recognize again.
- **Error paths:** Delete model, then Recognize → model downloads again (auto-download). Each error
  code from the contract should show a readable message on screen.

## Done when (Phase 1)

- [x] One app runs on Android, iOS and web from the same code, connected to `ink/`
- [x] Test screen: draw, recognize, per-line results + candidates, gestures, export, undo/clear
- [ ] Android: ML Kit recognition works (see `modules/mlkit-ink/android/TODO.md`)
- [ ] iOS: ML Kit recognition works (see `modules/mlkit-ink/ios/TODO.md`)
- [ ] Pressure + input device captured on stylus devices
- [ ] Export validates with `validateDocument()` from `ink/` on every platform
- [ ] A real device export is added to `docs/samples/`
