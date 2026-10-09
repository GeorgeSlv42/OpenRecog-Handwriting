# src/app/ — test screen

**Owner:** Dev ?

Same scope as [`mobile/app/TODO.md`](../../../mobile/app/TODO.md): only the UI needed to test the
pipeline. No tutor, no note management, no styling work.

## Capture

- [ ] Reuse the harness capture (Excalidraw + [`harness/src/capture/TimedInkCapture.ts`](../../../harness/src/capture/TimedInkCapture.ts))
      — import it, don't copy it. If importing across apps gets awkward, raise moving it into a shared
      package with the lead
- [ ] Pen pressure and per-point timestamps must survive, exactly as in the harness export

## Test screen

- [ ] Fields: courseId / lectureId / noteId / pageId / language (defaults like the harness)
- [ ] Recognizer status for the selected language: installed / not installed. Not installed → message
      telling the user to add handwriting for that language in Windows Settings (no download button)
- [ ] **Recognize**: `buildDocument()` → `recognizeDocument(doc, windowsRecognizer, { gestureModelId: null })`
      from `ink/` — don't re-implement layout here
- [ ] Show the result: per-line `best` text, click a line to see all candidates
- [ ] **Export**: `serializeDocument()` → save dialog
- [ ] **Clear** page

## Notes

- `recognition.status: "failed"` is a normal state. Show `error`, still allow export.

## Done when

- [ ] Draw, recognize, export on Windows with pen and with mouse
- [ ] Exported file passes `validateDocument()`
