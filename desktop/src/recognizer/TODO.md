# src/recognizer/ — TypeScript side of the Windows backend

**Owner:** Dev ? (Dev A reviews — must behave like `mobile/modules/mlkit-ink/src/`)

## Work

- [ ] Typed bindings for the Tauri commands in [`docs/recognizer-contract.md`](../../../docs/recognizer-contract.md)
      (via `invoke` from `@tauri-apps/api` — check the current import path in the Tauri docs)
- [ ] `WindowsInkRecognizer` class implementing `InkRecognizer` from `ink/recognition/InkRecognizer.ts`:
  - [ ] `engineName = "windows-ink"`, `engineVersion` = Windows build number if obtainable, else `null`
  - [ ] `recognize()`: convert `Stroke[]` (from `ink/model/types.ts`) to `{x,y,t}[][]`; convert results
        to `Candidate[]` with `rank` starting at 1
  - [ ] Map error codes; `MODEL_NOT_DOWNLOADED` → `ModelNotDownloadedError` from `ink`,
        `DOWNLOAD_UNSUPPORTED` → whatever [`ink/TODO.md`](../../../ink/TODO.md) settles on
- [ ] Unit tests with `invoke` mocked (conversion + error mapping), same cases as the ML Kit wrapper

## Rules

- No layout, gesture or JSON logic here — that lives in `ink/`.
- Never expose Windows recognizer names or types to the rest of the app; the contract is plain JSON.

## Done when

- [ ] `recognizeDocument(doc, new WindowsInkRecognizer(), { gestureModelId: null })` works unchanged
