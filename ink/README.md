# ink — shared capture → recognize → JSON core

Plain TypeScript, no runtime dependencies. Used by the web [`harness/`](../harness/) and by the
[`app/`](../app/) (Android, iOS and the Windows desktop shell). The JSON format is documented in
[`docs/ink-schema.md`](../docs/ink-schema.md).

```
model/         types (Stroke, Line, Block, NoteDocument…) + geometry helpers
structure/     strokes -> lines -> blocks, bounding boxes (heuristic, engine-independent)
recognition/   InkRecognizer interface + pipeline (gestures, per-line recognition, soft failure)
               NativeRecognizer.ts: the native contract as TS + the one adapter every platform uses
export/        buildDocument, serialize/parse, schema.v1.json + validator
tests/         node --test specs, synthetic fixtures, FakeRecognizer
examples/      make-recognized-sample.ts (regenerates docs/samples/recognized.example.v1.json)
```

Flow: `buildDocument(raw strokes)` → `recognizeDocument(doc, recognizer)` → `serializeDocument(doc)`.
Engines are only ever reached through `InkRecognizer`, so they can be swapped (ML Kit, Windows Ink,
MyScript for math, a fake in tests). Native engines go through `NativeInkRecognizer`, which does stroke
conversion, ranking and error-code mapping once for all platforms.

Must stay runnable in Node, browsers and React Native (Hermes): no Node or DOM APIs outside `tests/`
and `examples/`, no `structuredClone`.

## Run

Needs Node 24+ (runs `.ts` directly). It's an npm workspace: run `npm install` once at the repo root.

```
npm test -w @openrecog-handwriting/ink
npm run typecheck -w @openrecog-handwriting/ink
```
