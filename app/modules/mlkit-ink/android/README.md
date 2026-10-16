# Android handwriting MVP

This is a **local Expo library module**, not a standalone Android app. It implements
the four methods in [the native contract](../../../../docs/recognizer-contract.md).
The app screen embeds **Excalidraw** through Expo's DOM WebView and provides model download/delete,
recognition, and JSON sharing. Timed Excalidraw freehand strokes feed this native module through
the shared `InkRecognizer` adapter; no image OCR or separate SVG drawing surface is involved.

## Run

From the repository root:

```powershell
npm install
npm run android
```

Use an Android emulator or USB device with USB debugging enabled. Install Android Studio's SDK
and set `ANDROID_HOME` to its location; set `JAVA_HOME` to the compatible JDK used by the Expo
Android build. Use a development build, not Expo Go. The first build generates `app/android/`.
Open **that generated project** in Android Studio, rather than this library directory.
A `local.properties` file in this library does not configure the generated host project.

### Run from Android Studio

1. Open `app/android/` and let Gradle sync finish.
2. Start an emulator in Device Manager or connect a USB device.
3. Run `npm start` from the repository root and leave Metro running.
4. Select Android Studio's **app** configuration and the device, then click **Run**.

`npm start` only serves JavaScript; it does not compile or install the native Android app.
`npm run android` handles the native build, installation, and Metro together.

Excalidraw appears inside the drawing area; no separate plugin installation is needed.
If the native controls appear but the canvas stays blank during development, stop Metro,
then run `npx expo start --clear` from `app/` and reload the app. The DOM canvas needs its own
JavaScript bundle, so native controls can appear even when that bundle request is stalled.

The app no longer depends on `react-native-svg`: Excalidraw renders inside the DOM WebView.
If an older build fails with `ninja: error: mkdir(rnsvg_autolinked_build/...)` on Windows,
run `npm install` at the repository root, stop any active build, and delete only the generated
`app/android/app/.cxx`, `app/android/app/build`, and `app/android/build/generated/autolinking`
directories. Sync Gradle and run again to regenerate the native dependency list.

Choose `en-US`, tap **Download**, draw a word, and tap **Recognize**. Expand the line to inspect
candidates, then export the document. The shared pipeline also downloads missing models on demand.
After the model is downloaded, recognition works offline.

To compile just the module after generating the host:

```powershell
cd app
npx expo prebuild --platform android --no-install
cd android
.\gradlew.bat :mlkit-ink:compileDebugKotlin
```

## Implementation

- ML Kit `digital-ink-recognition:19.0.0`, pinned to match the Android engine version in `../index.ts`.
  Version 19 uses the `com.google.mlkit.vision.digitalink.recognition` namespace.
- Language/gesture IDs resolve through ML Kit. Unknown or malformed IDs reject with `INVALID_MODEL_ID`.
- Model downloads honor `wifiOnly`. Recognition itself never initiates a download; a missing model
  rejects with `MODEL_NOT_DOWNLOADED`, leaving that decision to the shared pipeline.
- Ink uses the supplied drawing order, coordinates, and page-relative millisecond timestamps.
  Fractional milliseconds are truncated to the SDK's integer timestamp format. No smoothing is applied.
- Empty strokes, missing/nonfinite points, backwards timestamps within a stroke, and invalid writing
  areas fail with `RECOGNITION_FAILED`. Pre-context and writing area are passed through when supplied.
  Absent pre-context becomes an empty string: ML Kit 19's context builder requires this property
  even for the first line. The shared JavaScript contract still accepts null.
- Candidate order and nullable raw scores are preserved. Scores are not probabilities.
- Expo coroutines suspend on SDK tasks and prepare ink on a background dispatcher. Operations are
  serialized so deletion cannot overlap recognition. Recognizers are cached by model ID and closed
  on deletion or module destruction.
- Check/delete failures use `RECOGNITION_FAILED`; the shared contract has no separate codes for these.
  Download failures use `DOWNLOAD_FAILED`.

## Device acceptance checklist

These checks require a built app; passing JavaScript tests alone does not verify ML Kit.

Verified during setup: `:mlkit-ink:compileDebugKotlin` succeeds against the generated Expo host,
Expo autolinking discovers `expo.modules.mlkitink.MlkitInkModule`, `npm run typecheck` passes,
and all 37 tests pass, including timed Excalidraw capture tests. The Android production export
(`npx expo export --platform android`) bundles the native host JS and local Excalidraw DOM assets.
Browser checks verify drawing, Undo/Redo stroke counts, and phone-sized layout. A complete x86_64
debug APK build (`:app:assembleDebug -PreactNativeArchitectures=x86_64`) also succeeds after
removing the unused `react-native-svg` dependency and regenerating native build caches.
An Android emulator smoke test draws a three-stroke H in Excalidraw, reports three native strokes,
and returns H from ML Kit with the downloaded en-US model. This verifies the null pre-context
path for the first line. A Clear regression check repeats three draw/clear cycles plus five rapid
Clear taps: the same WebView document remains alive, the native stroke count resets to zero,
and fresh ink still recognizes as H without bridge errors. Clear resets the scene/history and
timed capture in place; it must not remount the DOM component with a session-based React key.
The broader device checks below remain outstanding. The initial module compile used JDK 17;
the APK build uses the generated host's Gradle daemon JVM configuration and Expo's SDK/NDK versions.

| Check | Expected result |
|---|---|
| Fresh install, `en-US` | Model state is missing, with no stub error |
| Download, then draw and recognize | Nonempty line candidates; JSON export retains the original strokes |
| Airplane mode after download | Recognition still succeeds |
| Delete downloaded model | Model state becomes missing; normal Recognize downloads it again |
| Native `recognize` after deletion, without pipeline auto-download | `MODEL_NOT_DOWNLOADED` |
| Unsupported language ID | `INVALID_MODEL_ID` |
| Missing model, network unavailable | Download eventually reports `DOWNLOAD_FAILED`; raw ink remains exportable |
| Native download with `wifiOnly: true`, no Wi-Fi | Does not download over cellular; may wait for Wi-Fi |
| Same saved ink on Android/iOS | Same output shape; candidate text need not match |
| Fast refresh / leave app during a request | No crash or leaked recognizer after module teardown |

Replay `docs/samples/harness-export.v1.json` through the shared pipeline in an on-device test to
compare against the other backends. The current drawing screen does not have a JSON import button.
Keep personal samples private; do not commit handwriting without consent.

## Remaining scope

The MVP recognizes text. The native API accepts supported gesture model IDs, but the app keeps
gesture detection disabled until stroke-class labels and deletion behavior are validated on-device.
Excalidraw capture records pressure and input-device type when reported by the WebView; physical
stylus and palm-rejection checks remain. Imported or resized/rotated ink must be undone or redrawn
before recognition; the MVP cannot reconstruct its timed trajectory. Use Excalidraw Undo/Redo and
the eraser so displayed ink and recognition input stay synchronized.
iOS remains a separate native implementation.

References: [Android guide](https://developers.google.com/ml-kit/vision/digital-ink-recognition/android),
[release notes](https://developers.google.com/ml-kit/release-notes),
[SDK reference](https://developers.google.com/android/reference/com/google/mlkit/vision/digitalink/recognition/DigitalInkRecognizer),
[Expo coroutines](https://docs.expo.dev/modules/module-api/#kotlin-coroutines).
