# Native recognizer contract

Every native backend exposes **exactly** this to JavaScript: same function names, same argument and
return shapes, same error codes. The TypeScript version lives in
[`ink/recognition/NativeRecognizer.ts`](../ink/recognition/NativeRecognizer.ts) (`NativeRecognizer`), and
one shared adapter (`NativeInkRecognizer`) turns any backend into the `InkRecognizer` the pipeline uses.
Platform devs only write native code; the JS side is already done and tested.

| Backend | Native code (your work) | JS glue (done) | Engine |
|---|---|---|---|
| Android | [`app/modules/mlkit-ink/android/`](../app/modules/mlkit-ink/android/) — Kotlin | [`app/modules/mlkit-ink/index.ts`](../app/modules/mlkit-ink/index.ts) | Google ML Kit Digital Ink |
| iOS | [`app/modules/mlkit-ink/ios/`](../app/modules/mlkit-ink/ios/) — Swift | same as Android | Google ML Kit Digital Ink |
| Windows | [`desktop/src-tauri/src/windows_ink.rs`](../desktop/src-tauri/src/windows_ink.rs) — Rust | [`app/src/recognizer/windowsInk.ts`](../app/src/recognizer/windowsInk.ts) | Windows Ink (`Windows.UI.Input.Inking`) |

Each native file already contains stubs with the right signatures that reject `NOT_IMPLEMENTED`.
Replace the stub bodies; don't change names or shapes without the lead.

## Functions

| Function | In | Out |
|---|---|---|
| `isModelDownloaded` | `modelId: string` | `boolean` |
| `downloadModel` | `modelId: string`, `wifiOnly: boolean` | resolves when downloaded |
| `deleteModel` | `modelId: string` | resolves when deleted |
| `recognize` | `modelId: string`, `strokes: {x,y,t}[][]`, `preContext: string \| null`, `writingArea: {width,height} \| null` | `{ text: string, score: number \| null }[]` best-first |

- `modelId` is a BCP-47 language tag (`en-US`) or a gesture model id. Backends map it to their own
  identifiers internally; JavaScript never sees engine-specific ids.
- `preContext` and `writingArea` are **always sent**, as `null` when absent, so every native signature
  has a fixed number of arguments. Engines that can't use them ignore them.
- Coordinates are canvas pixels; `t` is milliseconds from the first point on the page.
- Rust (Tauri) parameters are snake_case (`model_id`, `pre_context`); Tauri maps the camelCase JS keys.

## Error codes

Reject with one of these codes. The JS adapter accepts them with or without an `ERR_` prefix, so Swift
exceptions can simply be named after the code (`ModelNotDownloadedException` → `ERR_MODEL_NOT_DOWNLOADED`).
Rust returns `{ code, message }`. The `message` is shown to the user, so make it actionable.

| Code | When |
|---|---|
| `MODEL_NOT_DOWNLOADED` | Model/recognizer for this language isn't on the device |
| `INVALID_MODEL_ID` | Language tag (or gesture id) the engine doesn't know |
| `DOWNLOAD_FAILED` | Download started but failed (network, storage) |
| `DOWNLOAD_UNSUPPORTED` | The OS manages models, not the app (Windows). Message says what to install where |
| `RECOGNITION_FAILED` | The engine errored while recognizing |
| `NOT_IMPLEMENTED` | Scaffold stubs only. Must be gone before a backend counts as done |

The pipeline never throws on these: the document comes back with `recognition.status: "failed"` and
the message in `recognition.error`, and the raw ink can still be exported.

## Where the engines differ

The contract is identical; what each engine can actually do is not. Backends must not fake missing
features (no invented scores, no silent no-op downloads).

| | ML Kit (Android / iOS) | Windows Ink |
|---|---|---|
| Models | Downloaded by the app per language | Handwriting language packs installed by the user in Windows Settings |
| `downloadModel` / `deleteModel` | Supported | `DOWNLOAD_UNSUPPORTED` (already implemented) |
| `isModelDownloaded` | Model manager check | Is a recognizer for this language installed? |
| Result granularity | Candidates for the whole ink | Candidates **per word** — combine into whole-line candidates natively |
| `score` | Engine-dependent, see open questions in [`app/modules/mlkit-ink/README.md`](../app/modules/mlkit-ink/README.md) | Text only → always `null` |
| `preContext`, `writingArea` | Supported | No equivalent known — ignored |
| Gesture model | Yes (`-x-gesture` models, id still to confirm) | None — the app passes `gestureModelId: null` |
| Runs on | Android, iOS | Windows 10/11 only |

What [`recog_mvp/`](../recog_mvp/) already proved for Windows: recognition works from a plain desktop
process (no UWP); strokes can be built with `InkStrokeBuilder.CreateStrokeFromInkPoints` from
`InkPoint(position, pressure)`; recognizer names are localized display names, not BCP-47 tags.
