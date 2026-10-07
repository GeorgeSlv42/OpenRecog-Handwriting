# ink — shared capture → recognize → JSON core

Plain TypeScript, no runtime dependencies. Used by the web [`harness/`](../harness/) today and by
the mobile app (Expo, ML Kit on-device) next. The JSON format is documented in
[`docs/ink-schema.md`](../docs/ink-schema.md).

```
model/         types (Stroke, Line, Block, NoteDocument…) + geometry helpers
structure/     strokes -> lines -> blocks, bounding boxes (heuristic, engine-independent)
recognition/   InkRecognizer interface + pipeline (gestures, per-line recognition, soft failure)
export/        buildDocument, serialize/parse, schema.v1.json + validator
tests/         node --test specs, synthetic fixtures, FakeRecognizer
examples/      make-recognized-sample.ts (regenerates docs/samples/recognized.example.v1.json)
```

Flow: `buildDocument(raw strokes)` → `recognizeDocument(doc, recognizer)` → `serializeDocument(doc)`.
ML Kit is only ever reached through `InkRecognizer`, so it can be swapped (MyScript for math, a fake in
tests).

## Run

Needs Node 24+ (runs `.ts` directly). Typecheck borrows TypeScript from the harness, so run
`npm install` in `harness/` once first.

```
cd ink
npm test
npm run typecheck
```
