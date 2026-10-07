# app/ — screens (Phase 1 step 7)

**Owner:** Dev A

Only the UI needed to test the pipeline. No tutor, no note management, no styling work.

## Test screen

- [ ] Fields: courseId / lectureId / noteId / pageId / language (defaults are fine, like the harness)
- [ ] Model status for the selected language: downloaded / not downloaded / downloading / error
- [ ] Buttons: Download model, Delete model (useful for testing the first-run path)
- [ ] `<InkCanvas>` from `components/` filling the rest of the screen
- [ ] **Recognize**: `buildDocument()` → `recognizeDocument(doc, mlkitRecognizer, { gestureModelId })`
      from `ink/` — don't re-implement layout or gesture logic here
- [ ] Show the result: per-line `best` text, tap a line to see all candidates + scores,
      list gestures (type, effect, deleted text)
- [ ] **Export**: `serializeDocument()` → write file → system share sheet
- [ ] **Clear** page

## Notes

- `recognition.status: "failed"` is a normal state (no model, engine error). Show `error`, still
  allow export — raw strokes must never be lost.
- Recognition is async and can be slow on first call; don't block the UI thread.

## Done when

- [ ] Fresh install, airplane mode off: download model, draw, recognize, export, share
- [ ] Airplane mode on afterwards: recognition still works
- [ ] Exported file passes `validateDocument()`
