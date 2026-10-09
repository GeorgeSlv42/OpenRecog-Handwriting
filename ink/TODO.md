# ink/ — changes needed for a third backend (Windows desktop)

**Owner:** Lead (small, but every app depends on it)

`ink/` is done for ML Kit. These items make it serve mobile **and** desktop without either app
special-casing the other. Context: [`docs/recognizer-contract.md`](../docs/recognizer-contract.md).

## Models the app can't download

Windows recognizers come from OS language packs, so `downloadModel` can't work there. Today
`recognizeDocument()` with `autoDownload: true` calls `downloadModel` for any missing model.

- [ ] Decide one (lead):
  - a `ModelDownloadUnsupportedError` that `ensureModel` lets through as a clear failure, or
  - a capability on `InkRecognizer` (e.g. `readonly canDownloadModels: boolean`) that `ensureModel`
    checks before trying, throwing `ModelNotDownloadedError` instead
- [ ] Implement it, update `FakeRecognizer` and add a pipeline test for the "can't download" path
- [ ] Either way the result must be `recognition.status: "failed"` with a readable `error`, never a throw

## One copy of ink/, imported by every app

- [ ] Root `package.json` with npm workspaces: `ink`, `harness`, `mobile`, `desktop`
- [ ] Apps import `@openrecog-handwriting/ink` instead of relative paths; no copies
- [ ] Give `ink/` its own `typescript` devDependency (typecheck currently borrows harness's)
- [ ] Check Metro (mobile) and Vite (desktop, harness) both resolve the workspace package and compile
      its `.ts` sources

## Docs

- [ ] `docs/ink-schema.md`: list known `engine.name` values (`mlkit-digital-ink`, `windows-ink`) and note
      that `score` is always `null` for `windows-ink`
- [ ] `docs/samples/`: add a real Windows export once desktop works

## Done when

- [ ] `npm test` and typecheck pass in `ink/` with the new error/capability path covered
- [ ] Harness, mobile and desktop all build against the same workspace `ink` package
