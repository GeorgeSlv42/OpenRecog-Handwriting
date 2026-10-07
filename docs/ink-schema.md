# Ink note document — schema v1.0.0

One JSON document per **page** of handwritten notes. It always carries the raw strokes; layout,
recognized text and gestures are layered on top. Consumers (the AI tutor) should treat
`strokes` as the source of truth and everything else as derived, possibly-wrong interpretation.

- Contract: [`ink/export/schema.v1.json`](../ink/export/schema.v1.json) (JSON Schema 2020-12)
- TypeScript types: [`ink/model/types.ts`](../ink/model/types.ts)
- Validator (schema + cross-reference checks): `validateDocument()` in [`ink/export/validate.ts`](../ink/export/validate.ts)
- Samples: [`samples/harness-export.v1.json`](samples/harness-export.v1.json) (real harness capture, not
  recognized) and [`samples/recognized.example.v1.json`](samples/recognized.example.v1.json) (the same
  capture run through the pipeline with a scripted stand-in recognizer — the text is illustrative, not
  ML Kit output)

## Versioning

`schemaVersion` is semver and is checked exactly (`"1.0.0"`).

- **Patch**: docs/clarifications only, no shape change.
- **Minor**: additive, optional fields only. Old readers must ignore what they don't know.
- **Major**: anything that removes, renames or re-types a field, or changes a meaning.

Because v1 validation uses `additionalProperties: false`, a minor bump ships a new schema file
(`schema.v1.1.json`) and readers validate against the version the document declares.

## Top level

| Field | Meaning |
|---|---|
| `schemaVersion` | `"1.0.0"` |
| `metadata` | Who/where/when — see below |
| `strokes` | Raw ink, in drawing order |
| `structure` | Strokes grouped into blocks → lines, with bounding boxes |
| `recognition` | Status, engine, and recognized text per line / per deleted region |
| `gestures` | Editing marks (strike-through, scribble, circle) and what they apply to |
| `groundTruth` | Optional human label of what was written (test data only) |

## `metadata`

| Field | Meaning |
|---|---|
| `courseId`, `lectureId`, `noteId`, `pageId` | Non-empty ids from the host app. A note has pages; one document = one page. |
| `createdAt`, `updatedAt`, `exportedAt` | ISO-8601 UTC. Created = page started, updated = last edit, exported = this file. |
| `language` | BCP-47 tag (e.g. `en-US`). Also the default recognition model id. |
| `source.app` | `harness`, `mobile`, … |
| `source.platform` | `web` \| `android` \| `ios` |
| `source.inputDevice` | Dominant pointer type: `pen` \| `touch` \| `mouse` \| `unknown` |
| `canvas` | Size of the visible writing surface at export, `units: "px"`. Stroke coordinates are canvas/scene coordinates and may fall outside this box on an infinite canvas. |

## `strokes[]`

A stroke is one pen-down → pen-up.

| Field | Meaning |
|---|---|
| `strokeId` | `s_0001`, … assigned in drawing order (by first point's time). Stable within a document only. |
| `points[]` | `{ x, y, t, p? }` |
| `points[].x/y` | Canvas/scene px, y grows downward. |
| `points[].t` | ms since the first point **on the page** (so the first stroke starts at 0 and gaps between strokes are preserved). |
| `points[].p` | Pressure 0..1. **Present only when the device reports real pressure** (stylus). Mice and most touchscreens report a constant placeholder, so it is omitted for them. |
| `style` | Optional `{ strokeWidth, color }` as drawn. |
| `bbox` | `{ x, y, w, h }` of the points. |

Numbers are rounded to 3 decimals on export.

## `structure`

`blocks[] → lines[] → strokeIds[]`, ids assigned in reading order (`b_01…`, `l_001…`).

- A **line** is strokes sharing a horizontal band (vertical overlap with the line, or a small mark
  just above/below it such as an i-dot), without a large horizontal gap. `strokeIds` keep drawing
  order, which is what recognizers expect.
- A **block** is vertically adjacent lines with overlapping x-ranges (a paragraph / column).
- `type`: `text`, or `drawing` for a line much taller than the page's typical stroke height
  (a diagram, a big shape). `unknown` is reserved.
- `line.recognitionId` points into `recognition.results`, or `null` if not recognized.
- Strokes classified as gestures are **not** in any line (they're annotations, not content).
  Strokes a gesture deleted **are** still in their line — the line's recognized text excludes them.

This grouping is geometric heuristics ([`ink/structure/layout.ts`](../ink/structure/layout.ts)), not
ML Kit — the engine does not segment pages. Thresholds are relative to line height.

## `recognition`

| Field | Meaning |
|---|---|
| `status` | `notRecognized` (e.g. harness export; web can't run ML Kit), `recognized`, or `failed` |
| `engine` | `{ name, modelId, gestureModelId, version }`, `null` when not recognized |
| `error` | Message when `failed`; strokes/structure are still valid and exported |
| `results[]` | One per recognized line, plus one per delete-gesture's target strokes |

Each result:

| Field | Meaning |
|---|---|
| `recognitionId` | `r_001`, … |
| `target` | Exactly one of `{ lineId }` or `{ gestureId }` |
| `best` | Text of the rank-1 candidate, or `null` if the engine returned nothing |
| `candidates[]` | `{ rank, text, score }`, best-first, rank starts at 1 |
| `candidates[].score` | The engine's raw score, **unnormalized**, `null` if not provided. Do not read it as a 0..1 probability; its direction and scale are engine-specific. Use `rank` for ordering. |

Lines are recognized in reading order, each with the previously recognized text as context.

## `gestures[]`

| Field | Meaning |
|---|---|
| `gestureId` | `g_01`, … |
| `type` | Engine gesture class, e.g. `strike`, `scribble`, `circle` |
| `strokeIds` | The stroke(s) forming the gesture |
| `score` | Raw engine score of the class, or `null` |
| `targetStrokeIds` | Earlier strokes the gesture was drawn over |
| `effect` | `delete` (strike, scribble), `emphasize` (circle), `none` |
| `targetRecognitionId` | For `delete`: the recognized text of what was deleted. Otherwise `null`. |

### How the tutor should read this

- **Kept text** = each line's result `best`, in `structure` order.
- **Deleted text** = results whose `target.gestureId` points at a `delete` gesture. It's useful
  signal (a student crossing out a wrong answer) but not part of the notes' content.
- **Emphasized** = strokes in `targetStrokeIds` of `emphasize` gestures; map them to lines via
  `structure`.
- Anything math-like or diagram-like: use `strokes` + `bbox` directly; text recognition does not
  claim to handle math notation or diagrams.

Gesture detection only runs where a gesture model is available (the device). A gesture model is
only consulted for strokes that cross at least two earlier strokes and either span half their
width or come after a pause — ordinary letters are never sent to it.

## Validation

```ts
import { validateDocument } from './ink/index.ts'
const { valid, errors } = validateDocument(JSON.parse(text))
```

Beyond the JSON Schema it checks: unique ids; every `strokeId`, `lineId`, `gestureId` and
`recognitionId` reference resolves; each result targets exactly one of line/gesture.
