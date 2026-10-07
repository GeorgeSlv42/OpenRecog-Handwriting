# Ink-capture harness

A single page: draw with a stylus/mouse in Excalidraw, optionally label what you wrote (ground
truth), export the raw stroke data as JSON. It does not recognize anything — it just produces
real ink data to feed `recognition_text/` and `recognition_math/` prototyping code. (ML Kit
recognition runs on-device in the mobile app; it has no web SDK.)

Uses the real `@excalidraw/excalidraw` package, so the stroke data matches what an
Excalidraw-based note canvas produces, not a stand-in.

## Run it

```
npm install
npm run dev
```

Open http://localhost:5173, draw, fill in the note ids if you care about them, click
**Export strokes (JSON)**. **Clear** starts a new page.

## Exported formats

Pick in the toolbar dropdown.

### Schema v1.0.0 (default)

The shared ink document format — see [`docs/ink-schema.md`](../docs/ink-schema.md) and
[`docs/samples/harness-export.v1.json`](../docs/samples/harness-export.v1.json). Built with the
shared [`ink/`](../ink/) package, so it is identical to what the mobile app exports, minus
recognition (`recognition.status` is `"notRecognized"`).

Per-point timestamps come from [`src/capture/TimedInkCapture.ts`](src/capture/TimedInkCapture.ts):
Excalidraw doesn't keep time per point, so the harness records the pointer stream itself (coalesced
events, real pen pressure) and links each recording to the freedraw element it produced. Erase,
undo and redo in Excalidraw still decide which strokes are exported.

### Legacy

The original format, unchanged:

```json
{
  "label": "what you typed as ground truth, or null",
  "capturedAt": "ISO timestamp",
  "strokes": [
    { "points": [[x, y], ...], "pressures": [...], "strokeWidth": number }
  ]
}
```
