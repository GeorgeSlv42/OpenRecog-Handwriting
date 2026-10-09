# mlkit-ink — local Expo module wrapping ML Kit Digital Ink

```
src/        TypeScript wrapper: implements InkRecognizer from ink/   (Dev A)
android/    Kotlin implementation                                    (Dev A)
ios/        Swift implementation                                     (Dev B)
```

## Native API contract

Shared with the Windows desktop backend: [`docs/recognizer-contract.md`](../../../docs/recognizer-contract.md).
Android and iOS must expose exactly that to JavaScript; the TypeScript wrapper in `src/` adapts it to
the `InkRecognizer` interface in [`ink/recognition/InkRecognizer.ts`](../../../ink/recognition/InkRecognizer.ts).

## Open questions — answer from the ML Kit docs, not from memory

- [ ] Exact model identifier for **gesture** classification (docs mention `-x-gesture` extensions).
      This becomes `gestureModelId` in the pipeline.
- [ ] What `score` means per platform: present for which models? lower = better or higher = better?
      Document the answer in `docs/ink-schema.md`. Do **not** normalize it into a fake 0..1 confidence.
- [ ] Should we pass a writing area per line? Measure accuracy with and without on real samples
      (Dev C's eval script), then set `lineWritingArea` in the pipeline accordingly.
- [ ] Does ML Kit need `t` on every point, or is it optional? (Our JSON always has it.)

Links: https://developers.google.com/ml-kit/vision/digital-ink-recognition (Android and iOS guides
in the left nav).
