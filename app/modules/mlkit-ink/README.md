# mlkit-ink — local Expo module wrapping ML Kit Digital Ink

```
index.ts                  JS glue: createMlKitRecognizer() → NativeInkRecognizer      done
expo-module.config.json   autolinking (module name "MlkitInk")                       done
android/                  Kotlin: MlkitInkModule.kt (stubs) + build.gradle           Dev A
ios/                      Swift: MlkitInkModule.swift (stubs) + MlkitInk.podspec     Dev B
```

## Native API contract

Shared with the Windows desktop backend: [`docs/recognizer-contract.md`](../../../docs/recognizer-contract.md).
Both native files already declare the four functions with the right argument types and throw
`NOT_IMPLEMENTED`. Replace the bodies; JS-side conversion, ranking and error mapping are done for you
by `NativeInkRecognizer` in [`ink/recognition/NativeRecognizer.ts`](../../../ink/recognition/NativeRecognizer.ts).

When you set the ML Kit dependency version, also set it in `MLKIT_VERSION` in `index.ts`. It's what
ends up in `recognition.engine.version` in every export.

Once an open question below is answered, put the answer where the app reads it:
- Gesture model id → `gestureModelId` in [`app/src/recognizer/createRecognizer.ts`](../../src/recognizer/createRecognizer.ts)
  (`en-US-x-gesture` for the default language)
- Writing area decision → pass `lineWritingArea` in `RecognizeScreen.tsx`'s `recognizeDocument` call

## Open questions — answer from the ML Kit docs, not from memory

- [x] Exact model identifier for **gesture** classification (docs mention `-x-gesture` extensions).
      This becomes `gestureModelId` in the pipeline. For US English: `en-US-x-gesture`
      ([base models](https://developers.google.com/ml-kit/vision/digital-ink-recognition/base-models)).
- [x] What `score` means per platform: present for which models? lower = better or higher = better?
      Document the answer in `docs/ink-schema.md`. Do **not** normalize it into a fake 0..1 confidence.
      ML Kit: populated for shape/gesture classifiers; **lower is more likely**; omitted (`null`) for
      most text models.
- [ ] Should we pass a writing area per line? Measure accuracy with and without on real samples
      (Dev C's eval script), then set `lineWritingArea` in the pipeline accordingly.
- [x] Does ML Kit need `t` on every point, or is it optional? (Our JSON always has it.)
      Optional in the API; we always pass `t` in milliseconds, which is the unit ML Kit expects.

Links: https://developers.google.com/ml-kit/vision/digital-ink-recognition (Android and iOS guides
in the left nav).
