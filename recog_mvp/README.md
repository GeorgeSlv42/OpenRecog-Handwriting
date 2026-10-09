# Windows Ink desktop MVP

Open a schema v1 ink JSON export, choose an installed Windows handwriting recognizer,
recognize its lines, and copy the transcript. Recognition runs locally. The source file
is never modified. This is a standalone desktop prototype, not an Electron app or the
mobile ML Kit integration.

## Run

Requirements: Windows 10/11, Windows PowerShell 5.1 (built into Windows), Node.js 24+ on
PATH, and a Windows handwriting language installed. No npm dependencies or .NET SDK
are needed. Use `powershell.exe`, not PowerShell 7 (`pwsh`).

Double-click `desktop/Start.cmd`, or run this from the repository root:

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\desktop\WindowsInk.ps1
```

`Bypass` applies only to this process; it does not change the machine's execution policy.

1. Click **Open JSON...** and choose an export made with the harness's **Schema v1.0.0** option.
2. Check the displayed document language and choose the matching installed recognizer.
   Selection is explicit because Windows recognizer names are localized, not BCP-47 IDs.
3. Click **Recognize lines**. The table shows each line's text and per-word alternatives.
4. Read the transcript or click **Copy text**.

If no recognizers are listed, open Windows Settings > Time & language, select your language's
options, install its **Handwriting** feature, and restart the app. Menu names vary by Windows version.

You can also preload a file:

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\desktop\WindowsInk.ps1 -File .\docs\samples\harness-export.v1.json
```

The checked-in sample is useful for testing the plumbing; its ground-truth label is not
a promise of Windows recognition accuracy. Use actual handwriting exports to evaluate accuracy.

## How it works

- `prepare.ts` calls the shared `parseDocument` validator, resolves line/stroke references,
  preserves line order, and orders strokes by their start times. It never passes ground truth
  or previous recognized text to the engine.
- `WindowsInk.ps1` builds native `InkPoint` and `InkStroke` objects, then recognizes one line
  at a time with `InkRecognizerContainer.RecognizeAsync`.
- All strokes in a line receive the same translation to keep their relative spacing.
  Pressure is retained when supplied; otherwise native points use a neutral pressure of 0.5.
  The MVP uses the basic point constructor: timestamps determine stroke order but are not
  passed into Windows recognition.
- Windows returns word candidates. The MVP orders word results left-to-right and joins each
  word's best candidate. Alternatives are shown per word (`;` separates words); they are not
  ranked whole-line candidates or numeric confidence scores.
- The interface remains responsive during native recognition and reports failures per line.
  A native operation times out after 60 seconds. File/recognizer changes are disabled during a run.

## Scope

Left-to-right prose only. Drawing blocks are skipped; unknown blocks are attempted as text.
Existing gesture annotations and strokes targeted by delete gestures are excluded, but no new
gestures are detected. Unannotated cross-outs may therefore affect recognition. Math layout,
right-to-left word ordering, legacy/native Excalidraw conversion, ink preview, model installation,
and exporting an enriched document are not included.

The app reuses shared validation and document structure, but does not yet implement the
TypeScript `InkRecognizer` adapter. It calls Windows directly from the desktop host. This keeps
the MVP runnable without a native build toolchain; a later desktop shell can replace that host.

## Verification and headless usage

```powershell
node --test desktop/prepare.test.ts
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\desktop\WindowsInk.ps1 -ListRecognizers
```

Use an exact installed recognizer name from the second command:

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\desktop\WindowsInk.ps1 -Headless -File .\docs\samples\harness-export.v1.json -RecognizerName 'Microsoft English (US) Handwriting Recognizer'
```

Headless output is a diagnostic JSON report, not a schema v1 document. Errors produce a nonzero exit.
To exercise WPF loading, button events, UI state, and actual native recognition without opening
a window, replace `-Headless` with `-SmokeTest`.

References: [Windows ink recognition](https://learn.microsoft.com/en-us/windows/uwp/ui-input/convert-ink-to-text)
and [programmatic stroke construction](https://learn.microsoft.com/en-us/uwp/api/windows.ui.input.inking.inkstrokebuilder.createstrokefrominkpoints).
