# src-tauri/ — Rust: Windows Ink behind the shared contract

**Owner:** Dev ?

Implements [`docs/recognizer-contract.md`](../../docs/recognizer-contract.md) as Tauri commands, using
`Windows.UI.Input.Inking` through the `windows` crate. Nothing more — no layout, gestures or JSON here.

The Microsoft guide is written for UWP with an on-screen `InkCanvas`. We don't use `InkCanvas`: strokes
arrive as JSON from the frontend and are rebuilt in Rust.
https://learn.microsoft.com/en-us/windows/uwp/ui-input/convert-ink-to-text

## Spike first — do this before the Tauri scaffold

- [ ] Plain Rust binary (no Tauri) that reads `docs/samples/harness-export.v1.json`, rebuilds its strokes,
      and prints recognition candidates
- [ ] Answer, and record the answers in this file:
  - [ ] Does `InkRecognizerContainer` work in an unpackaged desktop process, or does it need package
        identity / a UI thread / COM apartment setup?
  - [ ] Can strokes be built from our points with `InkStrokeBuilder` (`InkPoint` with position +
        pressure, and per-point timestamps if an overload accepts them)?
  - [ ] Are coordinates scale-sensitive? (Our points are canvas px; Windows ink uses DIPs.)
  - [ ] How to map a BCP-47 tag (`en-US`) to an installed recognizer (`GetRecognizers()` gives
        display names — is there a language property, or do we match names?)
  - [ ] Is there any way to pass context text or a writing area? (Expected: no.)

## Work — verify every type/method name against the Windows API docs before using it

- [ ] Commands: `is_model_downloaded`, `download_model`, `delete_model`, `recognize` — names and shapes
      exactly as the contract, converted to Tauri's snake_case/camelCase rules consistently
- [ ] `is_model_downloaded(modelId)`: true when a recognizer for that language is installed
- [ ] `download_model` / `delete_model`: reject `DOWNLOAD_UNSUPPORTED` (once the lead confirms it)
- [ ] Unknown language tag → `INVALID_MODEL_ID`; known but not installed → `MODEL_NOT_DOWNLOADED`;
      gesture model ids → `INVALID_MODEL_ID` (Windows has no gesture model)
- [ ] `recognize`: build an `InkStrokeContainer` from the strokes, select the recognizer, run
      `RecognizeAsync` with target `All`
- [ ] Windows returns candidates **per word**. Combine into whole-line candidates: first candidate =
      each word's top candidate joined with spaces; decide with the lead whether to emit alternatives
      (and how many) — don't build a combinatorial explosion
- [ ] `score` is always `null` (Windows gives text only)
- [ ] Recognition failure → `RECOGNITION_FAILED`
- [ ] Run off the main/UI thread; cache the recognizer container

## Done when

- [ ] Spike answers recorded above, and the Windows rows of `docs/recognizer-contract.md` corrected
- [ ] Recognizes the replayed `docs/samples/harness-export.v1.json` strokes
- [ ] All applicable error codes reachable and tested manually (uninstall the language pack to test
      `MODEL_NOT_DOWNLOADED`)
- [ ] Output shape matches the ML Kit modules for the same input
