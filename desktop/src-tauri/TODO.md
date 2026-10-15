# src-tauri/ — Rust: Windows Ink behind the shared contract

**Owner:** Dev ? (desktop)

Your file: [`src/windows_ink.rs`](src/windows_ink.rs). It already has the four commands with the right
signatures, registered in `lib.rs` and called from the app. `download_model` / `delete_model` are
**done** (Windows can't install recognizers from an app, so they return `DOWNLOAD_UNSUPPORTED`).
You implement `is_model_downloaded` and `recognize`. Contract:
[`docs/recognizer-contract.md`](../../docs/recognizer-contract.md).

The scaffold has **not been compiled yet**: the machine it was made on has no Rust toolchain. Your first
`npm run desktop` is also the first build; fix any compile errors in the scaffold first and tell the
lead what they were.

## Already answered by `recog_mvp/` (PowerShell prototype — read `Invoke-InkLine` in `WindowsInk.ps1`)

- `InkRecognizerContainer` works in an unpackaged desktop process (no UWP, no package identity)
- Strokes: `InkStrokeBuilder.CreateStrokeFromInkPoints(points, Matrix3x2::identity())` with
  `InkPoint::new(position, pressure)`; pressure defaults to 0.5 when absent
- Translate each line so its min x/y is 0, keeping relative spacing between strokes
- `RecognizeAsync(container, InkRecognitionTarget::All)` returns one result **per word**; sort by
  `BoundingRect.X` and join each word's first candidate → the line's best text
- Recognizer names are localized display names (`Microsoft English (US) Handwriting Recognizer`),
  not BCP-47 tags

## Work — verify every type/method name against the windows-rs docs before using it

- [ ] Add the `windows` crate to `Cargo.toml` with the features for `UI_Input_Inking`,
      `Foundation`, `Foundation_Collections`, `Foundation_Numerics` (check exact feature names)
- [ ] Map a BCP-47 tag (`en-US`) to an installed recognizer. Recognizers have no language property in
      the prototype, so find a reliable mapping (check the API docs first; fall back to a small lookup
      table of display names) and document it here
- [ ] `is_model_downloaded`: true when a recognizer for the tag is installed; unknown tag →
      `INVALID_MODEL_ID`; gesture model ids → `INVALID_MODEL_ID` (Windows has no gesture model)
- [ ] `recognize`: not installed → `MODEL_NOT_DOWNLOADED`; build strokes, select the recognizer
      (`SetDefaultRecognizer`), run `RecognizeAsync`, combine per-word results into whole-line
      candidates. First candidate = best words joined with spaces. Decide with the lead whether to
      emit alternatives (e.g. swap one word at a time), and don't build a combinatorial explosion
- [ ] `score` always `None` (Windows gives text only); engine failure → `RECOGNITION_FAILED`
- [ ] Don't block the UI thread (commands are `async`; WinRT calls may need a blocking task or the
      right COM apartment, so check what windows-rs requires)
- [ ] Optional: report the Windows build as `engineVersion` (set it in `app/src/recognizer/windowsInk.ts`)

## Done when

- [ ] Same sample strokes give the same text as `recog_mvp` (`-Headless` mode) for the same recognizer
- [ ] Uninstalling the language pack gives `MODEL_NOT_DOWNLOADED` with a readable message
- [ ] No `NOT_IMPLEMENTED` left; output shape matches the ML Kit modules for the same input
