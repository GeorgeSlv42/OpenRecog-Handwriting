# mlkit-ink — local Expo module wrapping ML Kit Digital Ink

```
src/        TypeScript wrapper: implements InkRecognizer from ink/   (Dev A)
android/    Kotlin implementation                                    (Dev A)
ios/        Swift implementation                                     (Dev B)
```

## Native API contract — LEAD: finalize before any native code is written

Android and iOS must expose **exactly** this to JavaScript: same function names, same argument and
return shapes, same error codes. The TypeScript wrapper in `src/` adapts it to the `InkRecognizer`
interface in [`ink/recognition/InkRecognizer.ts`](../../../ink/recognition/InkRecognizer.ts).

Proposed (TODO lead: confirm names, then remove "proposed"):

| Function | In | Out |
|---|---|---|
| `isModelDownloaded` | `modelId: string` | `boolean` |
| `downloadModel` | `modelId: string`, `wifiOnly: boolean` | resolves when downloaded |
| `deleteModel` | `modelId: string` | resolves when deleted |
| `recognize` | `modelId`, `strokes: {x,y,t}[][]`, `preContext?: string`, `writingArea?: {width,height}` | `{ text: string, score: number \| null }[]` best-first |

Error codes (reject with these, both platforms):

- [ ] `MODEL_NOT_DOWNLOADED`
- [ ] `INVALID_MODEL_ID` (language tag ML Kit doesn't know)
- [ ] `DOWNLOAD_FAILED`
- [ ] `RECOGNITION_FAILED`

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
