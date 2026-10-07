# components/ — InkCanvas (stroke capture)

**Owner:** Dev B

The mobile equivalent of the harness's `src/capture/TimedInkCapture.ts`. Its output feeds
`buildDocument()` in `ink/` as `RawStroke[]` — read `ink/export/document.ts` first.

## Blocked on

- [ ] Lead approval of the drawing library (e.g. `@shopify/react-native-skia` +
      `react-native-gesture-handler`). Don't add it before that.

## Work

- [ ] `InkCanvas.tsx`: render strokes live while drawing
- [ ] Record per point: `x`, `y` (canvas px), `t` (ms, any monotonic clock — `ink` rebases it),
      `p` pressure **only for stylus** input (finger pressure is not real; omit it)
- [ ] Record which input type drew each stroke (pen / touch) → `metadata.source.inputDevice`
- [ ] Sample at the device's native rate; don't drop or smooth points (recognizers want raw)
- [ ] Palm rejection: when a stylus is active, ignore touch strokes
- [ ] Undo last stroke, clear
- [ ] Expose `getStrokes(): RawStroke[]` and canvas size to the screen

## Done when

- [ ] Same word written on the harness and on the device produces similar point density and
      timing (compare the two JSON files)
- [ ] Apple Pencil / Android stylus pressure shows up in `p`; finger strokes have no `p`
- [ ] No dropped points during fast writing (check `t` gaps)
