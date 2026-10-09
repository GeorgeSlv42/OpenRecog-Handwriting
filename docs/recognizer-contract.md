# Native recognizer contract — LEAD: finalize before any native code is written

Every native backend exposes **exactly** this to JavaScript: same function names, same argument and
return shapes, same error codes. Each backend has a thin TypeScript wrapper that adapts it to the
`InkRecognizer` interface in [`ink/recognition/InkRecognizer.ts`](../ink/recognition/InkRecognizer.ts),
so `recognizeDocument()` runs unchanged on every platform.

| Backend | Native code | TS wrapper | Engine |
|---|---|---|---|
| Android | [`mobile/modules/mlkit-ink/android/`](../mobile/modules/mlkit-ink/android/) (Kotlin) | [`mobile/modules/mlkit-ink/src/`](../mobile/modules/mlkit-ink/src/) | Google ML Kit Digital Ink |
| iOS | [`mobile/modules/mlkit-ink/ios/`](../mobile/modules/mlkit-ink/ios/) (Swift) | same as Android | Google ML Kit Digital Ink |
| Windows | [`desktop/src-tauri/`](../desktop/src-tauri/) (Rust) | [`desktop/src/recognizer/`](../desktop/src/recognizer/) | Windows Ink (`Windows.UI.Input.Inking`) |

## Functions

Proposed (TODO lead: confirm names, then remove "proposed"):

| Function | In | Out |
|---|---|---|
| `isModelDownloaded` | `modelId: string` | `boolean` |
| `downloadModel` | `modelId: string`, `wifiOnly: boolean` | resolves when downloaded |
| `deleteModel` | `modelId: string` | resolves when deleted |
| `recognize` | `modelId`, `strokes: {x,y,t}[][]`, `preContext?: string`, `writingArea?: {width,height}` | `{ text: string, score: number \| null }[]` best-first |

`modelId` is always a BCP-47 language tag (`en-US`) or a gesture model id. Backends map it to their
own identifiers internally; JavaScript never sees engine-specific ids.

## Error codes

Reject with these, every backend:

- [ ] `MODEL_NOT_DOWNLOADED`
- [ ] `INVALID_MODEL_ID` (language tag the engine doesn't know)
- [ ] `DOWNLOAD_FAILED`
- [ ] `RECOGNITION_FAILED`
- [ ] Proposed: `DOWNLOAD_UNSUPPORTED` — the engine's models are managed by the OS, not the app
      (Windows). Returned by `downloadModel` and `deleteModel`. See [`ink/TODO.md`](../ink/TODO.md)
      for how the pipeline should react.

## Where the engines differ

The contract is identical; what each engine can actually do is not. Wrappers must not fake missing
features (no invented scores, no silent no-op downloads).

| | ML Kit (Android / iOS) | Windows Ink |
|---|---|---|
| Models | Downloaded by the app per language | Handwriting language packs installed by the user in Windows Settings |
| `downloadModel` / `deleteModel` | Supported | `DOWNLOAD_UNSUPPORTED` (proposed) |
| `isModelDownloaded` | Model manager check | Is a recognizer for this language installed? |
| Result granularity | Candidates for the whole ink | Candidates **per word** — the native side must combine them into whole-line candidates |
| `score` | Engine-dependent, see open questions in [`mobile/modules/mlkit-ink/README.md`](../mobile/modules/mlkit-ink/README.md) | Text only → always `null` |
| `preContext`, `writingArea` | Supported | No equivalent known — ignored (verify) |
| Gesture model | Yes (`-x-gesture` models) | None — run the pipeline with `gestureModelId: null` |
| Runs on | Android, iOS | Windows 10/11 only |

Verify every Windows row against the Microsoft docs during the desktop spike
([`desktop/src-tauri/TODO.md`](../desktop/src-tauri/TODO.md)) and correct this table.
