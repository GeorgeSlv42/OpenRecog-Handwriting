# Ink-capture harness

A single page: draw with a stylus/mouse in Excalidraw, optionally label what you wrote (ground
truth), export the raw stroke data as JSON. It does not recognize anything — it just produces
real ink data to feed `recognition_text/` and `recognition_math/` prototyping code.

Uses the real `@excalidraw/excalidraw` package — the same library SFTS's own canvas note type
is built on — so the stroke data this produces matches the real thing, not a stand-in.

## Run it

```
npm install
npm run dev
```

## Exported format

```json
{
  "label": "what you typed as ground truth, or null",
  "capturedAt": "ISO timestamp",
  "strokes": [
    { "points": [[x, y], ...], "pressures": [...], "strokeWidth": number }
  ]
}
```
